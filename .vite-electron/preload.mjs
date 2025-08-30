import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  sendPostureNotification: (isBadPosture) => ipcRenderer.send('show-posture-notification', isBadPosture),
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});