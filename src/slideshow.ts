import type { Photo } from './model';

export type SlideTransition = 'fade' | 'slide' | 'dip' | 'cut';
export type SlideTheme = 'cinema' | 'postcard' | 'clean';
export type SlideshowSettings = {
  seconds: number; transition: SlideTransition; transitionSeconds: number;
  motion: boolean; fit: 'cover' | 'contain'; theme: SlideTheme;
  audio?: { src: string; name: string; duration: number };
  volume: number; audioStart: number; loopAudio: boolean;
};
export const MAX_SLIDES = 30;
export const slideshowDefaults: SlideshowSettings = {
  seconds: 3, transition: 'fade', transitionSeconds: .7, motion: true,
  fit: 'cover', theme: 'cinema', volume: .65, audioStart: 0, loopAudio: true,
};
export const slideRatios = [
  { id: '16:9', name: 'Widescreen', value: 16 / 9 },
  { id: '9:16', name: 'Story', value: 9 / 16 },
  { id: '1:1', name: 'Square', value: 1 },
  { id: '4:5', name: 'Portrait', value: .8 },
];
export function slideDuration(photo: Pick<Photo, 'duration'>, settings: SlideshowSettings) {
  return Math.max(1, Math.min(10, photo.duration ?? settings.seconds));
}
export function timeline(photos: Pick<Photo, 'duration'>[], settings: SlideshowSettings) {
  let at = 0;
  return photos.map((photo, index) => { const start = at, duration = slideDuration(photo, settings); at += duration; return { index, start, duration, end: at }; });
}
export function slideAt(photos: Pick<Photo, 'duration'>[], settings: SlideshowSettings, time: number) {
  const entries = timeline(photos, settings), total = entries.at(-1)?.end || 0;
  if (!entries.length) return { index: 0, progress: 0, blend: 1, total: 0 };
  const t = Math.max(0, Math.min(total, time));
  const entry = entries.find(e => t < e.end) || entries[entries.length - 1];
  const local = t - entry.start;
  const fade = Math.min(settings.transitionSeconds, entry.duration / 2);
  return { index: entry.index, progress: Math.min(1, local / entry.duration),
    blend: entry.index && settings.transition !== 'cut' && fade > 0 ? Math.min(1, local / fade) : 1, total };
}
export function slideSize(ratio: string, longest: number) {
  const r = slideRatios.find(x => x.id === ratio)?.value || 16 / 9;
  return { width: Math.round((r >= 1 ? longest : longest * r) / 2) * 2,
    height: Math.round((r >= 1 ? longest / r : longest) / 2) * 2 };
}
export function slideTime(seconds: number) { const n = Math.max(0, Math.round(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
export function musicPosition(time: number, settings: SlideshowSettings) {
  if (!settings.audio) return null;
  const start = Math.min(settings.audioStart, Math.max(0, settings.audio.duration - .1));
  const remaining = settings.audio.duration - start;
  if (remaining <= 0 || (!settings.loopAudio && time >= remaining)) return null;
  return start + (settings.loopAudio ? time % remaining : time);
}
export function musicGain(time: number, total: number, volume: number) {
  return Math.max(0, Math.min(1, time / .4, (total - time) / .8)) * volume;
}
export function readSlideshow(value: unknown): SlideshowSettings {
  if (!value) return { ...slideshowDefaults };
  if (typeof value !== 'object') throw new Error('Invalid slideshow settings.');
  const s = { ...slideshowDefaults, ...value } as SlideshowSettings;
  if (!['fade','slide','dip','cut'].includes(s.transition) || !['cinema','postcard','clean'].includes(s.theme)
    || !['cover','contain'].includes(s.fit) || typeof s.motion !== 'boolean' || typeof s.loopAudio !== 'boolean') throw new Error('Invalid slideshow style.');
  for (const [key, min, max] of [['seconds',1,10],['transitionSeconds',0,1.5],['volume',0,1],['audioStart',0,600]] as const)
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max) throw new Error('Invalid slideshow timing or sound.');
  if (s.audio && (typeof s.audio.src !== 'string' || !/^data:audio\/(mpeg|mp3|mp4|x-m4a|wav|x-wav|wave|webm|ogg|aac);base64,/.test(s.audio.src)
    || s.audio.src.length > 28 * 1024 * 1024 || typeof s.audio.name !== 'string' || s.audio.name.length > 200
    || !Number.isFinite(s.audio.duration) || s.audio.duration <= 0 || s.audio.duration > 600)) throw new Error('Invalid soundtrack in this backup.');
  return s;
}
