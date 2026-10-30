import { useEffect, useState } from 'react';
import { ImageDown, Share2 } from 'lucide-react';
import type { Project } from './model';
import { prepareImageExport } from './render';
import { photosFormat, shareImageFile } from './photoShare';

type Prepared = { project: Project; type: string; size: number; file: File; url: string };
export function SaveToPhotos({ project, format, size, blocked }: {
  project: Project; format: string; size: number; blocked: boolean;
}) {
  const type = photosFormat(format, project.mode === 'passport');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const ready = !blocked && prepared?.project === project && prepared.type === type && prepared.size === size ? prepared : null;

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setPrepared(null); setError(''); setFallback(false); setMessage('');
    if (blocked || !project.photos.length) return;
    void prepareImageExport(project, type, size).then(blob => {
      if (!active) return;
      const name = project.name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-').slice(0,70) || 'xbiegha-image';
      const file = new File([blob], `${name}.${type === 'jpeg' ? 'jpg' : 'png'}`, { type: blob.type });
      url = URL.createObjectURL(file);
      setPrepared({ project, type, size, file, url });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not prepare this image. Try a smaller export.'); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [project, type, size, blocked]);

  function save() {
    if (!ready || sharing) return;
    setSharing(true); setMessage('');
    // No await before this call: the browser must see the original tap.
    void shareImageFile(ready.file, navigator).then(result => {
      if (result === 'unavailable') { setFallback(true); setMessage('Use the image below to save to your photo library.'); }
      else if (result === 'cancelled') setMessage('Sharing cancelled. Your image is still ready.');
      else setMessage('Share sheet closed. You can save or share the image again.');
    }).finally(() => setSharing(false));
  }

  return <section className="save-photos" aria-label="Save to your photo library">
    <button className="secondary-button full" disabled={!ready || sharing} onClick={save}>
      <ImageDown size={17}/>{sharing ? 'Share sheet open…' : !blocked && !ready && !error ? 'Preparing for Photos…' : 'Save to Photos'}<Share2 size={14}/>
    </button>
    <p className="export-footnote">On iPhone, choose <strong>Save Image</strong> or <strong>Save to Photos</strong> in the share sheet. Your device handles the final save.</p>
    {format === 'webp' && project.mode !== 'passport' && <p className="export-footnote">Photos uses a JPEG copy for wider compatibility. Your WebP download stays available.</p>}
    {project.mode === 'passport' && <p className="export-footnote">For an application upload, use the downloaded JPEG. A photo library or sharing app may change its file details.</p>}
    {(message || error) && <p className={`photo-save-message ${error ? 'error' : ''}`} role="status">{error || message}</p>}
    {fallback && ready && <div className="photo-save-fallback">
      <img src={ready.url} alt="Finished image. Touch and hold to save to Photos."/>
      <p>Touch and hold this image, then choose <strong>Save Image</strong> or <strong>Save to Photos</strong>. If that option is missing, download the image and use its Share menu. On a computer, right-click to save.</p>
    </div>}
  </section>;
}
