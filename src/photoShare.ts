export type ShareHost = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};
export type ShareResult = 'handed-off' | 'cancelled' | 'unavailable';

// Called directly from the tap handler with a file prepared beforehand. Waiting
// for canvas rendering here would lose Safari's transient user activation.
export function shareImageFile(file: File, host: ShareHost): Promise<ShareResult> {
  try {
    if (!host.share || !host.canShare?.({ files: [file] })) return Promise.resolve('unavailable');
    return host.share({ files: [file] }).then(() => 'handed-off' as const).catch(error =>
      error?.name === 'AbortError' ? 'cancelled' as const : 'unavailable' as const,
    );
  } catch {
    return Promise.resolve('unavailable');
  }
}
export function photosFormat(format: string, documentPhoto: boolean): 'jpeg' | 'png' {
  return documentPhoto || format !== 'png' ? 'jpeg' : 'png';
}
