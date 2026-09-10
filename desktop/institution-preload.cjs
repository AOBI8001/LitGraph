const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('institutionControls',{
  act:(action,value)=>ipcRenderer.invoke('institution:navigate',action,value),
  listen:callback=>ipcRenderer.on('institution:state',(_event,state)=>callback(state))
});
