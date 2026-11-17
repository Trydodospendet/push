"""Cuts the generated fur images (JPEG with a baked-in checkerboard or white background) into
transparent PNGs in marketing/fur-quellen/cut/. Then run scripts/finish-fur-assets.js to produce
assets/fur/*.webp. Usage: python scripts/cut-fur-assets.py"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

SRC = {  # output name -> (part of the source file name, kind)
    '0': ('1stlo0', 'glyph'), '1': ('owx833', 'glyph'), '2': ('hdykxc', 'glyph'),
    '3': ('alplwv', 'glyph'), '4': ('o3n96z', 'glyph'), '5': ('qbc760', 'glyph'),
    '6': ('r6ia0k', 'glyph'), '7': ('oawajd', 'glyph'), '8': ('ickxi1', 'glyph'),
    '9': ('34rmua', 'glyph'), 'km': ('41lqrc', 'glyph'), 'kmh': ('jcz61i', 'glyph'),
    'schritte': ('n22nuu', 'glyph'), 'push': ('uptlkd', 'glyph'),
    'comma': ('67ux7o', 'comma'),
    'pushy-sit': ('x7xdpx', 'creature'), 'pushy-run': ('qh1pzc', 'creature'),
    'pushy-cheer': ('6rpglo', 'creature'), 'pushy-dizzy': ('btvwhz', 'creature'),
    'pushy-sad': ('ptcsww', 'creature'), 'pushy-sleep': ('ae3ulj', 'creature'),
    'pushy-wave': ('6clxwz', 'creature'),
    'shoe': ('l8i8fp', 'shape'), 'ring': ('olo529', 'shape'), 'flame': ('hg636a', 'shape'),
    'pill': ('qe6u8u', 'shape'), 'trophy': ('y984pv', 'shape'), 'heart': ('jzu7ns', 'shape'),
    'home': ('5eenvd', 'shape'), 'arrow': ('w7malc', 'shape'),
}

def close(mask, size):
    return mask.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.MinFilter(size))

def cut(path, kind):
    src = Image.open(path).convert('RGB')
    if kind == 'comma':  # the generated image is a semicolon: keep the lower part only
        src = src.crop((0, int(src.height * 0.42), src.width, src.height))
        kind = 'glyph'
    if src.width > 1400:
        src = src.resize((src.width // 2, src.height // 2), Image.LANCZOS)
    rgb = np.asarray(src).astype(np.float32) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip((green - 0.03) / 0.09, 0, 1)
    if kind in ('creature', 'shape'):
        # plain light background: everything that differs from the corner colour is the figure
        bg = np.median(np.concatenate([rgb[:40, :40].reshape(-1, 3), rgb[:40, -40:].reshape(-1, 3)]), axis=0)
        dist = np.abs(rgb - bg).max(-1)
        alpha = np.maximum(alpha, np.clip((dist - 0.07) / 0.10, 0, 1))
    a = Image.fromarray((alpha * 255).astype(np.uint8))
    solid = close(a.point(lambda v: 255 if v > 110 else 0), 9)
    if kind == 'creature':
        # everything enclosed by the outline belongs to the figure (white of the eyes, belly)
        fill = solid.copy()
        w, h = fill.size
        for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            ImageDraw.floodfill(fill, xy, 128)
        inside = fill.point(lambda v: 0 if v == 128 else 255)
        a = Image.fromarray(np.maximum(np.asarray(a), np.asarray(inside)))
    else:
        core = solid.filter(ImageFilter.MinFilter(7))
        a = Image.fromarray(np.maximum(np.asarray(a), np.asarray(core)))
    # drop specks: keep only what touches the solid shape
    near = solid.filter(ImageFilter.MaxFilter(21))
    a = Image.fromarray(np.minimum(np.asarray(a), np.asarray(near)))
    al = np.asarray(a).astype(np.float32) / 255
    edge = (al < 0.98)[..., None]
    out = rgb.copy()
    if kind == 'glyph':  # remove grey spill on soft fur edges
        out[..., 0] = np.where(edge[..., 0], np.minimum(r, g * 0.78), r)
        out[..., 2] = np.where(edge[..., 0], np.minimum(b, g * 0.35), b)
    img = Image.fromarray(np.dstack([out, al[..., None]]).__mul__(255).astype(np.uint8), 'RGBA')
    box = a.point(lambda v: 255 if v > 20 else 0).getbbox()
    return img.crop(box)

os.makedirs('marketing/fur-quellen/cut', exist_ok=True)
for name, (key, kind) in SRC.items():
    src = glob.glob(f'marketing/fur-quellen/Gemini_Generated_Image_{key}*.jpeg')
    if not src:
        print('missing', name); continue
    img = cut(src[0], kind)
    if name == 'pill':
        img = img.rotate(90, expand=True)
    target = 640 if kind == 'creature' else 512 if kind == 'shape' else (150 if kind == 'comma' else 360)
    scale = target / img.height
    img = img.resize((max(1, round(img.width * scale)), target), Image.LANCZOS)
    img.save(f'marketing/fur-quellen/cut/{name}.png', optimize=True)
    print(name, img.size, os.path.getsize(f'marketing/fur-quellen/cut/{name}.png') // 1024, 'KB')
