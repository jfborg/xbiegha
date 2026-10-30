import type { Adjustments } from './model';

// Shared by previews, the working canvas, downloads and the Photos image.
export function adjustPixels(data: Uint8ClampedArray, width: number, height: number, a: Adjustments) {
  const exposure = Math.pow(2, a.exposure / 70), contrast = (100 + a.contrast) / 100;
  const saturation = (100 + a.saturation) / 100, fade = a.fade / 100;
  const tint = a.tint || 0, grain = a.grain || 0;
  const grainScale = 1000 / Math.max(width, height);
  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] * exposure - 128) * contrast + 128 + a.warmth * .55;
    let g = (data[i + 1] * exposure - 128) * contrast + 128 + a.warmth * .1;
    let b = (data[i + 2] * exposure - 128) * contrast + 128 - a.warmth * .55;
    const luma = r * .2126 + g * .7152 + b * .0722;
    r = luma + (r - luma) * saturation + tint * .35;
    g = luma + (g - luma) * saturation - tint * .3;
    b = luma + (b - luma) * saturation + tint * .25;
    let noise = 0;
    if (grain) {
      const p = i / 4;
      // Stable grain: reopening, comparing and exporting never randomise it.
      const x = Math.floor((p % width) * grainScale), y = Math.floor(Math.floor(p / width) * grainScale);
      let hash = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      noise = (((hash ^ (hash >>> 16)) >>> 0) / 4294967295 - .5) * grain * .65;
    }
    data[i] = r * (1 - fade) + 128 * fade + noise;
    data[i + 1] = g * (1 - fade) + 128 * fade + noise;
    data[i + 2] = b * (1 - fade) + 128 * fade + noise;
  }
}

export function applyAdjustments(canvas: HTMLCanvasElement, adjustments: Adjustments, mode: string, original = false) {
  if (original || mode === 'passport' || !Object.values(adjustments).some(Boolean)) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Your browser could not prepare the photo look.');
  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  adjustPixels(pixels.data, width, height, adjustments);
  ctx.putImageData(pixels, 0, 0);
  if (adjustments.vignette) {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, width * .2, width / 2, height / 2, Math.max(width, height) * .7);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 100})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}
