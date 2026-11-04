const { contextBridge, ipcRenderer } = require('electron');

// Expose operations, never an unrestricted IPC channel or filesystem API.
contextBridge.exposeInMainWorld('xbiehaDesktop', {
  listProjects: () => ipcRenderer.invoke('library:list'),
  loadProject: id => ipcRenderer.invoke('library:load', id),
  saveProject: project => ipcRenderer.invoke('library:save', project),
  deleteProject: id => ipcRenderer.invoke('library:delete', id),
  loadVideo: () => ipcRenderer.invoke('video:load'),
  saveVideo: manifest => ipcRenderer.invoke('video:save', manifest),
  hasMedia: (id, size) => ipcRenderer.invoke('media:has', id, size),
  beginMedia: (id, size) => ipcRenderer.invoke('media:begin', id, size),
  chooseExport: (name, size) => ipcRenderer.invoke('export:choose', name, size),
  appendTransfer: (token, bytes) => ipcRenderer.invoke('transfer:append', token, bytes),
  finishTransfer: token => ipcRenderer.invoke('transfer:finish', token),
  abortTransfer: token => ipcRenderer.invoke('transfer:abort', token),
  showLibrary: () => ipcRenderer.invoke('library:show'),
  onBeforeClose: callback => {
    const listener = async (_event, request) => {
      try { await callback(); ipcRenderer.send('studio:closed-ready', request, null); }
      catch (error) { ipcRenderer.send('studio:closed-ready', request, error.message || 'Could not save your work.'); }
    };
    ipcRenderer.on('studio:prepare-close', listener);
    return () => ipcRenderer.removeListener('studio:prepare-close', listener);
  },
});
