const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Window state persistence
const WINDOW_STATE_KEY = "lumendust_window_state";
let mainWindow = null;

function loadWindowState() {
  try {
    const fs = require("fs");
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
    const fs = require("fs");
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
    // Frameless for custom titlebar
    frame: false,
    titleBarStyle: "hidden",
    // macOS: show traffic lights inset
    titleBarOverlay: process.platform === "win32" ? {
      color: "#0a0a0a",
      symbolColor: "#888",
      height: 36,
    } : undefined,
    // Transparent background for seamless look
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Security
      sandbox: true,
    },
    show: false, // show when ready to prevent flash
  });

  // Restore maximized state
  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Show window when content is ready (prevents white flash)
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Save window state on move/resize
  mainWindow.on("resize", saveWindowState);
  mainWindow.on("move", saveWindowState);
  mainWindow.on("close", saveWindowState);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development: use Vite dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// Second instance: focus existing window
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
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

  createWindow();

  // Forward maximize events to renderer
  mainWindow.on("maximize", () => mainWindow.webContents.send("window-maximized"));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window-unmaximized"));
});

// macOS: re-create window when dock icon clicked
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit when all windows closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
