const { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");

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
      allowServiceWorkers: false,
    },
  },
]);

// Window state persistence
const WINDOW_STATE_KEY = "lumendust_window_state";
let mainWindow = null;

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
  // Register custom protocol handler to serve local files
  protocol.handle("local-file", (request) => {
    // URL format: local-file:///C:/path/to/file.png
    // or local-file://C:/path/to/file.png
    let filePath = decodeURIComponent(request.url.replace("local-file://", ""));
    // Remove leading slash on Windows paths like /C:/...
    if (process.platform === "win32" && filePath.startsWith("/") && filePath[2] === ":") {
      filePath = filePath.slice(1);
    }
    // On Windows, file:// URLs need three slashes: file:///C:/path
    const fileUrl = process.platform === "win32" 
      ? "file:///" + filePath.replace(/\\/g, "/")
      : "file://" + filePath;
    return net.fetch(fileUrl);
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
    return path.join(app.getPath("userData"), "cache");
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
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
