/* Finishes the cut fur PNGs (marketing/fur-quellen/cut) into small WebP files in assets/fur:
 * matches the colour of the shapes to the digits, pulls the light rim of the cut-out inwards and
 * scales every image to its app size. Needs sharp, which is not an app dependency:
 *   npm i --no-save sharp && node scripts/finish-fur-assets.js */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = 'marketing/fur-quellen/cut';
const OUT = 'assets/fur';
const GLYPHS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'comma', 'km', 'kmh', 'schritte', 'push'];
const CREATURES = ['pushy-sit', 'pushy-run', 'pushy-cheer', 'pushy-dizzy', 'pushy-sad', 'pushy-sleep', 'pushy-wave'];
const HEIGHT = { glyph: 256, creature: 384, shape: 256, pill: 160 };
const SMALL = { flame: 192, heart: 128, trophy: 128, home: 96, shoe: 96, arrow: 128 };

function kindOf(name) {
  if (name === 'pill') return 'pill';
  if (CREATURES.includes(name)) return 'creature';
  return GLYPHS.includes(name) ? 'glyph' : 'shape';
}

function toHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h * 60, max === 0 ? 0 : d / max, max / 255];
}

function fromHsv(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(((h % 360) + 360) % 360 / 60) % 6];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function meanHsv(data) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let s = 0;
  let v = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const [h, sat, val] = toHsv(data[i], data[i + 1], data[i + 2]);
    sx += Math.cos((h * Math.PI) / 180);
    sy += Math.sin((h * Math.PI) / 180);
    s += sat;
    v += val;
    n++;
  }
  return { h: (Math.atan2(sy, sx) * 180) / Math.PI, s: s / n, v: v / n };
}

/** Erodes the alpha by one pixel and repaints the soft rim with the colour of the fur inside. */
function defringe(data, w, h) {
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          min = Math.min(min, data[(yy * w + xx) * 4 + 3]);
        }
      }
      alpha[y * w + x] = min;
    }
  }
  const out = Buffer.from(data);
  const R = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[i + 3] = alpha[y * w + x];
      if (alpha[y * w + x] >= 250 || alpha[y * w + x] === 0) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = (yy * w + xx) * 4;
          if (alpha[yy * w + xx] < 250) continue;
          r += data[j];
          g += data[j + 1];
          b += data[j + 2];
          n++;
        }
      }
      if (n > 0) {
        out[i] = r / n;
        out[i + 1] = g / n;
        out[i + 2] = b / n;
      }
    }
  }
  return out;
}

/**
 * Removes the cut-out background: starting at the transparent outside, every grey, white or
 * half-transparent pixel that touches it becomes transparent (floor shadows, white haze, bars
 * between letters). Pixels inside the fur, such as the eyes, are not reached and stay.
 */
function dropBackground(data, w, h, creature) {
  const grey = (i) => {
    const [, sat, val] = toHsv(data[i], data[i + 1], data[i + 2]);
    return data[i + 3] < 250 || (creature ? sat < 0.18 && val > 0.55 : sat < 0.3 && val > 0.2);
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 12) {
      seen[p] = 1;
      stack.push(p);
    }
  }
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (!seen[y * w + x]) { seen[y * w + x] = 1; stack.push(y * w + x); }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (!seen[y * w + x]) { seen[y * w + x] = 1; stack.push(y * w + x); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || seen[yy * w + xx]) continue;
      const i = (yy * w + xx) * 4;
      if (!grey(i)) continue;
      seen[yy * w + xx] = 1;
      data[i + 3] = 0;
      stack.push(yy * w + xx);
    }
  }
  for (let p = 0; p < w * h; p++) if (seen[p]) data[p * 4 + 3] = 0;
}

async function load(name, height) {
  const input = sharp(path.join(SRC, `${name}.png`)).ensureAlpha();
  const meta = await input.metadata();
  const h = height;
  const w = Math.round((meta.width * h) / meta.height);
  const { data } = await input.resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return { data, w, h };
}

async function save(name, data, w, h) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(path.join(OUT, `${name}.webp`));
  console.log(name, `${w}x${h}`, `${Math.round(fs.statSync(path.join(OUT, `${name}.webp`)).size / 1024)} KB`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const names = fs.readdirSync(SRC).map((f) => f.replace('.png', ''));
  const loaded = {};
  for (const name of names) {
    const kind = kindOf(name);
    const height = SMALL[name] ?? HEIGHT[kind];
    const img = await load(name, height);
    dropBackground(img.data, img.w, img.h, kind === 'creature');
    img.data = defringe(img.data, img.w, img.h);
    img.data = defringe(img.data, img.w, img.h);
    loaded[name] = img;
  }
  const target = meanHsv(Buffer.concat(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => loaded[n].data)));
  for (const name of names) {
    const kind = kindOf(name);
    const img = loaded[name];
    if (kind === 'shape' || kind === 'pill') {
      const m = meanHsv(img.data);
      const dh = target.h - m.h;
      const ks = Math.min(2, target.s / m.s);
      const kv = Math.min(1.2, target.v / m.v);
      for (let i = 0; i < img.data.length; i += 4) {
        const [h, s, v] = toHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
        const [r, g, b] = fromHsv(h + dh, Math.min(1, s * ks), Math.min(1, v * kv));
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
      }
    }
    await save(name, img.data, img.w, img.h);
  }
}

main();
