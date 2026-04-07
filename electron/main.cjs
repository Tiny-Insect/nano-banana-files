const { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

function getAppDataRoot() {
  const base = path.join(app.getPath("userData"), "LumenDust Data");
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

function getNamedDataDir(name) {
  const dir = path.join(getAppDataRoot(), name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Register custom protocol for serving local cached files securely
// MUST be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
      standard: true,
      secure: true,
      corsEnabled: true,
    },
  },
]);

// Window state persistence
const WINDOW_STATE_KEY = "lumendust_window_state";
let mainWindow = null;
let updateState = {
  status: "idle",
  message: "",
  version: app.getVersion(),
};

function sendUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", updateState);
  }
}

function loadWindowState() {
  try {
    const stateFile = path.join(app.getPath("userData"), "window-state.json");
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
  } catch {}
  return { width: 1200, height: 800 };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    const stateFile = path.join(app.getPath("userData"), "window-state.json");
    fs.writeFileSync(stateFile, JSON.stringify({ ...bounds, isMaximized }));
  } catch {}
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    updateState = { ...updateState, status: "checking", message: "正在检查更新..." };
    sendUpdateState();
  });

  autoUpdater.on("update-available", (info) => {
    updateState = { ...updateState, status: "available", message: `发现新版本 ${info.version}`, version: info.version };
    sendUpdateState();
  });

  autoUpdater.on("update-not-available", () => {
    updateState = { ...updateState, status: "idle", message: "当前已是最新版本", version: app.getVersion() };
    sendUpdateState();
  });

  autoUpdater.on("download-progress", (progress) => {
    updateState = { ...updateState, status: "downloading", message: `正在下载更新 ${Math.round(progress.percent || 0)}%` };
    sendUpdateState();
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateState = {
      ...updateState,
      status: "downloaded",
      message: `更新已下载完成：${info.version}。点击“安装更新”后，应用会退出并完成安装。`,
      version: info.version,
    };
    sendUpdateState();
  });

  autoUpdater.on("error", (error) => {
    updateState = { ...updateState, status: "error", message: error?.message || "更新失败" };
    sendUpdateState();
  });
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: process.platform === "win32" ? {
      color: "#0a0a0a",
      symbolColor: "#888",
      height: 36,
    } : undefined,
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);
  mainWindow.on("close", saveWindowState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    console.error("[main] did-fail-load:", code, description);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[main] render-process-gone:", details);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  setupAutoUpdater();
  // Register custom protocol handler to serve local files
  // URL format: local-file://serve/<absolute-path>
  protocol.handle("local-file", (request) => {
    try {
      const rawUrl = request.url;
      console.log("[local-file] Request URL:", rawUrl);
      
      // Parse as standard URL: local-file://serve/C:/Users/path/file.png
      const parsed = new URL(rawUrl);
      // pathname will be /C:/Users/path/file.png
      let filePath = decodeURIComponent(parsed.pathname);
      
      // On Windows, pathname starts with /C:/ - remove leading slash
      if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
      
      // Convert forward slashes to OS path separators
      filePath = filePath.replace(/\//g, path.sep);
      
      console.log("[local-file] Resolved path:", filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error("[local-file] File not found:", filePath);
        return new Response("Not found", { status: 404 });
      }
      
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
      const contentType = mimeTypes[ext] || "application/octet-stream";
      
      console.log("[local-file] Serving:", filePath, "type:", contentType, "size:", data.length);
      
      return new Response(data, {
        status: 200,
        headers: { 
          "Content-Type": contentType,
          "Cache-Control": "max-age=3600",
        },
      });
    } catch (e) {
      console.error("[local-file] Error:", e);
      return new Response("Error", { status: 500 });
    }
  });

  // Window control IPC handlers
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow?.close());
  ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle("select-folder", async (_event, title) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: title || "选择文件夹",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("get-cache-path", () => {
    return getAppDataRoot();
  });

  ipcMain.handle("get-app-data-paths", () => {
    return {
      root: getAppDataRoot(),
      chat: getNamedDataDir("chat"),
      thumbnails: getNamedDataDir("thumbnails"),
      originals: getNamedDataDir("originals"),
      downloads: getNamedDataDir("LumenDust Download"),
    };
  });

  ipcMain.handle("update-get-status", () => updateState);
  ipcMain.handle("update-check", async () => {
    await autoUpdater.checkForUpdates();
    return true;
  });
  ipcMain.handle("update-download", async () => {
    await autoUpdater.downloadUpdate();
    return true;
  });
  ipcMain.handle("update-install", () => {
    updateState = {
      ...updateState,
      status: "installing",
      message: "正在退出并安装更新，请稍候...",
    };
    sendUpdateState();
    autoUpdater.quitAndInstall();
    return true;
  });


  ipcMain.handle("fs-write-file", async (_event, filePath, base64Data) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      return true;
    } catch (e) {
      console.error("fs-write-file error:", e);
      return false;
    }
  });

  ipcMain.handle("fs-read-file", async (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath).toString("base64");
    } catch {
      return null;
    }
  });

  ipcMain.handle("fs-delete-file", async (_event, filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs-read-dir", async (_event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath);
    } catch {
      return [];
    }
  });

  ipcMain.handle("fs-get-size", async (_event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) return 0;
      let total = 0;
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fp = path.join(dirPath, file);
        const stat = fs.statSync(fp);
        if (stat.isFile()) total += stat.size;
      }
      return total;
    } catch {
      return 0;
    }
  });

  ipcMain.handle("fs-mkdir", async (_event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  });

  createWindow();

  mainWindow.on("maximize", () => mainWindow.webContents.send("window-maximized"));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window-unmaximized"));
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    sendUpdateState();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
