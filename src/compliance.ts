import type { Photo, Project } from './model';
import { documentSpec, frameValues, passportDimensions } from './passport.ts';
export type CheckResult = { id: string; label: string; detail: string; pass: boolean };
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function dateIsRecent(value: string | undefined, months: number | undefined, now = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const captured = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(captured.getTime()) || localDate(captured) !== value || value > localDate(now)) return false;
  if (!months) return true;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate(), 12);
  // Clamp a month subtraction to its last day (e.g. March 31 -> February 28).
  if (cutoff.getDate() !== now.getDate()) cutoff.setDate(0);
  return value >= localDate(cutoff);
}
export function sourceScale(photo: Photo, width: number, height: number) {
  const rotated = Math.abs(photo.rotation % 180) === 90;
  return Math.max(width / (rotated ? photo.height : photo.width), height / (rotated ? photo.width : photo.height)) * photo.zoom;
}
export function manualChecks(project: Project) {
  const spec = documentSpec(project.country);
  return [
    { id: 'terms-2026-10-30', label: 'I have read and agree to the Terms of Use (30 October 2026), including the photo-check limitations, and understand that official acceptance is not guaranteed.' },
    { id: 'landmarks', label: 'I aligned the head, chin and centre guides to the actual person; the measurements are accurate.' },
    { id: 'face', label: 'One person, full face forward, level head, eyes visible and open, neutral expression and closed mouth.' },
    { id: 'light', label: 'The original is sharp, naturally coloured and evenly lit, with no shadows, glare or red-eye.' },
    { id: 'background', label: `I checked the whole background: ${spec.background.toLowerCase()}.` },
    { id: 'original', label: 'This is a recent original capture, without filters, retouching, AI changes or background replacement; headwear and glasses meet the linked rules.' },
    { id: 'route', label: spec.route === 'print' ? 'I checked this application accepts supplied prints, including its paper, quantity and endorsement requirements.' : 'I checked this application accepts a JPEG upload with these dimensions and file limits.' },
    ...(spec.specialCheck ? [{ id: 'special', label: spec.specialCheck }] : []),
  ];
}
export function passportChecks(project: Project, now = new Date()): CheckResult[] {
  const spec = documentSpec(project.country), s = project.passport || {}, f = frameValues(s), dimensions = passportDimensions(spec, s);
  const photo = project.photos[0], head = (f.chin - f.crown) / 100 * spec.height;
  const results: CheckResult[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => results.push({ id, label, pass, detail });
  add('photo', 'Original photo', !!photo && project.photos.length === 1 && !photo.src.startsWith('/samples/'), photo?.src.startsWith('/samples/') ? 'Studio samples cannot be exported as document photos. Add your own original.' : 'Use one original photo of the applicant.');
  add('adult', 'Adult specification', s.age !== 'child', 'These measurements cover adults (18+). Use the authority’s child/baby route for younger applicants.');
  const customOK = !!s.width && !!s.height && s.width/s.height >= .25 && s.width/s.height <= 4 && (s.unit === 'mm' ? s.width >= 20 && s.height >= 20 && s.width <= 100 && s.height <= 100 && [300,400,600].includes(s.dpi || 600) : Number.isInteger(s.width) && Number.isInteger(s.height) && s.width >= 100 && s.height >= 100 && s.width <= 6000 && s.height <= 6000) && Number.isFinite(s.maxKB) && s.maxKB! >= 0 && s.maxKB! <= 50_000;
  if (spec.route === 'custom') add('contract', 'Application dimensions & file limit', customOK, 'Enter the current form’s width, height and maximum KB (0 only if the authority states no limit). These are user-supplied, not independently verified.');
  add('resolution', 'Source detail at the chosen crop', !!photo && sourceScale(photo, dimensions.width, dimensions.height) <= 1.001, 'The cropped original must contain enough pixels. Zoom out or use a higher-resolution original; upscaling is blocked.');
  add('mirror', 'Natural orientation', !!photo && !photo.flip, 'Mirrored document portraits are blocked. Rotate only to correct the camera orientation.');
  add('date', 'Capture date', dateIsRecent(s.takenOn, spec.months, now), spec.months ? `Taken within ${spec.months === 1 ? 'the last month' : `${spec.months} months`}, and not in the future. Recheck on the day you submit.` : 'Enter the actual capture date and check the authority’s recency rule.');
  const ordered = [f.crown, f.chin, f.eyes, f.faceLeft, f.faceRight].every(Number.isFinite) && f.crown > 0 && f.chin < 100 && f.chin > f.crown && f.eyes > f.crown && f.eyes < f.chin && f.faceLeft > 0 && f.faceRight < 100 && f.faceRight > f.faceLeft;
  add('frame', 'Head fully within the frame', ordered, 'Mark the crown (not hair), chin, eye line and face edges on the preview. Keep the entire head and shoulders visible.');
  if (spec.head) add('head', 'Head height', ordered && head >= spec.head[0] - .001 && head <= spec.head[1] + .001, `${head.toFixed(1)} mm marked; required ${spec.head[0].toFixed(1)}–${spec.head[1].toFixed(1)} mm.`);
  if (spec.headPercent) add('fill', 'Face / head fill guide', ordered && f.chin - f.crown >= spec.headPercent[0] && f.chin - f.crown <= spec.headPercent[1], `${(f.chin - f.crown).toFixed(1)}% marked; ${project.country === 'mt' ? 'at least 75%' : '70–80%'} in the authority’s framing guidance. Confirm the linked visual examples too.`);
  if (spec.faceWidth) { const width = (f.faceRight - f.faceLeft) / 100 * spec.width; add('width', 'Face width', ordered && width >= spec.faceWidth[0] && width <= spec.faceWidth[1], `${width.toFixed(1)} mm marked; required ${spec.faceWidth[0]}–${spec.faceWidth[1]} mm from ear to ear.`); }
  if (spec.topMargin) { const margin = f.crown / 100 * spec.height; add('margin', 'Space above crown', margin >= spec.topMargin[0] && margin <= spec.topMargin[1], `${margin.toFixed(1)} mm marked; required ${spec.topMargin[0]}–${spec.topMargin[1]} mm.`); }
  return results;
}
export function exportProblems(project: Project, confirmations: Record<string, boolean>, now = new Date()) {
  return [...passportChecks(project, now).filter(c => !c.pass).map(c => `${c.label}: ${c.detail}`), ...manualChecks(project).filter(c => !confirmations[c.id]).map(c => c.label)];
}
export function fileLimits(project: Project) {
  const spec = documentSpec(project.country);
  return { min: spec.minBytes || 0, max: spec.route === 'custom' ? (project.passport?.maxKB || 0) * 1000 : spec.maxBytes || 0 };
}
export function assessmentKey(p: Project) { const photo = p.photos[0]; return JSON.stringify([p.country, photo?.id, photo?.x, photo?.y, photo?.zoom, photo?.rotation, photo?.flip, p.passport?.width, p.passport?.height, p.passport?.unit]); }
export function validateFileSize(project: Project, bytes: number) { const {min,max} = fileLimits(project); if (min && bytes < min) return `The JPEG is ${(bytes / 1000).toFixed(0)} KB; this route requires at least ${min / 1000} KB. Use a more detailed original. No artificial padding is added.`; if (max && bytes > max) return `The JPEG exceeds ${max / 1000} KB. Try a smaller size permitted by the authority.`; return ''; }
