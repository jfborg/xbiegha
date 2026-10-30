import { useEffect, useRef, useState } from 'react';
import { ImageDown, Share2 } from 'lucide-react';
import type { Project } from './model';
import { prepareImageExport } from './render';
import { photosFormat, shareImageFile } from './photoShare';

type Prepared = { project: Project; type: string; size: number; file: File; url: string };
function imageSource(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not prepare the photo. Please try again.'));
    reader.readAsDataURL(blob);
  });
}
export function SaveToPhotos({ project, format, size, blocked }: {
  project: Project; format: string; size: number; blocked: boolean;
}) {
  const type = photosFormat(format, project.mode === 'passport');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const imageView = useRef<HTMLDivElement>(null);
  const ready = !blocked && prepared?.project === project && prepared.type === type && prepared.size === size ? prepared : null;

  useEffect(() => {
    let active = true;
    setPrepared(null); setError(''); setOpened(false); setMessage('');
    if (blocked || !project.photos.length) return;
    void prepareImageExport(project, type, size).then(async blob => {
      // A real image element with an embedded image source supports the browser's
      // native image menu; a download link instead saves to Files on iPhone.
      const url = await imageSource(blob);
      if (!active) return;
      const name = project.name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '-').slice(0,70) || 'xbiegha-image';
      const file = new File([blob], `${name}.${type === 'jpeg' ? 'jpg' : 'png'}`, { type: blob.type });
      setPrepared({ project, type, size, file, url });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not prepare this image. Try a smaller export.'); });
    return () => { active = false; };
  }, [project, type, size, blocked, attempt]);

  useEffect(() => {
    if (!opened || !ready) return;
    imageView.current?.focus({ preventScroll: true });
    imageView.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [opened, ready]);

  function share() {
    if (!ready || sharing) return;
    setSharing(true); setMessage('');
    // Keep the native share call inside the original tap. The image remains
    // available even on Safari versions whose share promise never settles.
    void shareImageFile(ready.file, navigator).then(result => {
      if (result === 'unavailable') setMessage('Sharing is unavailable here. Touch and hold the image above to save it.');
      else if (result === 'cancelled') setMessage('Sharing cancelled. You can still save the image above.');
      else setMessage('Share sheet closed. Your image is still available above.');
    }).finally(() => setSharing(false));
  }

  return <section className="save-photos" aria-label="Save to your photo library">
    <button className="primary-button full" disabled={!ready} onClick={() => { setOpened(true); imageView.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>
      <ImageDown size={17}/>{!blocked && !ready && !error ? 'Preparing for Photos…' : 'Save to Photos'}
    </button>
    <p className="export-footnote">For your camera roll: open the photo, then touch and hold it to save to Photos.</p>
    {error && <><p className="photo-save-message error" role="status">{error}</p><button className="text-link" onClick={() => setAttempt(n => n + 1)}>Try preparing again</button></>}
    {opened && ready && <div className="photo-save-view" ref={imageView} tabIndex={-1} role="region" aria-label="Save this image to Photos">
      <span className="eyebrow">READY FOR YOUR PHOTO LIBRARY</span>
      <h3>Keep this one.</h3>
      <ol><li><strong>Touch and hold the photo below.</strong></li><li>Choose <strong>Save to Photos</strong>, <strong>Add to Photos</strong> or <strong>Save Image</strong> in the image menu.</li></ol>
      <img className="photo-library-image" src={ready.url} alt="Your full-resolution image. Touch and hold this photo to save to Photos."/>
      <button type="button" className="text-link photo-save-back" onClick={() => setOpened(false)}>Back to export options</button>
      <p className="photo-save-size">Full resolution · {type === 'jpeg' ? 'JPEG' : 'PNG'} · no watermark</p>
      <p className="photo-save-help">If you see a preview first, open its menu or tap Share, then Save Image. If Photos is missing in an in-app browser, open <strong>xbiegha.com in Safari</strong> and try again. On a computer, right-click the photo to save.</p>
      <button className="secondary-button full" disabled={sharing} onClick={share}><Share2 size={15}/>{sharing ? 'Share sheet open…' : 'More sharing options'}</button>
      {message && <p className="photo-save-message" role="status">{message}</p>}
    </div>}
    {format === 'webp' && project.mode !== 'passport' && <p className="export-footnote">Photos uses a JPEG copy. Your WebP file download stays available.</p>}
    {project.mode === 'passport' && <p className="export-footnote">For an application upload, use the downloaded JPEG. A photo library or sharing app may change its file details.</p>}
  </section>;
}
