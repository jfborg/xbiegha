import { fileName } from './fileName.ts';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, Copy, Film, GripVertical, LockKeyhole, Pause, Play, Plus, Redo2, Save, Scissors, Trash2, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import { activeEntries, clipLength, MAX_CLIPS, MAX_MOVIE, MIN_CLIP, movieDuration, splitClip, transitions, videoSize, videoTime, videoTimeline } from './videoModel';
import type { VideoAsset, VideoClip, VideoEdit } from './videoModel';
import { exportVideoEdit, readVideo, VideoEngine, videoFormats, videoThumbnail } from './videoEngine';
import { loadVideoDraft, saveVideoDraft } from './videoStorage';
import { downloadBlob } from './render';
import { saveVideoFile } from './videoSave';
import type { VideoSaveHost } from './videoSave';
import './video.css';

const blank = (): VideoEdit => ({ name: 'My next story', clips: [], ratio: 'original', fit: 'contain' });
type Props = { active: boolean; onBack: () => void; notify: (message: string) => void };
export default function VideoStudio({ active, onBack, notify }: Props) {
  const [edit, setEdit] = useState<VideoEdit>(blank), [assets, setAssets] = useState<VideoAsset[]>([]);
  const [past, setPast] = useState<VideoEdit[]>([]), [future, setFuture] = useState<VideoEdit[]>([]);
  const [selected, setSelected] = useState(''), [position, setPosition] = useState(0), [playing, setPlaying] = useState(false), [seek, setSeek] = useState(0);
  const [muted, setMuted] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false), [saveStatus, setSaveStatus] = useState('Opening your workspace…'), [storageError, setStorageError] = useState(false);
  const [exportOpen, setExportOpen] = useState(false), [resetOpen, setResetOpen] = useState(false), [dragged, setDragged] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), canvas = useRef<HTMLCanvasElement>(null), positionRef = useRef(0), audioContext = useRef<AudioContext | null>(null), gainNode = useRef<GainNode | null>(null);
  const latestAssets = useRef(assets); latestAssets.current = assets;
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailCache = useRef(new Map<string, string>());
  const thumbnailKeys = edit.clips.map(c => `${c.assetId}:${c.in}`).join('|');
  const entries = videoTimeline(edit.clips), total = movieDuration(edit.clips), selectedIndex = Math.max(0, edit.clips.findIndex(c => c.id === selected));
  const clip = edit.clips[selectedIndex], entry = entries[selectedIndex], asset = assets.find(a => a.id === clip?.assetId);
  const sourcePosition = entry ? clip.in + Math.max(0, Math.min(entry.duration, position - entry.start)) : 0;
  const canSplit = !!clip && position >= entry.start && position <= entry.end && sourcePosition - clip.in >= MIN_CLIP && clip.out - sourcePosition >= MIN_CLIP && edit.clips.length < MAX_CLIPS;
  const size = videoSize(edit.ratio, 960, assets.find(a => a.id === edit.clips[0]?.assetId));
  const disabled = !!busy || !loaded;
  useEffect(() => {
    let live = true;
    void loadVideoDraft().then(draft => { if (!live) { draft?.assets.forEach(a => URL.revokeObjectURL(a.url)); return; } if (draft) { setEdit(draft.edit); setAssets(draft.assets); setSelected(draft.edit.clips[0]?.id || ''); } setSaveStatus(draft ? 'Draft restored on this device' : 'Your next story starts here'); }).catch(() => { if (live) { setStorageError(true); setSaveStatus('Local saving unavailable'); } }).finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => () => { latestAssets.current.forEach(a => URL.revokeObjectURL(a.url)); }, []);
  useEffect(() => {
    let live = true;
    const clips = edit.clips;
    void (async () => {
      for (const c of clips) {
        const key = `${c.assetId}:${c.in}`, media = assets.find(a => a.id === c.assetId);
        if (!media || !live) break;
        if (!thumbnailCache.current.has(key)) {
          try { thumbnailCache.current.set(key, await videoThumbnail(media, c.in)); }
          catch { thumbnailCache.current.set(key, media.thumbnail); }
        }
      }
      if (live) setThumbnails(Object.fromEntries(thumbnailCache.current));
    })();
    return () => { live = false; };
  }, [thumbnailKeys, assets]);
  useEffect(() => {
    if (!loaded) return;
    let live = true; const timer = setTimeout(() => {
      setSaveStatus('Saving draft…');
      void saveVideoDraft(edit, assets).then(() => { if (live) { setStorageError(false); setSaveStatus('Draft saved on this device'); } }).catch(() => { if (live) { setStorageError(true); setSaveStatus('Draft not saved · storage unavailable or full'); } });
    }, 700);
    return () => { live = false; clearTimeout(timer); };
  }, [edit, assets, loaded]);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hidden); return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  useEffect(() => { if (gainNode.current) gainNode.current.gain.value = muted ? 0 : 1; }, [muted]);
  useEffect(() => {
    if (!active || !edit.clips.length || !canvas.current || exportOpen) return;
    let cancelled = false, raf = 0;
    const engine = new VideoEngine(edit, assets, 960), scratch = document.createElement('canvas');
    const from = Math.min(positionRef.current, Math.max(0, total - .0001));
    const context = playing ? audioContext.current : null;
    const startAt = context ? context.currentTime + .18 : 0, wallStart = performance.now() + 180;
    const nodes = new Set<AudioBufferSourceNode>();
    const gain = context?.createGain(); if (gain && context) { gain.gain.value = muted ? 0 : 1; gain.connect(context.destination); gainNode.current = gain; }
    setReady(false); setError('');
    const clock = () => from + Math.max(0, context ? context.currentTime - startAt : (performance.now() - wallStart) / 1000);
    async function sound() {
      if (!context || !gain) return;
      let next = from;
      while (!cancelled && next < total) {
        if (next > clock() + 1) { await new Promise(r => setTimeout(r, 60)); continue; }
        const start = next, duration = Math.min(.5, total - start); next += duration;
        const buffer = await engine.audioChunk(start, duration); if (cancelled) break;
        const when = startAt + start - from, offset = Math.max(0, context.currentTime - when);
        if (offset >= buffer.duration) continue;
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(gain); nodes.add(source);
        source.onended = () => { nodes.delete(source); source.disconnect(); };
        source.start(Math.max(context.currentTime, when), offset);
      }
    }
    let drawing: Promise<void> = Promise.resolve();
    async function draw() {
      const t = playing ? Math.min(total, clock()) : from;
      await engine.draw(scratch, t); if (cancelled || !canvas.current) return;
      canvas.current.width = scratch.width; canvas.current.height = scratch.height; canvas.current.getContext('2d')!.drawImage(scratch, 0, 0); setReady(true);
      if (playing) { const current = activeEntries(engine.entries, t).at(-1); if (current) setSelected(current.clip.id); positionRef.current = t; setPosition(t); if (t >= total) { setPlaying(false); return; } raf = requestAnimationFrame(() => { drawing = draw().catch(fail); }); }
    }
    function fail(e: unknown) { if (!cancelled) { setError(e instanceof Error ? e.message : 'The preview could not be played.'); setPlaying(false); } }
    const sounding = playing ? sound().catch(fail) : Promise.resolve(); drawing = draw().catch(fail);
    return () => {
      cancelled = true; cancelAnimationFrame(raf); nodes.forEach(n => { try { n.stop(); } catch { /* Already ended. */ } }); gain?.disconnect(); gainNode.current = null;
      void Promise.all([sounding, drawing]).finally(() => engine.dispose());
    };
  }, [active, edit, assets, playing, seek, exportOpen]);
  useEffect(() => () => { void audioContext.current?.close(); }, []);
  function jump(t: number, select = false) {
    setPlaying(false); const value = Math.max(0, Math.min(total, t)); positionRef.current = value; setPosition(value); setSeek(n => n + 1);
    if (select) { const current = activeEntries(entries, value).at(-1); if (current) setSelected(current.clip.id); }
  }
  function change(next: VideoEdit, at?: number) {
    setPlaying(false); setPast(p => [...p.slice(-39), edit]); setFuture([]); setEdit(next);
    const t = Math.min(at ?? positionRef.current, movieDuration(next.clips)); positionRef.current = t; setPosition(t); setSeek(n => n + 1);
  }
  function undo() { if (!past.length || disabled) return; setFuture(f => [edit, ...f]); setEdit(past.at(-1)!); setPast(p => p.slice(0, -1)); jump(0); }
  function redo() { if (!future.length || disabled) return; setPast(p => [...p, edit]); setEdit(future[0]); setFuture(f => f.slice(1)); jump(0); }
  function updateClip(changes: Partial<VideoClip>) { if (clip) change({ ...edit, clips: edit.clips.map(c => c.id === clip.id ? { ...c, ...changes } : c) }); }
  function split() {
    if (!canSplit) return; const id = crypto.randomUUID(), clips = splitClip(edit.clips, clip.id, sourcePosition, id);
    if (clips !== edit.clips) { change({ ...edit, clips }); setSelected(id); notify('Cut made. Both pieces are ready to trim or rearrange.'); }
  }
  function move(from: number, to: number) {
    if (from < 0 || to < 0 || to >= edit.clips.length || from === to) return;
    const clips = [...edit.clips], [item] = clips.splice(from, 1); clips.splice(to, 0, item);
    setSelected(item.id); change({ ...edit, clips }, videoTimeline(clips)[to].start);
  }
  async function addFiles(files: File[]) {
    if (disabled || !files.length) return;
    setPlaying(false); setError(''); setBusy('Opening your videos…');
    const added: VideoAsset[] = [], messages: string[] = [];
    try {
      let bytes = assets.reduce((n, a) => n + a.file.size, 0);
      for (const file of files) {
        if (assets.length + added.length >= 12 || edit.clips.length + added.length >= MAX_CLIPS) { messages.push('A project supports 12 source videos and 40 clips.'); break; }
        if (bytes + file.size > 1024 * 1024 * 1024) { messages.push('Keep source videos under 1 GB in total.'); break; }
        try { const a = await readVideo(file); added.push(a); bytes += file.size; } catch (e) { messages.push(`${file.name}: ${e instanceof Error ? e.message : 'Could not read this video.'}`); }
      }
      if (added.length) {
        setAssets(a => [...a, ...added]);
        const clips = added.map(a => ({ id: crypto.randomUUID(), assetId: a.id, name: a.name, in: 0, out: a.duration, transition: 'cut' as const, transitionSeconds: .5, volume: 1 }));
        const next = { ...edit, name: !edit.clips.length && edit.name === 'My next story' ? added[0].name.replace(/\.[^.]+$/, '').slice(0, 80) : edit.name, clips: [...edit.clips, ...clips] };
        change(next, total); setSelected(clips[0].id);
      }
      if (messages.length) setError(messages.join(' '));
    } finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function togglePlay() {
    if (playing) { setPlaying(false); return; }
    try { if (!audioContext.current || audioContext.current.state === 'closed') audioContext.current = new AudioContext(); await audioContext.current.resume(); }
    catch { notify('Audio preview is unavailable in this browser. You can still export with sound.'); }
    if (positionRef.current >= total - .01) { positionRef.current = 0; setPosition(0); }
    setPlaying(true);
  }
  const shortcutHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcutHandler.current = (e: KeyboardEvent) => {
      if (!active || disabled || exportOpen || resetOpen || (e.target as HTMLElement).closest('input,select,textarea,button,[role=dialog]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); if (e.shiftKey) redo(); else undo(); }
      else if (e.code === 'Space' && edit.clips.length) { e.preventDefault(); void togglePlay(); }
      else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) split();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => shortcutHandler.current(e);
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, []);
  return <div className="video-studio" hidden={!active}>
    <input ref={fileInput} type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" multiple hidden onChange={e => void addFiles(Array.from(e.target.files || []))}/>
    <header className="workspace-header video-header"><div className="workspace-title"><button className="icon-button" aria-label="Back to studio" onClick={onBack}><ArrowLeft size={19}/></button><img src="/video-icon.svg" alt="" className="video-app-icon"/><div><input className="project-name" aria-label="Video project name" maxLength={80} value={edit.name} disabled={disabled} onChange={e => setEdit(v => ({ ...v, name: e.target.value }))}/><span><span className={`status-dot ${storageError ? 'error-dot' : ''}`}/>{saveStatus}</span></div></div><div className="workspace-actions"><button className="icon-button" aria-label="Undo video edit" onClick={undo} disabled={!past.length || disabled}><Undo2 size={17}/></button><button className="icon-button" aria-label="Redo video edit" onClick={redo} disabled={!future.length || disabled}><Redo2 size={17}/></button><button className="quiet-button video-new" disabled={disabled || !assets.length} onClick={() => setResetOpen(true)}>New movie</button><button className="primary-button" disabled={!edit.clips.length || disabled || total > MAX_MOVIE} onClick={() => { setPlaying(false); setExportOpen(true); }}><ArrowDownToLine size={16}/> Export video</button></div></header>
    <div className="video-layout"><section className="video-main"><div className="video-heading"><div><span className="eyebrow">05 / KEEP THE GOOD PARTS</span><h1>A little cut.<br className="video-heading-break"/> <em>A better story.</em></h1></div><span className="video-local"><LockKeyhole size={13}/> Only on your device</span></div>
      {(error || storageError) && <div className="video-alert" role="alert">{error || 'This draft could not be saved. Keep this tab open and export your finished movie before leaving.'}{error && <button aria-label="Dismiss video error" onClick={() => setError('')}><X size={16}/></button>}</div>}
      {total > MAX_MOVIE && <div className="video-alert">Your movie is {videoTime(total)}. Trim it to 10 minutes or less to export.</div>}
      <div className={`video-stage ${!edit.clips.length ? 'empty' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) void addFiles(Array.from(e.dataTransfer.files)); }}>
        {edit.clips.length ? <><div className="video-stage-label"><span><i/> YOUR MOVIE</span><span>{edit.clips.length} {edit.clips.length === 1 ? 'clip' : 'clips'} · {videoTime(total)}</span></div><div className="video-screen" style={{ aspectRatio: size.width / size.height }}><canvas ref={canvas} aria-label="Edited video preview"/>{!ready && !error && <span className="video-preparing"><span className="spinner"/> Preparing preview…</span>}</div><div className="video-player"><button className="video-play" disabled={!ready || disabled} aria-label={playing ? 'Pause video' : 'Play video'} onClick={() => void togglePlay()}>{playing ? <Pause size={19}/> : <Play size={19} fill="currentColor"/>}</button><span className="video-clock">{videoTime(position)} <i>/ {videoTime(total)}</i></span><input aria-label="Movie playhead" type="range" min={0} max={total} step={.01} value={position} onChange={e => jump(Number(e.target.value), true)}/><button className="icon-button" aria-label={muted ? 'Unmute video preview' : 'Mute video preview'} aria-pressed={muted} onClick={() => setMuted(m => !m)}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button></div></> : <div className="video-empty"><div className="video-empty-art" aria-hidden="true"><div className="video-film-piece"><img src="/samples/coast.jpg" alt=""/><span>00:04</span></div><div className="video-film-piece"><img src="/samples/village.jpg" alt=""/><span>00:12</span></div><div className="video-empty-scissors"><Scissors size={28}/></div></div><span className="eyebrow">YOUR MOMENTS, BEAUTIFULLY EDITED</span><h2>Keep what you love.<br/><em>Make it flow.</em></h2><p>Cut your video into pieces. Put them in your order.<br/>Bring it all together with a transition you love.</p><button className="primary-button" disabled={disabled} onClick={() => fileInput.current?.click()}><Plus size={18}/>{busy || 'Choose a video'}</button><small>Or drop videos here · MP4, MOV & WebM<br/>Up to 500 MB per file · Movies up to 10 minutes</small></div>}
      </div>
      {!!edit.clips.length && <section className="video-timeline" aria-label="Video clips"><div className="video-timeline-top"><div><span className="eyebrow">THE CUTTING ROOM</span><h2>Your story, piece by piece.</h2></div><div><button className="secondary-button" disabled={!canSplit || disabled} onClick={split}><Scissors size={15}/> Split at playhead <kbd>S</kbd></button><button className="secondary-button" disabled={disabled || assets.length >= 12} onClick={() => fileInput.current?.click()}><Plus size={15}/> Add video</button></div></div><div className="video-ruler" aria-hidden="true">{[0, .25, .5, .75, 1].map(f => <span key={f}>{videoTime(total * f)}</span>)}</div><div className="video-track" aria-label="Movie overview">{entries.map(e => <button key={e.clip.id} aria-label={`Jump to clip ${e.index + 1}`} className={clip?.id === e.clip.id ? 'selected' : ''} style={{ flex: e.duration - e.overlap }} onClick={() => { setSelected(e.clip.id); jump(e.start); }}>{e.index + 1}</button>)}<i style={{ left: `${total ? position / total * 100 : 0}%` }}/></div>
        <div className="video-clips">{edit.clips.map((c, i) => { const media = assets.find(a => a.id === c.assetId); return <div className={`video-clip-group ${dragged === c.id ? 'dragging' : ''}`} key={c.id} draggable={!disabled} onDragStart={e => { setDragged(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }} onDragEnd={() => setDragged(null)} onDragOver={e => { if (dragged) e.preventDefault(); }} onDrop={e => { if (!dragged) return; e.preventDefault(); move(edit.clips.findIndex(v => v.id === dragged), i); setDragged(null); }}><button aria-label={`Select clip ${i + 1}: ${c.name}`} aria-pressed={clip?.id === c.id} className={`video-clip ${clip?.id === c.id ? 'selected' : ''}`} onClick={() => { setSelected(c.id); jump(entries[i].start); }}><div className="video-clip-picture"><img src={thumbnails[`${c.assetId}:${c.in}`] || media?.thumbnail} alt=""/><span className="video-clip-number">{String(i + 1).padStart(2, '0')}</span><GripVertical size={16}/><span className="video-clip-duration">{videoTime(clipLength(c))}</span></div><strong>{c.name}</strong><small>{videoTime(c.in)} → {videoTime(c.out)}</small></button>{i < edit.clips.length - 1 && <button className="video-join" aria-label={`Edit transition after clip ${i + 1}`} onClick={() => { setSelected(c.id); jump(Math.max(entries[i].start, entries[i].end - entries[i].overlap - .5)); document.getElementById('video-transition')?.focus(); }}><span>{c.transition === 'cut' ? '│' : '◇'}</span>{transitions.find(t => t.id === c.transition)?.name}</button>}</div>; })}</div><p className="video-hint"><GripVertical size={13}/> Drag clips to reorder, or use the Earlier / Later buttons. Space to play · S to split.</p></section>}
      <div className="video-workflow"><span><b>01</b> Cut the good parts</span><span><b>02</b> Arrange your story</span><span><b>03</b> Add a little flow</span></div>
    </section><aside className="video-inspector" aria-label="Video editing controls"><div className="video-inspector-heading"><img src="/video-icon.svg" alt=""/><div><span className="eyebrow">MAKE THE CUT</span><h2>{clip ? `Clip ${selectedIndex + 1}` : 'Your director’s chair.'}</h2></div></div>
      <div className="video-inspector-content">{clip && asset ? <><div className="video-source-summary"><img src={thumbnails[`${clip.assetId}:${clip.in}`] || asset.thumbnail} alt=""/><div><strong>{asset.name}</strong><small>{asset.width} × {asset.height} · {videoTime(asset.duration)}</small></div></div><label className="field-label" htmlFor="video-clip-name">Clip name</label><input className="text-input" id="video-clip-name" maxLength={100} value={clip.name} onChange={e => updateClip({ name: e.target.value })}/>
        <div className="video-trim-heading"><span className="field-label">Keep this part</span><span>{videoTime(clipLength(clip))}</span></div><div className="video-trim-fields"><TimeField label="Start (seconds)" value={clip.in} min={0} max={clip.out - MIN_CLIP} onCommit={n => updateClip({ in: n })}/><TimeField label="End (seconds)" value={clip.out} min={clip.in + MIN_CLIP} max={asset.duration} onCommit={n => updateClip({ out: n })}/></div><div className="video-trim-actions"><button disabled={position < entry.start || position > entry.end || sourcePosition > clip.out - MIN_CLIP} onClick={() => updateClip({ in: sourcePosition })}>Set start here</button><button disabled={position < entry.start || position > entry.end || sourcePosition < clip.in + MIN_CLIP} onClick={() => updateClip({ out: sourcePosition })}>Set end here</button></div><p className="video-hint">Original time: {videoTime(sourcePosition)}. Your original file stays untouched.</p><button className="secondary-button full" disabled={!canSplit || disabled} onClick={split}><Scissors size={15}/> Split this clip at playhead</button>
        <div className="control-divider"/><label className="field-label" htmlFor="video-transition">Transition to next clip</label><select id="video-transition" value={clip.transition} disabled={selectedIndex === edit.clips.length - 1} onChange={e => updateClip({ transition: e.target.value as VideoClip['transition'] })}>{transitions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><p className="video-hint">{selectedIndex === edit.clips.length - 1 ? 'Add another clip to create a transition.' : transitions.find(t => t.id === clip.transition)?.description}</p>{clip.transition !== 'cut' && selectedIndex < edit.clips.length - 1 && <label className="range-field"><span>Transition length <output>{entry.overlap.toFixed(2)}s</output></span><input aria-label="Transition length" type="range" min={.15} max={2} step={.05} value={clip.transitionSeconds} onChange={e => updateClip({ transitionSeconds: Number(e.target.value) })}/><small className="video-hint">Short clips use a shorter overlap automatically.</small></label>}
        <label className="range-field"><span>Clip audio <output>{asset.audio ? `${Math.round(clip.volume * 100)}%` : 'No audio'}</output></span><input aria-label="Clip audio volume" disabled={!asset.audio} type="range" min={0} max={1} step={.05} value={clip.volume} onChange={e => updateClip({ volume: Number(e.target.value) })}/></label>
        <div className="video-order-buttons"><button className="secondary-button" disabled={selectedIndex === 0 || disabled} onClick={() => move(selectedIndex, selectedIndex - 1)}><ArrowLeft size={14}/> Earlier</button><button className="secondary-button" disabled={selectedIndex === edit.clips.length - 1 || disabled} onClick={() => move(selectedIndex, selectedIndex + 1)}>Later <ArrowRight size={14}/></button></div><div className="video-order-buttons"><button className="quiet-button" disabled={edit.clips.length >= MAX_CLIPS || disabled} onClick={() => { const id = crypto.randomUUID(), clips = [...edit.clips]; clips.splice(selectedIndex + 1, 0, { ...clip, id }); change({ ...edit, clips }); setSelected(id); }}><Copy size={14}/> Duplicate</button><button className="video-remove quiet-button" disabled={disabled} onClick={() => { const clips = edit.clips.filter(c => c.id !== clip.id); change({ ...edit, clips }, 0); setSelected(clips[Math.min(selectedIndex, clips.length - 1)]?.id || ''); }}><Trash2 size={14}/> Remove</button></div>
      </> : <div className="video-inspector-empty"><Scissors size={27}/><h3>Every great story<br/>starts with a first clip.</h3><p>Choose a video to trim, split and arrange your favourite parts.</p></div>}
      <div className="control-divider"/><span className="eyebrow">THE FINISHED MOVIE</span><label className="field-label" htmlFor="video-shape">Canvas shape</label><select id="video-shape" value={edit.ratio} disabled={disabled} onChange={e => change({ ...edit, ratio: e.target.value })}><option value="original">Match first clip</option><option value="16:9">Landscape · 16:9</option><option value="9:16">Portrait · 9:16</option><option value="1:1">Square · 1:1</option></select><label className="field-label" htmlFor="video-fit">Picture fit</label><select id="video-fit" value={edit.fit} disabled={disabled} onChange={e => change({ ...edit, fit: e.target.value as VideoEdit['fit'] })}><option value="contain">Fit whole picture</option><option value="cover">Fill canvas (crop edges)</option></select><p className="video-hint">{edit.fit === 'contain' ? 'Keeps the whole image, with black borders if needed.' : 'Fills the frame by cropping the edges.'}</p></div><div className="video-inspector-footer"><LockKeyhole size={14}/><span>Your videos stay on this device.<br/>No uploads. No watermark.</span></div></aside></div>
    {!!busy && <div className="loading-pill" role="status"><span className="spinner"/>{busy}</div>}
    {exportOpen && <VideoExport edit={edit} assets={assets} onClose={() => setExportOpen(false)}/>}
    {resetOpen && <VideoDialog title="Start a fresh movie?" onClose={() => setResetOpen(false)}><p className="muted">This replaces your saved video draft on this device. Export your current movie first if you want to keep it.</p><div className="video-dialog-actions"><button className="secondary-button" onClick={() => setResetOpen(false)}>Keep editing</button><button className="primary-button" onClick={() => { setPlaying(false); assets.forEach(a => URL.revokeObjectURL(a.url)); setEdit(blank()); setAssets([]); setPast([]); setFuture([]); setSelected(''); jump(0); setResetOpen(false); }}>Start new movie</button></div></VideoDialog>}
  </div>;
}
function TimeField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(value.toFixed(2));
  useEffect(() => setText(value.toFixed(2)), [value]);
  function commit() { const n = Number(text); if (!text.trim() || !Number.isFinite(n) || n < min || n > max) { setText(value.toFixed(2)); return; } if (Math.abs(n - value) > .00001) onCommit(n); }
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step={.01} value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/></label>;
}
function VideoDialog({ title, children, onClose, locked = false }: { title: string; children: React.ReactNode; onClose: () => void; locked?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); const el = dialog.current; return () => el?.close(); }, []);
  return <dialog ref={dialog} className="video-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!locked) onClose(); }}><button className="icon-button video-dialog-close" aria-label="Close video dialog" disabled={locked} onClick={onClose}><X size={18}/></button><span className="eyebrow">XBIEHA VIDEO STUDIO</span><h2>{title}</h2>{children}</dialog>;
}
function VideoExport({ edit, assets, onClose }: { edit: VideoEdit; assets: VideoAsset[]; onClose: () => void }) {
  const [longest, setLongest] = useState(1280), [format, setFormat] = useState<'mp4' | 'webm'>('mp4'), [sound, setSound] = useState(true);
  const [support, setSupport] = useState<{ mp4: boolean; webm: boolean } | null>(null), [working, setWorking] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [result, setResult] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false), [saveMessage, setSaveMessage] = useState(''), [saveError, setSaveError] = useState('');
  const saveHost = window as VideoSaveHost;
  const abort = useRef<AbortController | null>(null);
  const hasAudio = edit.clips.some(c => c.volume && assets.find(a => a.id === c.assetId)?.audio);
  useEffect(() => { let live = true; setSupport(null); void videoFormats(edit, assets, longest, sound && hasAudio).then(s => { if (live) { setSupport(s); setFormat(f => s[f] ? f : s.mp4 ? 'mp4' : 'webm'); } }).catch(() => { if (live) setSupport({ mp4: false, webm: false }); }); return () => { live = false; }; }, [edit, assets, longest, sound, hasAudio]);
  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  async function render() {
    setError(''); setWorking(true); setProgress(0); const controller = new AbortController(); abort.current = controller;
    try { const blob = await exportVideoEdit(edit, assets, longest, format, sound, controller.signal, setProgress); setResult({ blob, url: URL.createObjectURL(blob), name: `${fileName(edit.name, 'My movie')}.${format}` }); }
    catch (e) { setError(controller.signal.aborted ? 'Export cancelled. Your edits are safe.' : e instanceof Error ? e.message : 'The video could not be exported. Try 720p or a shorter movie.'); }
    finally { setWorking(false); abort.current = null; }
  }
  async function save() {
    if (!result || saving) return;
    setSaving(true); setSaveMessage(''); setSaveError('');
    try {
      const saved = await saveVideoFile(new File([result.blob], result.name, { type: result.blob.type }), saveHost, navigator);
      if (saved.status === 'saved') setSaveMessage(`Saved as ${saved.name} in the folder you chose.`);
      else if (saved.status === 'handed-off') setSaveMessage('The save / share menu was opened. Your chosen destination handles the save.');
      else if (saved.status === 'cancelled') setSaveMessage('Save cancelled. Your video is still ready to save.');
      else setSaveError('This browser cannot open a save menu for this video. Try Chrome or Edge for a folder chooser, or use Download video file below.');
    } catch {
      setSaveError('The video could not be saved. Please try again and choose a writable folder. Your video is still ready.');
    } finally { setSaving(false); }
  }
  const size = videoSize(edit.ratio, longest, assets.find(a => a.id === edit.clips[0]?.assetId));
  return <VideoDialog title={result ? 'Ready for its next chapter.' : 'Make it a movie.'} onClose={onClose} locked={working || saving}>{result ? <><video className="video-export-preview" src={result.url} controls playsInline/><p className="video-export-success"><Check size={17}/> Your movie is ready · {(result.blob.size / 1024 / 1024).toFixed(1)} MB</p><button className="primary-button full" disabled={saving} onClick={() => void save()}><Save size={17}/>{saving ? 'Saving…' : 'Save video…'}</button><p className="video-hint">{typeof saveHost.showSaveFilePicker === 'function' ? 'Choose a folder and file name in the save window.' : 'Choose a destination in your device’s save / share menu. On iPhone or iPad, choose Save Video or Save to Files if offered. MP4 works best with Photos.'}</p>{saveMessage && <p className="video-hint" role="status">{saveMessage}</p>}{saveError && <p className="video-alert" role="alert">{saveError}</p>}<button className="secondary-button full" disabled={saving} onClick={() => downloadBlob(result.blob, result.name)}><ArrowDownToLine size={17}/> Download video file</button><p className="video-hint">Download uses your browser’s usual download location.</p><p className="video-hint">The original videos and your editable draft stay on this device.</p></> : <><p className="muted">{edit.clips.length} {edit.clips.length === 1 ? 'clip' : 'clips'} · {videoTime(movieDuration(edit.clips))} · No watermark.</p><fieldset disabled={working}><label className="field-label" htmlFor="video-resolution">Resolution</label><select id="video-resolution" value={longest} onChange={e => setLongest(Number(e.target.value))}><option value={1280}>720p · smaller file</option><option value={1920}>1080p · more detail</option></select><p className="video-hint">{size.width} × {size.height} pixels · 30 frames per second</p><label className="field-label" htmlFor="video-format">File format</label><select id="video-format" value={format} onChange={e => setFormat(e.target.value as 'mp4' | 'webm')}><option value="mp4" disabled={!support?.mp4}>MP4{support && !support.mp4 ? ' · unavailable in this browser' : ' · widely compatible'}</option><option value="webm" disabled={!support?.webm}>WebM{support && !support.webm ? ' · unavailable in this browser' : ' · browser-friendly'}</option></select><label className="video-sound-option"><input type="checkbox" checked={sound && hasAudio} disabled={!hasAudio} onChange={e => setSound(e.target.checked)}/> {hasAudio ? 'Include original audio and clip volume settings' : 'These clips have no audio'}</label></fieldset>{support && !support.mp4 && !support.webm && <p className="video-alert">This browser cannot encode this movie. Try 720p or open Xbieha in current Chrome, Edge or Safari.</p>}{error && <p className="video-alert" role="alert">{error}</p>}{working ? <div className="video-export-progress" role="status"><progress max={1} value={progress}/><strong>Creating your movie… {Math.round(progress * 100)}%</strong><p>Keep this tab open and visible until it finishes.</p><button className="secondary-button" onClick={() => abort.current?.abort()}>Cancel export</button></div> : <button className="primary-button full" disabled={!support?.[format]} onClick={() => void render()}><Film size={17}/>{support ? 'Create video' : 'Checking available formats…'}</button>}<p className="video-hint"><LockKeyhole size={12}/> Created entirely on your device. Larger movies take longer.</p></>}</VideoDialog>;
}
