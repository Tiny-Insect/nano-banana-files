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

  // Folder picker
  selectFolder: (title) => ipcRenderer.invoke("select-folder", title),

  // File system operations for app-local storage
  getCachePath: () => ipcRenderer.invoke("get-cache-path"),
  getAppDataPaths: () => ipcRenderer.invoke("get-app-data-paths"),
  fsWriteFile: (filePath, base64Data) => ipcRenderer.invoke("fs-write-file", filePath, base64Data),
  fsReadFile: (filePath) => ipcRenderer.invoke("fs-read-file", filePath),
  fsDeleteFile: (filePath) => ipcRenderer.invoke("fs-delete-file", filePath),
  fsReadDir: (dirPath) => ipcRenderer.invoke("fs-read-dir", dirPath),
  fsGetSize: (dirPath) => ipcRenderer.invoke("fs-get-size", dirPath),
  fsMkdir: (dirPath) => ipcRenderer.invoke("fs-mkdir", dirPath),
  log: (message) => ipcRenderer.invoke("app-log", message),

  // Auto update
  getUpdateStatus: () => ipcRenderer.invoke("update-get-status"),
  checkForUpdates: () => ipcRenderer.invoke("update-check"),
  downloadUpdate: () => ipcRenderer.invoke("update-download"),
  installUpdate: () => ipcRenderer.invoke("update-install"),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },

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
