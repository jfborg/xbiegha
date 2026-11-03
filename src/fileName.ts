// Shared by image, backup, slideshow and video exports. Keeps letters and digits
// from any script, drops characters that are unsafe on Windows/macOS/iOS file systems.
export function fileName(name: string, fallback: string) {
  return name.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 70) || fallback;
}
