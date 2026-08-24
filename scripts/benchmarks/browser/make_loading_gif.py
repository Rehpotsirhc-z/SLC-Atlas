#!/usr/bin/env python3
"""Combine browser-loading captures into a side-by-side animation."""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace/scripts/benchmarks/results/loading-frames")
FRAMES = ROOT / "frames"
OUT = ROOT.parent / "loading-comparison.gif"
FONT = "/workspace/.venv/lib/python3.12/site-packages/matplotlib/mpl-data/fonts/ttf/{}.ttf"

ORDER = ["igv", "atlasforge", "jbrowse"]
PANEL_H = 620
MX, GAP, HEAD, MB = 30, 26, 152, 24
FPS = 15
FREEZE_MS = 2000
BG = (18, 20, 24)
WHITE = (236, 238, 241)
DIM = (150, 155, 162)
GREEN = (52, 199, 89)
GRAY = (60, 64, 70)

f_timer = ImageFont.truetype(FONT.format("DejaVuSans-Bold"), 46)
f_name = ImageFont.truetype(FONT.format("DejaVuSans-Bold"), 24)
f_time = ImageFont.truetype(FONT.format("DejaVuSans-Bold"), 22)


def load_tool(t):
    m = json.load(open(FRAMES / t / "manifest.json"))
    frames = m["frames"]

    nw, nh = m["width"], m["height"]
    pw = round(PANEL_H * nw / nh)
    imgs = []
    for fr in frames:
        im = Image.open(FRAMES / t / f"frame_{fr['i']:04d}.png").convert("RGB")
        imgs.append((fr["elapsed_ms"], im.resize((pw, PANEL_H), Image.LANCZOS)))
    final = imgs[-1][1].tobytes()
    done = next((ms for ms, im in imgs if im.tobytes() == final), imgs[-1][0])
    return {"label": m["label"], "pw": pw, "imgs": imgs, "done": done}


tools = {t: load_tool(t) for t in ORDER}
W = MX * 2 + sum(tools[t]["pw"] for t in ORDER) + GAP * (len(ORDER) - 1)
H = HEAD + PANEL_H + MB
xs, x = {}, MX
for t in ORDER:
    xs[t] = x
    x += tools[t]["pw"] + GAP
T_load = max(tools[t]["done"] for t in ORDER)


def frame_at(t, ms):
    imgs = tools[t]["imgs"]
    pick = imgs[0][1]
    for e, im in imgs:
        if e <= ms:
            pick = im
        else:
            break
    return pick


def ctr(draw, cx, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


def compose(ms):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    ctr(d, W / 2, 18, f"{ms/1000:5.2f} s", f_timer, WHITE)
    for t in ORDER:
        x0 = xs[t]
        pw = tools[t]["pw"]
        cx = x0 + pw / 2
        done_ms = tools[t]["done"]
        is_done = ms >= done_ms
        ctr(d, cx, 80, tools[t]["label"], f_name, WHITE)
        if is_done:
            ctr(d, cx, 110, f"✓ {done_ms/1000:.2f} s", f_time, GREEN)
        else:
            ctr(d, cx, 110, "loading…", f_time, DIM)
        im.paste(frame_at(t, ms), (x0, HEAD))
        col = GREEN if is_done else GRAY
        bw = 5 if is_done else 1
        d.rectangle(
            [x0 - bw, HEAD - bw, x0 + pw + bw - 1, HEAD + PANEL_H + bw - 1], outline=col, width=bw
        )
    return im


dt = round(1000 / FPS)
seq, durs = [], []
ms = 0
while ms <= T_load + 120:
    seq.append(compose(ms))
    durs.append(dt)
    ms += dt
seq.append(compose(T_load + 120))
durs.append(FREEZE_MS)

pal = seq[-1].quantize(colors=256, method=Image.MEDIANCUT)
qseq = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in seq]
qseq[0].save(
    OUT, save_all=True, append_images=qseq[1:], duration=durs, loop=0, optimize=True, disposal=2
)
kb = OUT.stat().st_size / 1024
print(f"{OUT}  {W}x{H}  {len(qseq)} frames  {kb:.0f} KB  (T_load={T_load}ms)")
