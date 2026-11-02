export type Transition = 'cut' | 'dissolve' | 'black' | 'slide' | 'wipe';
export type VideoClip = { id: string; assetId: string; name: string; in: number; out: number; transition: Transition; transitionSeconds: number; volume: number };
export type VideoAsset = { id: string; file: File; url: string; name: string; duration: number; offset: number; width: number; height: number; thumbnail: string; audio: boolean };
export type VideoEdit = { name: string; clips: VideoClip[]; ratio: string; fit: 'contain' | 'cover' };
export const MAX_CLIPS = 40, MAX_MOVIE = 600, MIN_CLIP = .1;
export const transitions: { id: Transition; name: string; description: string }[] = [
  { id: 'cut', name: 'Straight cut', description: 'One moment, then the next.' },
  { id: 'dissolve', name: 'Cross dissolve', description: 'Gently blend two moments.' },
  { id: 'black', name: 'Fade through black', description: 'A little pause between scenes.' },
  { id: 'slide', name: 'Slide left', description: 'Move the story along.' },
  { id: 'wipe', name: 'Wipe right', description: 'Reveal the next scene.' },
];
export function clipLength(c: VideoClip) { return c.out - c.in; }
export function videoTimeline(clips: VideoClip[]) {
  let start = 0;
  return clips.map((clip, i) => {
    const duration = clipLength(clip);
    const overlap = clip.transition === 'cut' || !clips[i + 1] ? 0 : Math.min(clip.transitionSeconds, duration / 2, clipLength(clips[i + 1]) / 2);
    const entry = { clip, index: i, start, end: start + duration, duration, overlap };
    start = entry.end - overlap;
    return entry;
  });
}
export type VideoEntry = ReturnType<typeof videoTimeline>[number];
export function movieDuration(clips: VideoClip[]) { return videoTimeline(clips).at(-1)?.end || 0; }
export function activeEntries(entries: VideoEntry[], time: number) {
  const t = Math.max(0, Math.min(time, (entries.at(-1)?.end || 0) - .000001));
  return entries.filter(e => t >= e.start && t < e.end);
}
export function clipGain(entry: VideoEntry, entries: VideoEntry[], time: number) {
  let gain = entry.clip.volume;
  const prev = entries[entry.index - 1];
  if (prev?.overlap && time < prev.end) {
    const p = Math.max(0, Math.min(1, (time - entry.start) / prev.overlap));
    gain *= prev.clip.transition === 'black' ? Math.max(0, 2 * p - 1) : p;
  }
  if (entry.overlap && time > entry.end - entry.overlap) {
    const p = Math.max(0, Math.min(1, (time - (entry.end - entry.overlap)) / entry.overlap));
    gain *= entry.clip.transition === 'black' ? Math.max(0, 1 - 2 * p) : 1 - p;
  }
  return gain;
}
export function splitClip(clips: VideoClip[], id: string, sourceTime: number, nextId: string): VideoClip[] {
  const clip = clips.find(c => c.id === id);
  if (!clip || clips.length >= MAX_CLIPS || sourceTime - clip.in < MIN_CLIP - 1e-8 || clip.out - sourceTime < MIN_CLIP - 1e-8) return clips;
  return clips.flatMap(c => c.id === id ? [{ ...c, out: sourceTime, transition: 'cut' as const }, { ...c, id: nextId, in: sourceTime }] : [c]);
}
export function videoSize(ratio: string, longest: number, asset?: Pick<VideoAsset, 'width' | 'height'>) {
  const r = ratio === 'original' && asset ? asset.width / asset.height : ratio === '9:16' ? 9 / 16 : ratio === '1:1' ? 1 : 16 / 9;
  return { width: Math.max(2, Math.round((r >= 1 ? longest : longest * r) / 2) * 2), height: Math.max(2, Math.round((r >= 1 ? longest / r : longest) / 2) * 2) };
}
export function videoTime(t: number) {
  const s = Math.max(0, t); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}
