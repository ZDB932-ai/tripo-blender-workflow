"""Render README illustrations. Requires Pillow; no workflow runtime dependency.

Run from any directory: python docs/images/generate.py
Set README_FONT to a TrueType font if none of the defaults is installed.
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
FONTS = [os.getenv('README_FONT', ''), 'C:/Windows/Fonts/segoeui.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
         '/System/Library/Fonts/Supplemental/Arial.ttf']
FONT = next((p for p in FONTS if p and Path(p).is_file()), None)
if not FONT:
    raise SystemExit('Set README_FONT to a TrueType font path.')
BG, PANEL, INK, MUTED = '#10182b', '#1b2941', '#f1f5ff', '#b4c3db'
CYAN, VIOLET, GREEN, AMBER = '#72dfeb', '#b6a2ff', '#8ae2b5', '#ffd18b'

def canvas(height):
    im = Image.new('RGB', (1440, height), BG)
    return im, ImageDraw.Draw(im)

def text(d, xy, value, size=24, fill=INK):
    d.text(xy, value, font=ImageFont.truetype(FONT, size), fill=fill)

def box(d, xy, color=PANEL, outline=None):
    d.rounded_rectangle(xy, radius=18, fill=color, outline=outline, width=2)

def arrow(d, start, end, color=CYAN):
    d.line([start, end], fill=color, width=3)
    x, y = end
    d.polygon([(x, y), (x-11, y-7), (x-11, y+7)], fill=color)

def save(im, name):
    im.save(OUT / name, optimize=True)

im, d = canvas(570)
text(d, (64, 42), 'OPEN SOURCE  /  AGENT-ASSISTED 3D PRODUCTION', 20, CYAN)
text(d, (60, 91), 'Tripo x Blender', 76)
text(d, (64, 188), 'From reference to verified delivery.', 33, MUTED)
for x, title, sub, accent in [
    (64, 'CREATE', 'Tripo Studio', CYAN),
    (511, 'VERIFY + REFINE', 'Blender', VIOLET),
    (958, 'DELIVER', 'Files + evidence', GREEN),
]:
    box(d, (x, 290, x+416, 435))
    d.rounded_rectangle((x, 290, x+6, 435), radius=3, fill=accent)
    text(d, (x+27, 319), title, 27, accent)
    text(d, (x+27, 368), sub, 25)
arrow(d, (484, 362), (503, 362))
arrow(d, (931, 362), (950, 362))
text(d, (64, 488), 'Versioned sources  /  One-shot execution  /  Human acceptance', 24, MUTED)
save(im, 'hero.png')

im, d = canvas(780)
text(d, (54, 35), '01 / HOW THE WORKFLOW FITS TOGETHER', 20, CYAN)
text(d, (54, 78), 'One asset. Traceable steps. Evidence at every handoff.', 35)
items = [
    ('01  DEFINE', 'Brief + reference', 'Scope and review', CYAN),
    ('02  CREATE', 'Tripo Studio', 'Generate / rig / motion', CYAN),
    ('03  VERIFY', 'Blender', 'Inspect + local repair', VIOLET),
    ('04  DELIVER', 'Export + re-import', 'Review final files', GREEN),
]
for i, (title, a, b, c) in enumerate(items):
    x = 54+i*344
    box(d, (x, 177, x+302, 359))
    text(d, (x+22, 201), title, 23, c)
    text(d, (x+22, 253), a, 24)
    text(d, (x+22, 300), b, 20, MUTED)
    if i < 3:
        arrow(d, (x+308, 267), (x+335, 267))
box(d, (54, 404, 1386, 526), outline='#415570')
text(d, (80, 425), 'AGENT + LOCAL CLI', 22, CYAN)
text(d, (80, 469), 'Task identity  /  Source hashes  /  Execution receipts  /  Quality evidence  /  Recovery', 24)
text(d, (54, 574), 'ADAPT THE PATH TO THE ASSET', 20, VIOLET)
text(d, (54, 617), 'Static prop: skip motion. Existing model: start from a verified source.', 25)
text(d, (54, 660), 'Animated asset: stabilize structure before the final Tripo rig / motion round trip.', 25)
text(d, (54, 727), 'Architecture illustration; not a model result or a product screenshot.', 18, MUTED)
save(im, 'workflow.png')

im, d = canvas(740)
text(d, (54, 35), '02 / LOCAL EXECUTION & RECOVERY', 20, CYAN)
text(d, (54, 79), 'Resume the record. Never replay an unknown operation.', 36)
box(d, (54, 172, 390, 344))
text(d, (80, 193), 'RUN ONCE', 26, CYAN)
text(d, (80, 247), 'Validate + dispatch', 25)
text(d, (80, 289), 'Isolated Blender process', 23, MUTED)
branches = [
    (173, GREEN, 'Valid success receipt', 'Collect technical inventory', 'Add quality evidence, then resume'),
    (338, AMBER, 'Valid failure receipt', 'Record the failed attempt', 'Diagnose before a new repair'),
    (503, VIOLET, 'Timeout / missing receipt', 'Reconcile process + artifacts', 'Keep unknown state; do not rerun'),
]
for y, color, title, a, b in branches:
    d.line([(410, 258), (448, 258), (448, y+64), (482, y+64)], fill=color, width=3)
    arrow(d, (482, y+64), (511, y+64), color)
    box(d, (520, y, 1386, y+137))
    text(d, (546, y+15), title, 26, color)
    text(d, (546, y+58), a, 24)
    text(d, (546, y+96), b, 21, MUTED)
text(d, (54, 690), 'Technical execution success does not imply visual quality or final user acceptance.', 23, MUTED)
save(im, 'recovery.png')
print('Rendered hero.png, workflow.png, recovery.png')
