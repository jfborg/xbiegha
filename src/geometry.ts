export type Rect = { x: number; y: number; w: number; h: number };
export function layoutRects(count: number, width: number, height: number, padding: number, gap: number, layout: string): Rect[] {
  if (!count) return [];
  const p = Math.min(padding, width * .15, height * .15), w = width - 2 * p, h = height - 2 * p;
  if (count === 1) return [{ x: p, y: p, w, h }];
  const g = Math.min(gap, Math.min(w, h) / 8);
  if (layout === 'strips') { const cw = (w - g * (count - 1)) / count; return Array.from({ length: count }, (_, i) => ({ x: p + i * (cw + g), y: p, w: cw, h })); }
  if (layout === 'hero' && count > 2) { const bigW = (w - g) * .6, smallW = w - g - bigW, smallH = (h - g * (count - 2)) / (count - 1); return [{ x: p, y: p, w: bigW, h }, ...Array.from({ length: count - 1 }, (_, i) => ({ x: p + bigW + g, y: p + i * (smallH + g), w: smallW, h: smallH }))]; }
  const cols = count === 2 ? 2 : count <= 4 ? 2 : 3, rows = Math.ceil(count / cols), ch = (h - g * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => { const row = Math.floor(i / cols), inRow = Math.min(cols, count - row * cols), cw = (w - g * (inRow - 1)) / inRow; return { x: p + (i % cols) * (cw + g), y: p + row * (ch + g), w: cw, h: ch }; });
}
export function coverSize(iw: number, ih: number, rw: number, rh: number, zoom = 1) { const scale = Math.max(rw / iw, rh / ih) * zoom; return { width: iw * scale, height: ih * scale }; }
export function outputSize(mode: string, ratio: number, longest: number, pw = 35, ph = 45) { if (mode === 'passport') return { width: Math.round(pw / 25.4 * 300), height: Math.round(ph / 25.4 * 300) }; return ratio >= 1 ? { width: longest, height: Math.round(longest / ratio) } : { width: Math.round(longest * ratio), height: longest }; }
export function sheetPositions(photoWidth: number, photoHeight: number) { const pageWidth = 152.4, pageHeight = 101.6, gap = 4, margin = 3; const cols = Math.floor((pageWidth - margin * 2 + gap) / (photoWidth + gap)), rows = Math.floor((pageHeight - margin * 2 + gap) / (photoHeight + gap)); const startX = (pageWidth - (cols * photoWidth + (cols - 1) * gap)) / 2, startY = (pageHeight - (rows * photoHeight + (rows - 1) * gap)) / 2; return Array.from({ length: cols * rows }, (_, i) => ({ x: startX + (i % cols) * (photoWidth + gap), y: startY + Math.floor(i / cols) * (photoHeight + gap) })); }
