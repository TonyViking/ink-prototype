from PIL import Image, ImageDraw
import math

CREAM = (242, 226, 196)
WHITE = (255, 255, 255)
BLUE  = (79, 163, 255)
PINK  = (255, 119, 176)
BG    = (0, 0, 0)

SS = 4  # supersample for smooth edges

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make(size, pad_ratio=0.0, rounded=True, dots_y=0.84):
    s = size * SS
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)

    inset = int(s * pad_ratio)
    box = (inset, inset, s - inset, s - inset)
    inner = box[2] - box[0]
    ox, oy = box[0], box[1]

    # Tapering ink stroke: a curved sweep, fat-to-thin, white -> cream.
    # Drawn as a run of overlapping circles whose radius and colour vary
    # along the path, the same way a pressure stroke renders.
    p0 = (ox + inner * 0.24, oy + inner * 0.74)
    p1 = (ox + inner * 0.34, oy + inner * 0.30)
    p2 = (ox + inner * 0.72, oy + inner * 0.40)
    p3 = (ox + inner * 0.80, oy + inner * 0.22)
    steps = 240
    rmax = inner * 0.085
    rmin = inner * 0.012
    for i in range(steps + 1):
        t = i / steps
        # cubic bezier
        mt = 1 - t
        x = (mt**3)*p0[0] + 3*(mt**2)*t*p1[0] + 3*mt*(t**2)*p2[0] + (t**3)*p3[0]
        y = (mt**3)*p0[1] + 3*(mt**2)*t*p1[1] + 3*mt*(t**2)*p2[1] + (t**3)*p3[1]
        r = rmin + (rmax - rmin) * (1 - t)        # pressure tapers off
        col = lerp(WHITE, CREAM, t)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    # Palette signature: three dots low-left.
    dot_r = inner * 0.045
    cy = oy + inner * dots_y
    for j, col in enumerate((CREAM, BLUE, PINK)):
        cx = ox + inner * (0.24 + j * 0.12)
        d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=col)

    img = img.resize((size, size), Image.LANCZOS)

    if rounded:
        # rounded-rect with transparent corners so it sits well on any background
        mask = Image.new("L", (size, size), 0)
        md = ImageDraw.Draw(mask)
        rad = int(size * 0.22)
        md.rounded_rectangle([0, 0, size - 1, size - 1], radius=rad, fill=255)
        out = img.convert("RGBA")
        out.putalpha(mask)
        return out
    return img

make(192).save("icon-192.png")
make(512).save("icon-512.png")
# maskable: full-bleed black, content kept inside the safe zone, square (OS masks it)
make(512, pad_ratio=0.17, rounded=False, dots_y=0.78).save("icon-512-maskable.png")
print("icons written")
