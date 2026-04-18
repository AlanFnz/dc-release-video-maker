import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readAsDataUrl: (filePath: string) =>
    ipcRenderer.invoke('fs:readAsDataUrl', filePath),

  getAudioDuration: (filePath: string) =>
    ipcRenderer.invoke('audio:getDuration', filePath),

  readAudioBuffer: (filePath: string) =>
    ipcRenderer.invoke('audio:readBuffer', filePath),

  setAppIcon: (buffer: ArrayBuffer) =>
    ipcRenderer.invoke('app:setIcon', buffer),

  onExportProgress: (cb: (progress: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: number) => cb(p)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.removeListener('export:progress', handler)
  },

  saveProject: (data: object, defaultName: string) =>
    ipcRenderer.invoke('project:save', data, defaultName),

  loadProject: () =>
    ipcRenderer.invoke('project:load'),

  openFile: (filters: Electron.FileFilter[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  saveFile: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),

  exportVideo: (
    webmBuffer: ArrayBuffer,
    audioPath: string,
    outputPath: string,
    duration: number,
    audioStartTime: number
  ) => ipcRenderer.invoke('export:video', webmBuffer, audioPath, outputPath, duration, audioStartTime),
})
