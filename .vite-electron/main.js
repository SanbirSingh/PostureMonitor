import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
app.isQuitting = false;

// Notification state management
let lastNotificationTime = 0;
let notificationCooldown = 30000; // 30 seconds cooldown between notifications
let hasNotifiedThisSession = false;
let isWindowVisible = true;

// Configure Electron flags for WASM support
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false,
      sandbox: false
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Track window visibility
  mainWindow.on('show', () => {
    isWindowVisible = true;
    hasNotifiedThisSession = false; // Reset notification state when window is shown
  });

  mainWindow.on('hide', () => {
    isWindowVisible = false;
  });

  mainWindow.on('minimize', () => {
    isWindowVisible = false;
  });

  mainWindow.on('restore', () => {
    isWindowVisible = true;
    hasNotifiedThisSession = false; // Reset notification state when window is restored
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (app.dock) app.dock.hide();
    }
  });

  createTray();
  setupIPC();
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    
    if (trayIcon.isEmpty()) {
      console.log('Tray icon not found, creating fallback icon');
      const fallbackIcon = nativeImage.createFromBuffer(Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00,
        0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
        0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC,
        0x61, 0x05, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00,
        0x0E, 0xC3, 0x00, 0x00, 0x0E, 0xC3, 0x01, 0xC7, 0x6F, 0xA8, 0x64, 0x00,
        0x00, 0x00, 0x18, 0x49, 0x44, 0x41, 0x54, 0x38, 0x4F, 0x63, 0x60, 0x18,
        0x05, 0xA3, 0x60, 0x14, 0x8C, 0x82, 0x51, 0x30, 0x0A, 0x46, 0xC1, 0x28,
        0x18, 0x05, 0xA3, 0x60, 0x14, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x03,
        0x00, 0x18, 0xFC, 0x07, 0x0C, 0x2B, 0x1E, 0x6D, 0xE6, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]));
      tray = new Tray(fallbackIcon);
    } else {
      tray = new Tray(trayIcon);
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
          hasNotifiedThisSession = false; // Reset when user manually shows app
        }
      },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Posture Monitor');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
        hasNotifiedThisSession = false; // Reset when user manually shows app
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

function setupIPC() {
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });
  
  ipcMain.on('close-window', () => {
    mainWindow.hide();
  });

  ipcMain.on('show-posture-notification', (event, isBadPosture) => {
  if (isBadPosture && Notification.isSupported()) {
    // Remove all the cooldown logic from here since it's now handled in React
    const notification = new Notification({
      title: 'Posture Alert',
      body: '⚠️ You\'re slouching! Sit up straight!',
      silent: false,
    });
    
    notification.show();
    
    notification.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }
});

  if (process.platform === 'win32') {
    app.setAppUserModelId('Posture Monitor');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.setLoginItemSettings({
  openAtLogin: true,
});