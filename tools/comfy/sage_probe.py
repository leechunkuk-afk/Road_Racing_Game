"""SageAttention kernel probe for the ComfyUI portable env.

Run with the portable interpreter:
  python_embeded\\python.exe -s tools\\comfy\\sage_probe.py [seq_len] [head_dim]
Defaults: seq 4200, head_dim 128  (close to Z-Image at 1024x1024: ~4096 image tokens + text)

Reports whether each installed sage kernel really works on this GPU
(no all-zero / black output), how accurate it is vs torch SDPA, and its speed.

NOTE: the *_pv_fp8_cuda kernels crash this GPU (sm86 -> CUDA_ERROR_LAUNCH_FAILURE,
sticky, kills the whole CUDA context). They are skipped unless SAGE_RISKY=1.
"""
import os
import sys
import time
from importlib import metadata

import torch

print("torch", torch.__version__, "| cuda", torch.version.cuda, "| avail", torch.cuda.is_available())
if not torch.cuda.is_available():
    sys.exit(2)

props = torch.cuda.get_device_properties(0)
print("gpu", torch.cuda.get_device_name(0),
      "| cc", torch.cuda.get_device_capability(0),
      "| vram_gb", round(props.total_memory / 1e9, 2))

import sageattention as sa

try:
    ver = metadata.version("sageattention")
except Exception:
    ver = "?"
print("sageattention", ver)
print("funcs", [f for f in dir(sa) if f.startswith("sageattn")])

SEQ = int(sys.argv[1]) if len(sys.argv) > 1 else 4200
HDIM = int(sys.argv[2]) if len(sys.argv) > 2 else 128
RISKY = os.environ.get("SAGE_RISKY") == "1"


def bench(fn, reps=15):
    for _ in range(3):
        fn()
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(reps):
        fn()
    torch.cuda.synchronize()
    return (time.perf_counter() - t0) / reps * 1000.0


def report(out, ref, tag, ms, sdpa_ms):
    d = (out.float() - ref.float()).abs()
    print("  %-30s %8.3f ms  speedup %5.2fx  | maxdiff %.4f meandiff %.5f out_std %.4f zero %.3f"
          % (tag, ms, sdpa_ms / ms, d.max().item(), d.mean().item(),
             out.float().std().item(), (out.float() == 0).float().mean().item()))


def run(b, h, s, d, dtype):
    torch.manual_seed(0)
    q = torch.randn(b, h, s, d, device="cuda", dtype=dtype)
    k = torch.randn(b, h, s, d, device="cuda", dtype=dtype)
    v = torch.randn(b, h, s, d, device="cuda", dtype=dtype)
    ref = torch.nn.functional.scaled_dot_product_attention(q, k, v)
    print("shape B%d H%d S%d D%d %s" % (b, h, s, d, dtype))

    sdpa = lambda: torch.nn.functional.scaled_dot_product_attention(q, k, v)
    t_sdpa = bench(sdpa)
    print("  %-30s %8.3f ms  (baseline)" % ("torch sdpa (auto)", t_sdpa))

    jobs = [("sageattn", lambda: sa.sageattn(q, k, v, tensor_layout="HND"))]
    if hasattr(sa, "sageattn_qk_int8_pv_fp16_cuda"):
        jobs.append(("sage qk_int8_pv_fp16_cuda",
                     lambda: sa.sageattn_qk_int8_pv_fp16_cuda(q, k, v, tensor_layout="HND", pv_accum_dtype="fp32")))
    if hasattr(sa, "sageattn_qk_int8_pv_fp16_triton"):
        jobs.append(("sage qk_int8_pv_fp16_triton",
                     lambda: sa.sageattn_qk_int8_pv_fp16_triton(q, k, v, tensor_layout="HND")))
    if RISKY:
        for nm in ("sageattn_qk_int8_pv_fp8_cuda",):
            if hasattr(sa, nm):
                jobs.append((nm + " (RISKY)", lambda: getattr(sa, nm)(q, k, v, tensor_layout="HND", pv_accum_dtype="fp32")))

    for tag, fn in jobs:
        try:
            out = fn()
            ms = bench(fn)
            report(out, ref, tag, ms, t_sdpa)
        except Exception as e:
            print("  %-30s FAIL %s: %s" % (tag, type(e).__name__, str(e).splitlines()[0]))
            if "launch failure" in str(e).lower():
                print("  sticky CUDA error -> stop, this kernel must stay disabled")
                return False
    return True


ok = True
for dt in (torch.float16, torch.bfloat16):
    print("---")
    ok = run(1, 30, SEQ, HDIM, dt) and ok

print("---")
print("probe", "PASS" if ok else "STOPPED")
