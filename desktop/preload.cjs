const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('litgraphDesktop', {
  bootstrap: () => ipcRenderer.sendSync('desktop:bootstrap'),
  saveState: state => ipcRenderer.sendSync('desktop:save-state', state),
  saveConfig: config => ipcRenderer.invoke('desktop:save-config', config),
  deleteConfig: () => ipcRenderer.invoke('desktop:delete-config'),
  resetSettings: state => ipcRenderer.invoke('desktop:reset-settings', state),
  copyText: text => ipcRenderer.invoke('desktop:copy-text', text),
  institution: (action,data) => ipcRenderer.invoke('desktop:institution',action,data),
  onInstitutionDownload: callback => {
    const listener=()=>callback();
    ipcRenderer.on('desktop:institution-download',listener);
    return ()=>ipcRenderer.removeListener('desktop:institution-download',listener);
  },
  agentRuntime: (action,data) => ipcRenderer.invoke('desktop:agent-runtime',action,data),
  control: action => ipcRenderer.invoke('desktop:control', action),
  recordUse: action => ipcRenderer.invoke('desktop:use', action),
  setMetricsEnabled: enabled => ipcRenderer.invoke('desktop:metrics', enabled),
  modelRequest: request => ipcRenderer.invoke('desktop:model-request', request),
  cancelModel: id => ipcRenderer.invoke('desktop:model-cancel', id)
});
