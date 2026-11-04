import type { Project } from './model.ts';
import type { ProjectSummary } from './storage.ts';
import type { VideoAsset, VideoEdit } from './videoModel.ts';

type DiskAsset = Omit<VideoAsset, 'file' | 'url'> & { size: number; type: string; lastModified: number };
type DiskMovie = { edit: VideoEdit; assets: DiskAsset[] };
type DesktopBridge = {
  listProjects(): Promise<{ projects: ProjectSummary[]; warnings: string[] }>;
  loadProject(id: string): Promise<Project | undefined>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  loadVideo(): Promise<DiskMovie | null>;
  saveVideo(movie: DiskMovie): Promise<void>;
  hasMedia(id: string, size: number): Promise<boolean>;
  beginMedia(id: string, size: number): Promise<string>;
  chooseExport(name: string, size: number): Promise<{ token: string; name: string } | null>;
  appendTransfer(token: string, bytes: Uint8Array): Promise<void>;
  finishTransfer(token: string): Promise<void>;
  abortTransfer(token: string): Promise<void>;
  showLibrary(): Promise<void>;
  onBeforeClose(callback: () => Promise<void>): () => void;
};
declare global { interface Window { xbiehaDesktop?: DesktopBridge } }
export const desktop = typeof window === 'undefined' ? undefined : window.xbiehaDesktop;
export const savedHere = desktop ? 'Saved on your Mac' : 'Saved on this device';
export function desktopNotice(message: string) { window.dispatchEvent(new CustomEvent('xbieha:notice', { detail: message })); }

const saves = new Map<string, () => Promise<void>>();
const transfers = new Set<Promise<void>>();
export function registerDesktopSave(key: string, save: () => Promise<void>) {
  if (!desktop) return () => {};
  saves.set(key, save);
  return () => { saves.delete(key); };
}
desktop?.onBeforeClose(async () => {
  // Include debounced changes when quitting, and leave the app open on failure.
  document.documentElement.inert = true;
  try { for (const save of saves.values()) await save(); await Promise.all([...transfers]); }
  finally { document.documentElement.inert = false; }
});

function transfer(blob: Blob, token: string) {
  const sending = transferFile(blob, token); transfers.add(sending);
  void sending.then(() => transfers.delete(sending), () => transfers.delete(sending));
  return sending;
}

async function transferFile(blob: Blob, token: string) {
  if (!desktop) throw new Error('The Mac file service is unavailable.');
  try {
    for (let offset = 0; offset < blob.size; offset += 4 * 1024 ** 2) {
      await desktop.appendTransfer(token, new Uint8Array(await blob.slice(offset, offset + 4 * 1024 ** 2).arrayBuffer()));
    }
    await desktop.finishTransfer(token);
  } catch (error) { await desktop.abortTransfer(token).catch(() => {}); throw error; }
}

export async function saveDesktopFile(blob: Blob, name: string): Promise<{ status: 'saved'; name: string } | { status: 'cancelled' }> {
  if (!desktop) throw new Error('The Mac file service is unavailable.');
  const choice = await desktop.chooseExport(name, blob.size);
  if (!choice) return { status: 'cancelled' };
  await transfer(blob, choice.token);
  return { status: 'saved', name: choice.name };
}

let pendingVideo: Promise<void> = Promise.resolve();
export function saveDesktopVideo(edit: VideoEdit, assets: VideoAsset[]) {
  const save = pendingVideo.then(async () => {
    if (!desktop) throw new Error('The Mac file service is unavailable.');
    const stored: DiskAsset[] = [];
    for (const { file, url: _url, ...asset } of assets) {
      if (!await desktop.hasMedia(asset.id, file.size)) await transfer(file, await desktop.beginMedia(asset.id, file.size));
      stored.push({ ...asset, size: file.size, type: file.type, lastModified: file.lastModified });
    }
    await desktop.saveVideo({ edit, assets: stored });
  });
  pendingVideo = save.catch(() => {});
  return save;
}

export async function loadDesktopVideo(): Promise<{ edit: VideoEdit; assets: VideoAsset[] } | null> {
  const movie = await desktop!.loadVideo();
  if (!movie) return null;
  const assets: VideoAsset[] = [];
  try {
    for (const { size, type, lastModified, ...asset } of movie.assets) {
      const response = await fetch(`xbieha://studio/__media/${encodeURIComponent(asset.id)}`);
      if (!response.ok) throw new Error('A movie source could not be read from your Mac. Your draft has been kept.');
      const blob = await response.blob();
      if (blob.size !== size) throw new Error('A movie source is incomplete. Your draft has been kept.');
      const file = new File([blob], asset.name, { type, lastModified });
      assets.push({ ...asset, file, url: URL.createObjectURL(file) });
    }
    return { edit: movie.edit, assets };
  } catch (error) { assets.forEach(asset => URL.revokeObjectURL(asset.url)); throw error; }
}
