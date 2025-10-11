import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readAsDataUrl: (filePath: string) =>
    ipcRenderer.invoke('fs:readAsDataUrl', filePath),

  openFile: (filters: Electron.FileFilter[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),

  saveFile: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName),

  exportVideo: (
    webmBuffer: ArrayBuffer,
    audioPath: string,
    outputPath: string,
    duration: number
  ) => ipcRenderer.invoke('export:video', webmBuffer, audioPath, outputPath, duration),
})
