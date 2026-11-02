import type { Project } from './model';

export function createBackup(project: Project) {
  const { thumbnail: _thumbnail, ...data } = project;
  void _thumbnail;
  return { format: 'xbieha-project', version: 1, project: data };
}

// Keep the original backup format readable after the public brand changes.
// The importer still validates all project fields and image content separately.
export function isSupportedBackup(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Record<string, unknown>;
  return ['xbieha-project', 'xbiegha-project'].includes(String(backup.format)) && backup.version === 1;
}
