const status = document.getElementById('status');
const list = document.getElementById('projects');
const urls = [];

async function readProjects() {
  return new Promise((resolve, reject) => {
    // Keep the original database name. Never create, write or delete projects here.
    const request = indexedDB.open('xbiegha-studio');
    let absent = false;
    request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
    request.onerror = () => absent ? resolve([]) : reject(request.error);
    request.onblocked = () => reject(new Error('Storage is busy. Close other studio tabs and reload this page.'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) { db.close(); resolve([]); return; }
      const tx = db.transaction('projects', 'readonly');
      const read = tx.objectStore('projects').getAll();
      tx.oncomplete = () => { db.close(); resolve(read.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Could not read saved projects.')); };
    };
  });
}

try {
  const projects = (await readProjects()).sort((a, b) => b.updated - a.updated);
  status.textContent = projects.length ? `${projects.length} saved ${projects.length === 1 ? 'project' : 'projects'} found. Download each one you want to keep.` : 'No saved projects found in this browser. Try the device and browser you used before, or open an existing project backup on Xbieha.';
  for (const project of projects) {
    const row = document.createElement('li');
    const label = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = project.name || 'Untitled project';
    const detail = document.createElement('small');
    detail.textContent = `${Array.isArray(project.photos) ? project.photos.length : 0} photos · ${project.mode || 'project'}`;
    label.append(name, detail);
    const link = document.createElement('a');
    const { thumbnail, ...data } = project;
    void thumbnail;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'xbieha-project', version: 1, project: data })], { type: 'application/json' }));
    urls.push(url);
    link.href = url;
    // Keep this static-page rule identical to src/fileName.ts.
    link.download = `${String(project.name || 'project').normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'project'}.xbieha`;
    link.textContent = 'Download backup';
    link.setAttribute('aria-label', `Download backup of ${name.textContent}`);
    row.append(label, link);
    list.append(row);
  }
} catch (error) {
  status.textContent = `${error instanceof Error ? error.message : 'Local storage is unavailable.'} Try the same browser you used to make your projects, with private browsing turned off.`;
}
window.addEventListener('pagehide', event => { if (!event.persisted) for (const url of urls) URL.revokeObjectURL(url); });
