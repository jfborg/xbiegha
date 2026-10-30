import { createSlideRenderer } from './slideshowRender';
import { slideRatios } from './slideshow';
import type { Photo, Project } from './model';
import { imageFromSource, ratios } from './model';
import { coverSize, layoutRects, outputSize, sheetPositions } from './geometry';
import type { Rect } from './geometry';
import { documentSpec, passportDimensions } from './passport';
import { fileLimits, validateFileSize } from './compliance';
import { applyAdjustments } from './color';
export function projectRatio(p: Project) { if (p.mode === 'slideshow') return slideRatios.find(r => r.id === p.ratio)?.value || 16 / 9; if (p.mode === 'passport') { const d = passportDimensions(documentSpec(p.country),p.passport); return d.width/d.height; } if (p.ratio === 'original' && p.photos[0]) { const photo = p.photos[0]; return photo.rotation % 180 === 0 ? photo.width / photo.height : photo.height / photo.width; } return ratios.find(r => r.id === p.ratio)?.value || 1; }
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, photo: Photo, r: Rect, radius: number) { ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(radius, r.w / 2, r.h / 2)); ctx.clip(); const rotated = Math.abs(photo.rotation % 180) === 90; const iw = rotated ? image.naturalHeight : image.naturalWidth, ih = rotated ? image.naturalWidth : image.naturalHeight; const size = coverSize(iw, ih, r.w, r.h, photo.zoom); const maxX = Math.max(0, (size.width - r.w) / 2), maxY = Math.max(0, (size.height - r.h) / 2); ctx.translate(r.x + r.w / 2 + photo.x * maxX, r.y + r.h / 2 + photo.y * maxY); ctx.rotate(photo.rotation * Math.PI / 180); ctx.scale(photo.flip ? -1 : 1, 1); ctx.drawImage(image, -(rotated ? size.height : size.width) / 2, -(rotated ? size.width : size.height) / 2, rotated ? size.height : size.width, rotated ? size.width : size.height); ctx.restore(); }
export async function renderProject(canvas: HTMLCanvasElement, project: Project, longest = 900, original = false) { if (project.mode === 'slideshow') { const renderer = createSlideRenderer(project, longest); try { await renderer.draw(canvas, 0); } finally { renderer.dispose(); } return []; } const images = await Promise.all(project.photos.map(p => imageFromSource(p.src))); const ratio = projectRatio(project); const size = project.mode === 'passport' && longest > 1000 ? passportDimensions(documentSpec(project.country), project.passport) : outputSize('editor', ratio, longest); canvas.width = size.width; canvas.height = size.height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Your browser could not create an image canvas.'); ctx.fillStyle = project.background; ctx.fillRect(0, 0, size.width, size.height); const factor = size.width / 1000; const captionHeight = project.mode === 'collage' && project.caption ? size.height * .1 : 0; const rects = project.mode === 'collage' ? layoutRects(images.length, size.width, size.height - captionHeight, project.padding * factor, project.gap * factor, project.layout) : [{ x: 0, y: 0, w: size.width, h: size.height }]; images.forEach((image, i) => drawCover(ctx, image, project.photos[i], rects[i] || rects[0], project.mode === 'collage' ? project.radius * factor : 0));
  applyAdjustments(canvas, project.adjustments, project.mode, original);
  if (captionHeight) { ctx.fillStyle = project.background; ctx.fillRect(0, size.height - captionHeight, size.width, captionHeight); ctx.fillStyle = '#292d2a'; ctx.font = `${size.width * .026}px "DM Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(project.caption.slice(0, 80), size.width / 2, size.height - captionHeight / 2, size.width * .9); }
  return rects;
}
export function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
export async function canvasBlob(canvas: HTMLCanvasElement, format: string, quality = .94): Promise<Blob> { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed. Try a smaller export size.')), `image/${format}`, quality)); }
export async function withJpegDpi(blob: Blob, dpi = 300) { const bytes = new Uint8Array(await blob.arrayBuffer()); if (bytes[0] !== 255 || bytes[1] !== 216) return blob; if (bytes[2] === 255 && bytes[3] === 224 && bytes[6] === 74 && bytes[7] === 70 && bytes[8] === 73 && bytes[9] === 70) { bytes[13] = 1; bytes[14] = dpi >> 8; bytes[15] = dpi & 255; bytes[16] = dpi >> 8; bytes[17] = dpi & 255; return new Blob([bytes], { type: 'image/jpeg' }); } const header = new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0]); return new Blob([bytes.slice(0,2),header,bytes.slice(2)], { type: 'image/jpeg' }); }
export async function exportSheet(project: Project) { const { PDFDocument, rgb } = await import('pdf-lib'); const canvas = document.createElement('canvas'); await renderProject(canvas, project, 2400); const blob = await canvasBlob(canvas, 'jpeg', .98); const pdf = await PDFDocument.create(); pdf.setTitle(`${project.name} — Xbiegha passport photo sheet`); const mm = 72 / 25.4, page = pdf.addPage([152.4 * mm, 101.6 * mm]), preset = passportDimensions(documentSpec(project.country),project.passport), image = await pdf.embedJpg(await blob.arrayBuffer()); for (const pos of sheetPositions(preset.mmWidth, preset.mmHeight)) { page.drawImage(image, { x: pos.x * mm, y: (101.6 - pos.y - preset.mmHeight) * mm, width: preset.mmWidth * mm, height: preset.mmHeight * mm }); for (const [x, y, dx, dy] of [[pos.x,pos.y,-1,-1],[pos.x+preset.mmWidth,pos.y,1,-1],[pos.x,pos.y+preset.mmHeight,-1,1],[pos.x+preset.mmWidth,pos.y+preset.mmHeight,1,1]]) { page.drawLine({ start: { x: (x+dx*.3)*mm, y: (101.6-y)*mm }, end: {x:(x+dx*1.3)*mm,y:(101.6-y)*mm}, thickness:.2,color:rgb(.65,.65,.65)}); page.drawLine({start:{x:x*mm,y:(101.6-y-dy*.3)*mm},end:{x:x*mm,y:(101.6-y-dy*1.3)*mm},thickness:.2,color:rgb(.65,.65,.65)}); } } return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' }); }

// Both Download and Save to Photos use the same pixel, size and DPI validation.
export async function prepareImageExport(project: Project, format: string, longest: number): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  await renderProject(canvas, project, project.mode === 'passport' ? 2400 : longest);
  const type = project.mode === 'passport' ? 'jpeg' : format;
  let blob = await canvasBlob(canvas, type, project.mode === 'passport' ? .98 : .94);
  if (project.mode === 'passport') {
    const dimensions = passportDimensions(documentSpec(project.country), project.passport);
    const { max } = fileLimits(project);
    for (const quality of [.96,.94,.91,.88,.85]) {
      if (!max || blob.size <= max) break;
      blob = await canvasBlob(canvas, 'jpeg', quality);
    }
    blob = await withJpegDpi(blob, dimensions.dpi);
    const issue = validateFileSize(project, blob.size);
    if (issue) throw new Error(issue);
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) throw new Error('The generated dimensions do not match this route.');
  }
  return blob;
}
