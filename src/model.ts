import type { PassportSettings } from './passport';
export type Mode = 'collage' | 'passport' | 'editor';
export type Photo = { id: string; src: string; name: string; width: number; height: number; x: number; y: number; zoom: number; rotation: number; flip: boolean };
export type Adjustments = { exposure: number; contrast: number; saturation: number; warmth: number; fade: number; vignette: number };
export type Project = { id: string; name: string; mode: Mode; photos: Photo[]; ratio: string; layout: string; gap: number; padding: number; radius: number; background: string; caption: string; country: string; passport?: PassportSettings; adjustments: Adjustments; updated: number; thumbnail?: string };
export const defaultAdjustments: Adjustments = { exposure: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, vignette: 0 };
export const modes: Record<Mode, { title: string; short: string; description: string }> = {
  collage: { title: 'Make a collage', short: 'Collage', description: 'Your favourite moments, together.' },
  passport: { title: 'Passport photos', short: 'Passport photo', description: 'A small photo. Ready for big plans.' },
  editor: { title: 'Edit a photo', short: 'Photo editor', description: 'A little adjustment. A whole new feeling.' },
};
export const presets = [
  { id: 'original', name: 'Original', values: { ...defaultAdjustments } },
  { id: 'mediterranean', name: 'Golden', values: { exposure: 6, contrast: 8, saturation: 12, warmth: 18, fade: 2, vignette: 0 } },
  { id: 'film', name: 'Film', values: { exposure: 2, contrast: -8, saturation: -18, warmth: 10, fade: 14, vignette: 12 } },
  { id: 'mono', name: 'Mono', values: { exposure: 0, contrast: 18, saturation: -100, warmth: 0, fade: 0, vignette: 8 } },
  { id: 'soft', name: 'Soft', values: { exposure: 10, contrast: -12, saturation: -8, warmth: 3, fade: 6, vignette: 0 } },
  { id: 'crisp', name: 'Crisp', values: { exposure: 2, contrast: 20, saturation: 8, warmth: -6, fade: 0, vignette: 0 } },
];
export { countries } from './passport';
export const ratios = [{ id: '1:1', name: 'Square', value: 1 }, { id: '4:5', name: 'Portrait', value: .8 }, { id: '3:2', name: 'Landscape', value: 1.5 }, { id: '9:16', name: 'Story', value: 9 / 16 }, { id: 'original', name: 'Original', value: 0 }];
export const samplePaths = ['/samples/coast.jpg', '/samples/village.jpg', '/samples/lake.jpg', '/samples/mountain.jpg'];
export function createProject(mode: Mode): Project { return { id: crypto.randomUUID(), name: mode === 'collage' ? 'Untitled collage' : mode === 'passport' ? 'My passport photo' : 'Untitled edit', mode, photos: [], ratio: mode === 'editor' ? 'original' : '1:1', layout: 'grid', gap: 12, padding: 24, radius: 0, background: '#fffdf7', caption: '', country: 'ae-passport', adjustments: { ...defaultAdjustments }, updated: Date.now() }; }
export async function loadPhoto(src: string, name: string): Promise<Photo> { const image = await imageFromSource(src); return { id: crypto.randomUUID(), src, name, width: image.naturalWidth, height: image.naturalHeight, x: 0, y: 0, zoom: 1, rotation: 0, flip: false }; }
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function imageFromSource(src: string): Promise<HTMLImageElement> { const existing = imageCache.get(src); if (existing) return existing; const promise = new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { imageCache.delete(src); reject(new Error('This image could not be opened. Try a JPEG, PNG, or WebP file.')); }; image.src = src; }); imageCache.set(src, promise); if (imageCache.size > 40) imageCache.delete(imageCache.keys().next().value!); return promise; }
export async function readPhoto(file: File): Promise<Photo> { if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Please use JPEG, PNG, WebP, or AVIF. For HEIC photos, export a JPEG from Photos first.'); if (file.size > 35 * 1024 * 1024) throw new Error(`${file.name} is larger than 35 MB. Please choose a smaller image.`); const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(file); }); const photo = await loadPhoto(source, file.name); if (photo.width * photo.height > 50000000) throw new Error(`${file.name} is larger than 50 megapixels. Please resize it first.`); return photo; }
