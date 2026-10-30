import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, RotateCcw, Search, X } from 'lucide-react';
import type { Project } from './model';
import { defaultAdjustments, loadPhoto } from './model';
import { activeLook, lookCategories, looks, scaleLook } from './looks';
import type { Look, LookCategory } from './looks';
import { renderProject } from './render';

const LookPreview = memo(function LookPreview({ project, look }: { project: Project; look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    void (async () => {
      const photos = project.photos.length ? project.photos : [await loadPhoto('/samples/coast.jpg', 'Preview sample')];
      const temp = document.createElement('canvas');
      await renderProject(temp, { ...project, photos, adjustments: look.values }, 180);
      if (!alive || !ref.current) return;
      ref.current.width = temp.width; ref.current.height = temp.height;
      ref.current.getContext('2d')?.drawImage(temp, 0, 0);
    })().catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [project, look]);
  return failed ? <span className="look-preview-error">Preview unavailable</span> : <canvas ref={ref} aria-hidden="true"/>;
});

export function LooksPanel({ project, onChange, comparing, onCompare }: {
  project: Project; onChange: (changes: Partial<Project>, remember?: boolean) => void;
  comparing: boolean; onCompare: (value: boolean) => void;
}) {
  const [category, setCategory] = useState<LookCategory | 'All'>('All');
  const [query, setQuery] = useState('');
  const changingStrength = useRef(false);
  const current = activeLook(project);
  // Colour edits don't invalidate the full-strength gallery previews.
  const previewProject = useMemo(() => ({ ...project, adjustments: defaultAdjustments }),
    [project.id, project.photos, project.mode, project.ratio, project.layout, project.gap, project.padding, project.radius, project.background, project.caption]);
  const search = query.trim().toLowerCase();
  const visible = looks.filter(item => (category === 'All' || item.category === category) && `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(search));
  function choose(look: Look) {
    onCompare(false);
    onChange({ adjustments: { ...look.values }, look: { id: look.id, amount: 100 } });
  }
  function strength(amount: number) {
    if (!current.look) return;
    onCompare(false);
    onChange({ adjustments: scaleLook(current.look.values, amount), look: { id: current.look.id, amount } }, !changingStrength.current);
    changingStrength.current = true;
  }
  return <section className="looks-library" aria-label="Photo looks">
    <div className="looks-intro"><div><span className="eyebrow">A MOOD FOR EVERY MOMENT</span><h3>Find your feeling.</h3></div><span className="look-total">30 looks</span></div>
    <div className="look-current">
      <div className="look-current-heading"><span><small>{comparing ? 'VIEWING ORIGINAL' : 'YOUR LOOK'}</small><strong>{current.look?.name || (current.original ? 'Original' : 'Custom adjustments')}</strong></span><div className="look-current-actions">{project.photos.length > 0 && <button type="button" className="look-compare" aria-label={comparing ? 'Show my edits' : 'Compare with original'} title={comparing ? 'Show my edits' : 'Compare with original'} aria-pressed={comparing} onClick={() => onCompare(!comparing)}><Eye size={16}/></button>}<button type="button" aria-label="Remove look and reset colour" title="Reset colour; keep your crop and layout" disabled={current.original} onClick={() => { onCompare(false); onChange({ adjustments: { ...defaultAdjustments }, look: undefined }); }}><RotateCcw size={16}/><span>Original</span></button></div></div>
      {current.look ? <><label className="range-field look-intensity"><span>Intensity <output>{current.amount}%</output></span><input type="range" aria-label="Look intensity" aria-valuetext={`${current.amount}% ${current.look.name}`} min={0} max={100} step={1} value={current.amount} onPointerDown={() => { changingStrength.current = false; }} onPointerUp={() => { changingStrength.current = false; }} onPointerCancel={() => { changingStrength.current = false; }} onKeyUp={() => { changingStrength.current = false; }} onBlur={() => { changingStrength.current = false; }} onChange={e => strength(Number(e.target.value))}/></label></> : <p>{current.original ? 'Pick a look, then dial in just the right amount.' : 'Your own light and colour mix. Choosing a look replaces it.'}</p>}
    </div>
    <div className="look-search"><Search size={15}/><input type="search" aria-label="Search looks" placeholder="Find a look…" value={query} onChange={e => { setQuery(e.target.value); if (e.target.value.trim()) setCategory('All'); }}/>{query && <button type="button" aria-label="Clear look search" onClick={() => setQuery('')}><X size={14}/></button>}</div>
    <div className="look-categories" role="group" aria-label="Look collections">{(['All', ...lookCategories] as const).map(item => <button type="button" key={item} aria-pressed={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="look-results"><span>{category === 'All' ? 'THE WHOLE COLLECTION' : category === 'B&W' ? 'BLACK & WHITE' : category.toUpperCase()}</span><span role="status">{visible.length} {visible.length === 1 ? 'look' : 'looks'}</span></div>
    <div className="look-cards">{visible.map(item => <button type="button" key={item.id} title={item.description} aria-label={`Apply ${item.name} look`} aria-pressed={current.look?.id === item.id} className={current.look?.id === item.id ? 'selected' : ''} onClick={() => choose(item)}><div className="look-image"><LookPreview project={previewProject} look={item}/>{current.look?.id === item.id && <span className="look-check"><Check size={13}/></span>}</div><span>{item.name}</span></button>)}</div>
    {!visible.length && <div className="looks-empty"><p>No looks match that search.</p><button type="button" className="text-link" onClick={() => { setQuery(''); setCategory('All'); }}>Show all 30 looks</button></div>}
    <p className="looks-note">Previews show each look at full strength. {project.mode === 'collage' ? 'One look brings the whole collage together.' : 'Your crop stays exactly as you set it.'} {project.photos.length === 0 ? 'Add your photo to make these previews yours.' : 'Use Original to reset colour.'}</p>
  </section>;
}
