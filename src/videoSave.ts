import { shareImageFile } from './photoShare.ts';
import type { ShareHost, ShareResult } from './photoShare.ts';

export type VideoSaveHost = {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    name: string;
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
      abort: () => Promise<void>;
    }>;
  }>;
};
export type VideoSaveResult = { status: 'saved'; name: string } | { status: ShareResult };

// Start the picker/share sheet before any await to preserve the original click.
// Cancelling or failing never triggers a download to an unchosen destination.
export async function saveVideoFile(file: File, host: VideoSaveHost, shareHost: ShareHost): Promise<VideoSaveResult> {
  if (typeof host.showSaveFilePicker !== 'function') {
    return { status: await shareImageFile(file, shareHost) };
  }
  let handle;
  try {
    const webm = file.type === 'video/webm';
    handle = await host.showSaveFilePicker({
      suggestedName: file.name,
      types: [{ description: webm ? 'WebM video' : 'MP4 video', accept: { [webm ? 'video/webm' : 'video/mp4']: [webm ? '.webm' : '.mp4'] } }],
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return { status: 'cancelled' };
    throw error;
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(file);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return { status: 'saved', name: handle.name };
}
