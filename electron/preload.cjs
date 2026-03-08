const { contextBridge, ipcRenderer } = require("electron");

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Window controls (for custom titlebar)
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),

  // Listen for maximize/unmaximize events
  onMaximizeChange: (callback) => {
    ipcRenderer.on("window-maximized", () => callback(true));
    ipcRenderer.on("window-unmaximized", () => callback(false));
    return () => {
      ipcRenderer.removeAllListeners("window-maximized");
      ipcRenderer.removeAllListeners("window-unmaximized");
    };
  },
});
