const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function safeId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid library item.');
  return id;
}

async function atomicWrite(file, data, previous = false) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    if (previous) {
      try { JSON.parse(await fs.readFile(file, 'utf8')); await fs.copyFile(file, `${file}.previous`); }
      catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error; }
    }
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

class DiskLibrary {
  constructor(root) { this.root = root; this.pending = Promise.resolve(); this.transfers = new Map(); }
  async init() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    for (const folder of ['Projects', 'Video', 'Media', 'Trash']) await fs.mkdir(path.join(this.root, folder), { recursive: true, mode: 0o700 });
    // Only incomplete transfers in this app-owned scratch folder are discarded.
    await fs.rm(path.join(this.root, 'Transfers'), { recursive: true, force: true });
    await fs.mkdir(path.join(this.root, 'Transfers'), { mode: 0o700 });
  }
  queue(work) { const result = this.pending.then(work); this.pending = result.catch(() => {}); return result; }
  projectPath(id) { return path.join(this.root, 'Projects', `${safeId(id)}.xbieha`); }
  mediaPath(id) { return path.join(this.root, 'Media', safeId(id)); }
  async readJSON(file, warnings = []) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      try { const backup = JSON.parse(await fs.readFile(`${file}.previous`, 'utf8')); warnings.push(`Recovered the previous saved copy of ${path.basename(file)}. The unreadable file was left on disk.`); return backup; }
      catch { throw new Error(`Could not read ${path.basename(file)}. Your files have been kept; use Show project folder to recover a backup.`); }
    }
  }
  async listProjects() {
    await this.pending;
    const projects = [], warnings = [];
    for (const name of await fs.readdir(path.join(this.root, 'Projects'))) {
      if (!name.endsWith('.xbieha')) continue;
      try {
        const record = await this.readJSON(path.join(this.root, 'Projects', name), warnings);
        const { photos, slideshow: _slideshow, ...summary } = record.project;
        projects.push({ ...summary, photoCount: photos.length });
      } catch (error) { warnings.push(error.message); }
    }
    return { projects: projects.sort((a, b) => b.updated - a.updated), warnings };
  }
  async loadProject(id) { await this.pending; return (await this.readJSON(this.projectPath(id)))?.project; }
  saveProject(project) {
    const file = this.projectPath(project?.id);
    if (!Array.isArray(project.photos) || typeof project.name !== 'string') throw new Error('Invalid project.');
    const data = JSON.stringify({ format: 'xbieha-project', version: 1, project });
    return this.queue(() => atomicWrite(file, data, true));
  }
  deleteProject(id) {
    const file = this.projectPath(id);
    return this.queue(async () => {
      const destination = path.join(this.root, 'Trash', `${id}-${Date.now()}.xbieha`);
      await fs.rename(file, destination);
      await fs.rename(`${file}.previous`, `${destination}.previous`).catch(error => { if (error.code !== 'ENOENT') throw error; });
    });
  }
  async loadVideo() { await this.pending; return this.readJSON(path.join(this.root, 'Video', 'current.json')); }
  saveVideo(manifest) {
    if (!manifest?.edit || !Array.isArray(manifest.assets) || manifest.assets.length > 12) throw new Error('Invalid movie draft.');
    for (const asset of manifest.assets) safeId(asset.id);
    return this.queue(async () => {
      for (const asset of manifest.assets) {
        const stat = await fs.stat(this.mediaPath(asset.id));
        if (stat.size !== asset.size) throw new Error('A movie source has not finished saving. Please try again.');
      }
      await atomicWrite(path.join(this.root, 'Video', 'current.json'), JSON.stringify(manifest), true);
      // Retain sources for the current AND previous draft. Never remove originals.
      const previous = await this.readJSON(path.join(this.root, 'Video', 'current.json.previous'));
      const kept = new Set([...manifest.assets, ...(previous?.assets || [])].map(a => a.id));
      for (const id of await fs.readdir(path.join(this.root, 'Media'))) if (!kept.has(id)) await fs.rm(this.mediaPath(id));
    });
  }
  async hasMedia(id, size) { try { return (await fs.stat(this.mediaPath(id))).size === size; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
  async beginTransfer(destination, size) {
    if (!Number.isSafeInteger(size) || size < 0 || size > 2 * 1024 ** 3) throw new Error('File is too large.');
    const token = randomUUID(), temporary = path.join(this.root, 'Transfers', token);
    const handle = await fs.open(temporary, 'wx', 0o600);
    this.transfers.set(token, { destination, temporary, handle, size, written: 0 });
    return token;
  }
  async appendTransfer(token, bytes) {
    const transfer = this.transfers.get(token);
    if (!transfer || !(bytes instanceof Uint8Array) || bytes.byteLength > 4 * 1024 ** 2 || transfer.written + bytes.byteLength > transfer.size) throw new Error('Invalid file transfer.');
    await transfer.handle.writeFile(bytes); transfer.written += bytes.byteLength;
  }
  async finishTransfer(token) {
    const transfer = this.transfers.get(token);
    if (!transfer || transfer.written !== transfer.size) throw new Error('The file is incomplete; your previous file has not been changed.');
    await transfer.handle.sync(); await transfer.handle.close();
    // Copy into a temporary sibling first: exports may be on another volume.
    const sibling = `${transfer.destination}.${token}.tmp`;
    try { await fs.copyFile(transfer.temporary, sibling); await fs.chmod(sibling, 0o600); await fs.rename(sibling, transfer.destination); }
    finally { await fs.rm(sibling, { force: true }); await fs.rm(transfer.temporary, { force: true }); this.transfers.delete(token); }
  }
  async abortTransfer(token) {
    const transfer = this.transfers.get(token); if (!transfer) return;
    await transfer.handle.close().catch(() => {}); await fs.rm(transfer.temporary, { force: true }); this.transfers.delete(token);
  }
}

module.exports = { DiskLibrary, safeId, atomicWrite };
