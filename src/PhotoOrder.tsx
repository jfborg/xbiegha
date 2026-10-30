import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical } from 'lucide-react';
import type { Photo } from './model';

export function PhotoOrder({ photos, onMove, onDone }: { photos: Photo[]; onMove: (from: number, to: number) => void; onDone: () => void }) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const dragId = useRef<string | null>(null), dropId = useRef<string | null>(null);
  function dragMove(e: PointerEvent<HTMLSpanElement>) {
    if (!dragId.current) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo-order-id]')?.dataset.photoOrderId || null;
    dropId.current = target; setOver(target);
  }
  function dragEnd(e: PointerEvent<HTMLSpanElement>, cancelled = false) {
    if (!cancelled && dragId.current && dropId.current) move(photos.findIndex(p => p.id === dragId.current), photos.findIndex(p => p.id === dropId.current));
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragId.current = null; dropId.current = null; setDragged(null); setOver(null);
  }
  function move(from: number, to: number) {
    if (from < 0 || to < 0 || from >= photos.length || to >= photos.length || from === to) return;
    onMove(from, to);
    setMessage(`${photos[from].name} moved to position ${to + 1} of ${photos.length}.`);
  }
  return <>
    <p className="photo-order-help">Use the arrows to move a photo. On a computer, drag a photo by its dotted handle. The first photo fills the first layout slot.</p>
    <ol className="photo-order-list" aria-label="Collage photo order">{photos.map((photo, i) => <li key={photo.id} data-photo-order-id={photo.id} className={`${dragged === photo.id ? 'dragging' : ''} ${over === photo.id ? 'drop-target' : ''}`}>
      <span className="photo-order-grip" title="Drag to reorder; arrow buttons are also available" aria-hidden="true" onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dragId.current = photo.id; dropId.current = photo.id; setDragged(photo.id); }} onPointerMove={dragMove} onPointerUp={e => dragEnd(e)} onPointerCancel={e => dragEnd(e, true)}><GripVertical size={16}/></span>
      <div className="photo-order-thumb"><img src={photo.src} alt={photo.name} draggable={false}/><span>{i + 1}</span></div>
      <span className="photo-order-name"><strong>Photo {i + 1}</strong><small title={photo.name}>{photo.name}</small></span>
      <div className="photo-order-actions"><button type="button" disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} title="Move earlier" onClick={() => move(i, i - 1)}><ArrowUp size={18}/></button><button type="button" disabled={i === photos.length - 1} aria-label={`Move photo ${i + 1} later`} title="Move later" onClick={() => move(i, i + 1)}><ArrowDown size={18}/></button></div>
    </li>)}</ol>
    <p className="photo-order-status" role="status">{message || 'Your crop and adjustments stay with each photo.'}</p>
    <button type="button" className="primary-button full" onClick={onDone}><Check size={16}/> Done arranging</button>
  </>;
}
