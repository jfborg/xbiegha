import { useEffect, useState } from 'react';
import type { Project } from './model';
import { renderProject } from './render';

export function ExportPreview({ project }: { project: Project }) {
  const [preview, setPreview] = useState<{ project: Project; src: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    const canvas = document.createElement('canvas');
    void renderProject(canvas, project, 480).then(() => {
      if (alive) setPreview({ project, src: canvas.toDataURL('image/jpeg', .85) });
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [project]);
  return <div className="export-thumbnail">
    {preview?.project === project ? <img src={preview.src} alt="Your finished image"/> : <span role="status">{failed ? 'Preview unavailable. Try reopening export.' : 'Preparing your preview…'}</span>}
    <span>{project.name}</span>
  </div>;
}
