const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('litgraphDesktop', {
  bootstrap: () => ipcRenderer.sendSync('desktop:bootstrap'),
  saveState: state => ipcRenderer.sendSync('desktop:save-state', state),
  saveConfig: config => ipcRenderer.invoke('desktop:save-config', config),
  control: action => ipcRenderer.invoke('desktop:control', action),
  recordUse: action => ipcRenderer.invoke('desktop:use', action),
  setMetricsEnabled: enabled => ipcRenderer.invoke('desktop:metrics', enabled),
  modelRequest: request => ipcRenderer.invoke('desktop:model-request', request),
  cancelModel: id => ipcRenderer.invoke('desktop:model-cancel', id)
});
