// Isolated renderer for DOM-adapter tests. Never loads LitGraph's installed profile.
const {app, BrowserWindow} = require('electron');
app.setPath('userData', process.env.LITGRAPH_DOM_TEST_DATA);
app.whenReady().then(() => {
  const window = new BrowserWindow({show: false, width: 1200, height: 900, webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false}});
  window.loadURL('about:blank');
});
