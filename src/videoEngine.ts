import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { InputAudioTrack, InputVideoTrack, WrappedAudioBuffer, WrappedCanvas } from 'mediabunny';
import { activeEntries, clipGain, MAX_MOVIE, movieDuration, videoSize, videoTimeline } from './videoModel';
import type { VideoAsset, VideoEdit, VideoEntry } from './videoModel';

export async function readVideo(file: File): Promise<VideoAsset> {
  if (!file.size || file.size > 500 * 1024 * 1024) throw new Error('Choose a video smaller than 500 MB.');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video || !await video.canDecode()) throw new Error('This video’s picture format is not supported by this browser. Try an H.264 MP4, or open Xbieha in a current Chrome or Safari browser.');
    const [offset, end, width, height, audio] = await Promise.all([video.getFirstTimestamp(), video.computeDuration(), video.getDisplayWidth(), video.getDisplayHeight(), input.getPrimaryAudioTrack()]);
    if (!Number.isFinite(end) || end - offset < .1 || end - offset > 3600) throw new Error('Choose a video between 0.1 seconds and 60 minutes long.');
    if (audio && !await audio.canDecode()) throw new Error('This browser cannot decode the audio in this video. Convert it to an MP4 with AAC audio first.');
    const thumb = await new CanvasSink(video, { width: 320 }).getCanvas(offset);
    if (!thumb) throw new Error('The first video frame could not be read.');
    const canvas = document.createElement('canvas'); canvas.width = thumb.canvas.width; canvas.height = thumb.canvas.height;
    canvas.getContext('2d')!.drawImage(thumb.canvas, 0, 0);
    return { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name, duration: end - offset, offset, width, height, thumbnail: canvas.toDataURL('image/jpeg', .75), audio: !!audio };
  } finally { input.dispose(); }
}

export async function videoThumbnail(asset: VideoAsset, time: number) {
  if (time === 0) return asset.thumbnail;
  const input = new Input({ source: new BlobSource(asset.file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack(); if (!track) return asset.thumbnail;
    const frame = await new CanvasSink(track, { width: 240 }).getCanvas(asset.offset + time);
    if (!frame) return asset.thumbnail;
    const canvas = document.createElement('canvas'); canvas.width = frame.canvas.width; canvas.height = frame.canvas.height;
    canvas.getContext('2d')!.drawImage(frame.canvas, 0, 0); return canvas.toDataURL('image/jpeg', .75);
  } finally { input.dispose(); }
}

type Reader<T> = { iterator: AsyncGenerator<T, void, unknown>; current?: T; next?: T; ended: boolean; last: number };
async function advance<T extends { timestamp: number }>(reader: Reader<T>, timestamp: number) {
  if (!reader.current && !reader.ended) { const n = await reader.iterator.next(); reader.current = n.value || undefined; reader.ended = !!n.done; }
  while (!reader.ended && (!reader.next || reader.next.timestamp <= timestamp + 1e-7)) {
    if (reader.next) reader.current = reader.next;
    const n = await reader.iterator.next(); reader.next = n.value || undefined; reader.ended = !!n.done;
  }
  reader.last = timestamp;
  return reader.current;
}
export class VideoEngine {
  readonly entries: VideoEntry[];
  readonly total: number;
  readonly size: { width: number; height: number };
  private inputs = new Map<string, { input: Input; video: InputVideoTrack; audio: InputAudioTrack | null }>();
  private loading = new Map<string, Promise<{ input: Input; video: InputVideoTrack; audio: InputAudioTrack | null }>>();
  private frames = new Map<string, Reader<WrappedCanvas>>();
  private sound = new Map<string, Reader<WrappedAudioBuffer>>();
  private disposed = false;
  constructor(readonly edit: VideoEdit, readonly assets: VideoAsset[], longest: number) {
    this.entries = videoTimeline(edit.clips); this.total = movieDuration(edit.clips);
    this.size = videoSize(edit.ratio, longest, assets.find(a => a.id === edit.clips[0]?.assetId));
  }
  private async tracks(asset: VideoAsset) {
    if (this.disposed) throw new DOMException('Stopped', 'AbortError');
    const cached = this.inputs.get(asset.id); if (cached) return cached;
    const pending = this.loading.get(asset.id); if (pending) return pending;
    const task = (async () => {
    const input = new Input({ source: new BlobSource(asset.file), formats: ALL_FORMATS });
    try {
      const video = await input.getPrimaryVideoTrack(), audio = await input.getPrimaryAudioTrack();
      if (!video || this.disposed) throw new Error('Video is no longer available.');
      const entry = { input, video, audio }; this.inputs.set(asset.id, entry); return entry;
    } catch (e) { input.dispose(); throw e; }
    })();
    this.loading.set(asset.id, task);
    try { return await task; } finally { this.loading.delete(asset.id); }
  }
  async draw(canvas: HTMLCanvasElement, time: number) {
    if (this.disposed) return;
    const active = activeEntries(this.entries, time), images: (HTMLCanvasElement | OffscreenCanvas)[] = [];
    for (const entry of active) {
      const asset = this.assets.find(a => a.id === entry.clip.assetId)!;
      const timestamp = asset.offset + entry.clip.in + Math.min(entry.duration - .00001, Math.max(0, time - entry.start));
      let reader = this.frames.get(entry.clip.id);
      if (reader && (timestamp < reader.last - .00001 || timestamp - reader.last > 1)) { await reader.iterator.return(); this.frames.delete(entry.clip.id); reader = undefined; }
      if (!reader) {
        const { video } = await this.tracks(asset);
        const sink = new CanvasSink(video, { ...this.size, fit: this.edit.fit, poolSize: 3 });
        reader = { iterator: sink.canvases(timestamp), ended: false, last: timestamp }; this.frames.set(entry.clip.id, reader);
      }
      const frame = await advance(reader, timestamp);
      if (!frame) throw new Error('Could not decode a video frame. Try another video format.');
      images.push(frame.canvas);
    }
    for (const [id, reader] of this.frames) if (!active.some(e => e.clip.id === id)) { await reader.iterator.return(); this.frames.delete(id); }
    if (this.disposed) return;
    if (canvas.width !== this.size.width) canvas.width = this.size.width;
    if (canvas.height !== this.size.height) canvas.height = this.size.height;
    const ctx = canvas.getContext('2d')!, { width: w, height: h } = this.size;
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (images.length === 1) ctx.drawImage(images[0], 0, 0, w, h);
    else if (images.length === 2) {
      const prev = active[0], p = Math.max(0, Math.min(1, (time - active[1].start) / prev.overlap));
      ctx.save();
      if (prev.clip.transition === 'black') { ctx.globalAlpha = p < .5 ? 1 - 2 * p : 2 * p - 1; ctx.drawImage(images[p < .5 ? 0 : 1], 0, 0, w, h); }
      else if (prev.clip.transition === 'slide') { ctx.drawImage(images[0], -p * w, 0, w, h); ctx.drawImage(images[1], (1 - p) * w, 0, w, h); }
      else { ctx.drawImage(images[0], 0, 0, w, h); if (prev.clip.transition === 'wipe') { ctx.beginPath(); ctx.rect(0, 0, w * p, h); ctx.clip(); } else ctx.globalAlpha = p; ctx.drawImage(images[1], 0, 0, w, h); }
      ctx.restore();
    }
  }
  async audioChunk(time: number, duration: number): Promise<AudioBuffer> {
    const rate = 48000, length = Math.max(1, Math.round(duration * rate));
    const result = new AudioBuffer({ numberOfChannels: 2, length, sampleRate: rate });
    for (const entry of this.entries) {
      if (entry.end <= time || entry.start >= time + duration || !entry.clip.volume) continue;
      const asset = this.assets.find(a => a.id === entry.clip.assetId)!;
      if (!asset.audio) continue;
      const sourceStart = asset.offset + entry.clip.in + Math.max(time - entry.start, 0);
      const sourceEnd = asset.offset + entry.clip.in + Math.min(time + duration - entry.start, entry.duration);
      let reader = this.sound.get(entry.clip.id);
      if (reader && sourceStart < reader.last - .00001) { await reader.iterator.return(); this.sound.delete(entry.clip.id); reader = undefined; }
      if (!reader) {
        const { audio } = await this.tracks(asset); if (!audio) continue;
        reader = { iterator: new AudioBufferSink(audio).buffers(sourceStart), ended: false, last: sourceStart }; this.sound.set(entry.clip.id, reader);
      }
      let buffer = await advance(reader, sourceStart);
      while (buffer && buffer.timestamp < sourceEnd) {
        const from = Math.max(sourceStart, buffer.timestamp), to = Math.min(sourceEnd, buffer.timestamp + buffer.duration);
        const outputStart = entry.start + from - asset.offset - entry.clip.in;
        const outputEnd = entry.start + to - asset.offset - entry.clip.in;
        const first = Math.max(0, Math.ceil((outputStart - time) * rate - .00001)), last = Math.min(length, Math.ceil((outputEnd - time) * rate - .00001));
        for (let c = 0; c < 2; c++) {
          const dest = result.getChannelData(c), src = buffer.buffer.getChannelData(Math.min(c, buffer.buffer.numberOfChannels - 1));
          for (let i = first; i < last; i++) {
            const global = time + i / rate, source = asset.offset + entry.clip.in + global - entry.start;
            const pos = Math.max(0, (source - buffer.timestamp) * buffer.buffer.sampleRate), a = Math.min(src.length - 1, Math.floor(pos)), b = Math.min(src.length - 1, a + 1);
            dest[i] += (src[a] + (src[b] - src[a]) * (pos - a)) * clipGain(entry, this.entries, global);
          }
        }
        if (buffer.timestamp + buffer.duration >= sourceEnd - 1e-7 || reader.ended && !reader.next) break;
        const nextTime = reader.next?.timestamp ?? buffer.timestamp + buffer.duration + 1e-6;
        const previous = buffer; buffer = await advance(reader, nextTime);
        if (buffer === previous) break;
      }
      reader.last = sourceEnd;
    }
    for (const [id, reader] of this.sound) if ((this.entries.find(e => e.clip.id === id)?.end || 0) <= time + duration) { await reader.iterator.return(); this.sound.delete(id); }
    return result;
  }
  async dispose() {
    this.disposed = true;
    await Promise.all([...this.frames.values(), ...this.sound.values()].map(r => r.iterator.return().catch(() => {})));
    this.frames.clear(); this.sound.clear(); this.inputs.forEach(x => x.input.dispose()); this.inputs.clear();
  }
}
export async function videoFormats(edit: VideoEdit, assets: VideoAsset[], longest: number, includeAudio: boolean) {
  const size = videoSize(edit.ratio, longest, assets.find(a => a.id === edit.clips[0]?.assetId));
  const opts = { ...size, frameRate: 30, quality: new Quality({ bitrate: longest > 1280 ? 8e6 : 4e6 }) };
  const [avc, vp8, aac, opus] = await Promise.all([canEncodeVideo('avc', opts), canEncodeVideo('vp8', opts), includeAudio ? canEncodeAudio('aac', { sampleRate: 48000, numberOfChannels: 2 }) : true, includeAudio ? canEncodeAudio('opus', { sampleRate: 48000, numberOfChannels: 2 }) : true]);
  return { mp4: avc && aac, webm: vp8 && opus };
}
export async function exportVideoEdit(edit: VideoEdit, assets: VideoAsset[], longest: number, format: 'mp4' | 'webm', includeAudio: boolean, signal: AbortSignal, progress: (n: number) => void) {
  const total = movieDuration(edit.clips);
  if (!total || total > MAX_MOVIE) throw new Error('Keep your finished movie under 10 minutes. Trim or remove clips, then export again.');
  const hasAudio = includeAudio && edit.clips.some(c => c.volume > 0 && assets.find(a => a.id === c.assetId)?.audio);
  if (!(await videoFormats(edit, assets, longest, hasAudio))[format]) throw new Error(`This browser cannot export ${format.toUpperCase()} with these settings. Try WebM, 720p, or another current browser.`);
  const engine = new VideoEngine(edit, assets, longest), canvas = document.createElement('canvas');
  canvas.width = engine.size.width; canvas.height = engine.size.height;
  const target = new BufferTarget(), output = new Output({ target, format: format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat() });
  const video = new CanvasSource(canvas, { codec: format === 'mp4' ? 'avc' : 'vp8', quality: new Quality({ bitrate: longest > 1280 ? 8e6 : 4e6 }), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: 30 });
  const audio = hasAudio ? new AudioBufferSource({ codec: format === 'mp4' ? 'aac' : 'opus', quality: new Quality({ bitrate: 128000 }) }) : null;
  if (audio) output.addAudioTrack(audio);
  try {
    signal.throwIfAborted(); await output.start();
    const frames = Math.ceil(total * 30);
    for (let frame = 0; frame < frames; frame++) {
      signal.throwIfAborted(); const t = frame / 30;
      await engine.draw(canvas, t); signal.throwIfAborted(); await video.add(t, Math.min(1 / 30, total - t));
      if (audio && frame % 15 === 0) await audio.add(await engine.audioChunk(t, Math.min(.5, total - t)));
      if (frame % 5 === 0) { progress(frame / frames * .97); await new Promise<void>(r => setTimeout(r, 0)); }
    }
    video.close(); audio?.close(); signal.throwIfAborted(); await output.finalize(); signal.throwIfAborted();
    if (!target.buffer) throw new Error('Could not finish the video. Try a shorter movie or 720p.');
    progress(1); return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
  } catch (error) { await output.cancel().catch(() => {}); throw error; }
  finally { await engine.dispose(); canvas.width = 1; canvas.height = 1; }
}
