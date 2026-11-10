// Z-Image Turbo character-reference generator (drives the ComfyUI HTTP API).
//   node tools/comfy/gen_character.js info          -> print loader schemas + available files
//   node tools/comfy/gen_character.js gen [n]       -> generate front/side/back refs, copy to docs/refs/character/
//   node tools/comfy/gen_character.js gen 1024      -> square variant at 1024x1024
// No dependencies (node >= 18 fetch).
const fs = require('fs');
const path = require('path');

const HOST = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
const COMFY = process.env.COMFY_ROOT || 'C:\\Users\\dronc\\comfyui\\ComfyUI_windows_portable';
const OUT_SRC = path.join(COMFY, 'ComfyUI', 'output');
const OUT_REPO = path.join(__dirname, '..', '..', 'docs', 'refs', 'character');

const UNET = 'z_image_turbo_int8_convrot.safetensors';
const CLIP = 'qwen_3_4b_fp8_mixed.safetensors';
const VAE = 'ae.safetensors';
let PREFIX = process.env.COMFY_PREFIX || 'road_racing_game/character';

// Canonical settings from ComfyUI blueprints/"Text to Image (Z-Image-Turbo).json":
// ModelSamplingAuraFlow shift 3, KSampler steps 8, cfg 1, res_multistep + simple, denoise 1.
const STYLE = 'photorealistic photograph, full body, neutral A-pose, calm expression, '
  + 'plain dark grey studio background, even soft lighting, no motion blur, sharp focus';

const VIEWS = [
  { name: 'front', text: 'character reference sheet photo, straight-on front view, facing the camera' },
  { name: 'side', text: 'character reference photo, exact left side profile view, 90 degrees' },
  { name: 'back', text: 'character reference photo, straight-on back view, seen from behind' },
];

const BASE = 'Korean man in his late twenties, street racer look, short black hair, '
  + 'plain black fitted t-shirt, dark jeans, white sneakers, athletic build, ';

async function api(p, opt) {
  const r = await fetch(HOST + p, opt);
  if (!r.ok) throw new Error(p + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}

function graph(view, seed, w, h, clipType) {
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: UNET, weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: clipType } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    '4': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3.0, model: ['1', 0] } },
    '5': { class_type: 'CLIPTextEncode', inputs: { text: BASE + view.text + ', ' + STYLE, clip: ['2', 0] } },
    '6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
    '7': { class_type: 'EmptySD3LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    '8': {
      class_type: 'KSampler',
      inputs: {
        seed, steps: 8, cfg: 1.0, sampler_name: 'res_multistep', scheduler: 'simple',
        positive: ['5', 0], negative: ['6', 0], model: ['4', 0], latent_image: ['7', 0], denoise: 1.0,
      },
    },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: PREFIX + '/' + view.name } },
  };
}

async function info() {
  const oi = await api('/object_info');
  for (const n of ['UNETLoader', 'CLIPLoader', 'VAELoader', 'ModelSamplingAuraFlow', 'EmptySD3LatentImage']) {
    const d = oi[n];
    if (!d) { console.log('MISSING NODE', n); continue; }
    const req = d.input.required;
    const line = Object.keys(req).map(k => {
      const t = req[k][0];
      const list = typeof t === 'string' ? '' : ' [' + t.slice(0, 12).join(', ') + ']';
      return k + '=' + t + list;
    }).join(' | ');
    console.log(n + ' :: ' + line);
  }
}

async function gen(w, h) {
  const oi = (await api('/object_info/CLIPLoader')).CLIPLoader;
  const types = oi.input.required.type[0];
  const clipType = types.includes('z_image') ? 'z_image' : 'lumina2';
  console.log('clip types include z_image:', types.includes('z_image'), '-> using', clipType);

  const jobs = [];
  for (let i = 0; i < VIEWS.length; i++) {
    jobs.push({ id: await post(graph(VIEWS[i], 20261111 + i, w, h, clipType)), view: VIEWS[i].name });
  }
  console.log('queued', jobs.map(j => j.view + '=' + j.id).join(' '));

  for (const j of jobs) {
    const h0 = Date.now();
    let hist = null;
    while (Date.now() - h0 < 900000) {
      hist = await api('/history/' + j.id);
      if (hist[j.id]) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!hist || !hist[j.id]) { console.log('TIMEOUT', j.view); continue; }
    const entry = hist[j.id];
    if (entry.status && entry.status.status_str !== 'success') {
      console.log('FAILED', j.view, entry.status.status_str, JSON.stringify(entry.status).slice(0, 500));
      continue;
    }
    const imgs = [];
    for (const nid of Object.keys(entry.outputs)) {
      for (const im of (entry.outputs[nid].images || [])) imgs.push(im);
    }
    for (const im of imgs) {
      const buf = Buffer.from(await (await api2('/view?filename=' + encodeURIComponent(im.filename)
        + '&subfolder=' + encodeURIComponent(im.subfolder || '') + '&type=' + im.type)).arrayBuffer());
      fs.mkdirSync(OUT_REPO, { recursive: true });
      const tag = (im.subfolder || '').replace(/[\\/]/g, '_');
      const dest = path.join(OUT_REPO, (tag ? tag + '_' : '') + im.filename);
      fs.writeFileSync(dest, buf);
      console.log('saved', dest, buf.length + 'B', 'elapsed ' + Math.round((Date.now() - h0) / 1000) + 's');
    }
  }
}

function api2(p) { return fetch(HOST + p); }

async function post(g) {
  const r = await fetch(HOST + '/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: g }),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error('prompt rejected: ' + JSON.stringify(j).slice(0, 1500));
  return j.prompt_id;
}

(async () => {
  const mode = process.argv[2] || 'info';
  if (mode === 'info') await info();
  else if (mode === 'gen') {
    const w = parseInt(process.argv[3] || '832', 10);
    const h = parseInt(process.argv[4] || '1216', 10);
    if (process.argv[5]) PREFIX = process.argv[5];
    console.log('size', w + 'x' + h, 'prefix', PREFIX);
    await gen(w, h);
  } else console.log('usage: gen [w] [h] [prefix] | info');
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
