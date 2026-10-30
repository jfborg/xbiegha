import type { SlideshowSettings } from './slideshow';
import type { PassportSettings } from './passport';
export type Mode = 'collage' | 'passport' | 'editor' | 'slideshow';
export type Photo = { id: string; src: string; name: string; width: number; height: number; x: number; y: number; zoom: number; rotation: number; flip: boolean; duration?: number; caption?: string };
export type Adjustments = { exposure: number; contrast: number; saturation: number; warmth: number; fade: number; vignette: number; tint: number; grain: number };
export type Project = { id: string; name: string; mode: Mode; photos: Photo[]; ratio: string; layout: string; gap: number; padding: number; radius: number; background: string; caption: string; country: string; passport?: PassportSettings; slideshow?: SlideshowSettings; adjustments: Adjustments; look?: { id: string; amount: number }; updated: number; thumbnail?: string };
export const defaultAdjustments: Adjustments = { exposure: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, vignette: 0, tint: 0, grain: 0 };
export const modes: Record<Mode, { title: string; short: string; description: string }> = {
  collage: { title: 'Make a collage', short: 'Collage', description: 'Your favourite moments, together.' },
  passport: { title: 'Passport photos', short: 'Passport photo', description: 'A small photo. Ready for big plans.' },
  editor: { title: 'Edit a photo', short: 'Photo editor', description: 'A little adjustment. A whole new feeling.' },
  slideshow: { title: 'Make a slideshow', short: 'Slideshow', description: 'Little moments. A lovely movie.' },
};
export { countries } from './passport.ts';
export const ratios = [{ id: '1:1', name: 'Square', value: 1 }, { id: '4:5', name: 'Portrait', value: .8 }, { id: '3:2', name: 'Landscape', value: 1.5 }, { id: '9:16', name: 'Story', value: 9 / 16 }, { id: 'original', name: 'Original', value: 0 }];
export const samplePaths = ['/samples/coast.jpg', '/samples/village.jpg', '/samples/lake.jpg', '/samples/mountain.jpg'];
export function createProject(mode: Mode): Project { return { id: crypto.randomUUID(), name: mode === 'slideshow' ? 'Untitled slideshow' : mode === 'collage' ? 'Untitled collage' : mode === 'passport' ? 'My passport photo' : 'Untitled edit', mode, photos: [], ratio: mode === 'slideshow' ? '16:9' : mode === 'editor' ? 'original' : '1:1', layout: 'grid', gap: 12, padding: 24, radius: 0, background: '#fffdf7', caption: '', country: 'ae-passport', adjustments: { ...defaultAdjustments }, updated: Date.now() }; }
export async function loadPhoto(src: string, name: string): Promise<Photo> { const image = await imageFromSource(src); return { id: crypto.randomUUID(), src, name, width: image.naturalWidth, height: image.naturalHeight, x: 0, y: 0, zoom: 1, rotation: 0, flip: false }; }
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function imageFromSource(src: string): Promise<HTMLImageElement> { const existing = imageCache.get(src); if (existing) return existing; const promise = new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { imageCache.delete(src); reject(new Error('This image could not be opened. Try a JPEG, PNG, or WebP file.')); }; image.src = src; }); imageCache.set(src, promise); if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value!); return promise; }
export async function readPhoto(file: File): Promise<Photo> { if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Please use JPEG, PNG, WebP, or AVIF. For HEIC photos, export a JPEG from Photos first.'); if (file.size > 35 * 1024 * 1024) throw new Error(`${file.name} is larger than 35 MB. Please choose a smaller image.`); const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(file); }); const photo = await loadPhoto(source, file.name); if (photo.width * photo.height > 50000000) throw new Error(`${file.name} is larger than 50 megapixels. Please resize it first.`); return photo; }

// Keep slideshow projects practical on mobile: retain a video-ready copy, not 30 full-size camera originals.
export async function readSlidePhoto(file: File): Promise<Photo> {
  const photo = await readPhoto(file), scale = Math.min(1, 2560 / Math.max(photo.width, photo.height));
  if (scale === 1) return photo;
  const canvas = document.createElement('canvas'); canvas.width = Math.round(photo.width * scale); canvas.height = Math.round(photo.height * scale);
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(await imageFromSource(photo.src), 0, 0, canvas.width, canvas.height);
  imageCache.delete(photo.src);
  const result = { ...photo, src: canvas.toDataURL('image/jpeg', .92), width: canvas.width, height: canvas.height };
  canvas.width = 1; canvas.height = 1; return result;
}
