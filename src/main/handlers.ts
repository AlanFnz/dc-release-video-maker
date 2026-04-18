import { ipcMain, dialog, app, nativeImage, BrowserWindow } from 'electron'
import { join, dirname, extname } from 'path'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'
import Ffmpeg from 'fluent-ffmpeg'

// in packaged builds ffmpeg is extracted to resources/ next to the app.
// the universal build lipo-merges both arch slices into a single ffmpeg binary.
const ffmpegPath = app.isPackaged
  ? join(process.resourcesPath, 'ffmpeg')
  : (ffmpegStatic as string)

Ffmpeg.setFfmpegPath(ffmpegPath)

export function registerHandlers(): void {
  // read a user file and return it as a base64 data url (avoids file:// csp issues)
  ipcMain.handle('fs:readAsDataUrl', (_e, filePath: string) => {
    const buf = readFileSync(filePath)
    const ext = extname(filePath).slice(1).toLowerCase()
    const mime =
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      ext === 'mp3' ? 'audio/mpeg' :
      ext === 'wav' ? 'audio/wav' :
      ext === 'aac' ? 'audio/aac' :
      ext === 'm4a' ? 'audio/mp4' :
      ext === 'flac' ? 'audio/flac' :
      ext === 'ogg' ? 'audio/ogg' :
      'application/octet-stream'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  // set dock/taskbar icon from PNG ArrayBuffer rendered by the renderer canvas
  // also persists to resources/icon.png for electron-builder to pick up
  ipcMain.handle('app:setIcon', (_e, buffer: ArrayBuffer) => {
    const buf = Buffer.from(buffer)
    const img = nativeImage.createFromBuffer(buf)
    if (process.platform === 'darwin') app.dock.setIcon(img)
    BrowserWindow.getAllWindows().forEach((w) => w.setIcon(img))
    // save alongside source so electron-builder uses it on next package run
    if (!app.isPackaged) {
      const iconDest = join(app.getAppPath(), 'resources', 'icon.png')
      try {
        if (!existsSync(dirname(iconDest))) mkdirSync(dirname(iconDest), { recursive: true })
        writeFileSync(iconDest, buf)
      } catch { /* non-fatal */ }
    }
  })

  // read audio file as ArrayBuffer + mimeType so renderer can create a Blob URL
  ipcMain.handle('audio:readBuffer', (_e, filePath: string) => {
    const buf = readFileSync(filePath)
    const ext = extname(filePath).slice(1).toLowerCase()
    const mimeType =
      ext === 'mp3' ? 'audio/mpeg' :
      ext === 'wav' ? 'audio/wav' :
      ext === 'aac' ? 'audio/aac' :
      ext === 'm4a' ? 'audio/mp4' :
      ext === 'flac' ? 'audio/flac' :
      ext === 'ogg' ? 'audio/ogg' :
      'audio/mpeg'
    // slice to get a plain ArrayBuffer (not a Node Buffer's backing store)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    return { buffer: ab, mimeType }
  })

  // probe audio file duration via ffmpeg stderr
  ipcMain.handle('audio:getDuration', (_e, filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, ['-i', filePath])
      let stderr = ''
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', () => {
        const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
        if (!m) { reject(new Error('could not parse audio duration')); return }
        const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
        resolve(secs)
      })
      proc.on('error', reject)
    })
  })

  // open a file picker and return the chosen path
  ipcMain.handle('dialog:openFile', async (_e, filters: Electron.FileFilter[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return canceled ? null : filePaths[0]
  })

  // save project JSON to a user-chosen .dcproject file
  ipcMain.handle('project:save', async (_e, data: object, defaultName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('desktop'), defaultName),
      filters: [{ name: 'DC Project', extensions: ['dcproject'] }],
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, JSON.stringify(data, null, 2))
    return filePath
  })

  // open a .dcproject file and return its parsed contents
  ipcMain.handle('project:load', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'DC Project', extensions: ['dcproject'] }],
    })
    if (canceled || !filePaths[0]) return null
    const content = readFileSync(filePaths[0], 'utf8')
    return JSON.parse(content)
  })

  // open a save dialog and return the chosen path
  ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('desktop'), defaultName),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    })
    return canceled ? null : filePath
  })

  // receives webm buffer + audio path, outputs mp4
  ipcMain.handle(
    'export:video',
    (e, webmBuffer: ArrayBuffer, audioPath: string, outputPath: string, duration: number, audioStartTime: number, fadeEnabled: boolean, fadeDuration: number) => {
      return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
        // write webm to temp file
        const tmp = join(tmpdir(), `vvg-${Date.now()}.webm`)
        try {
          writeFileSync(tmp, Buffer.from(webmBuffer))
          const outDir = dirname(outputPath)
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

          const audioInput = Ffmpeg().input(tmp).input(audioPath)
          if (audioStartTime > 0) audioInput.inputOptions([`-ss ${audioStartTime}`])

          const outputOpts = [
            `-t ${duration}`,
            '-c:v libx264',
            '-preset fast',
            '-crf 18',
            '-pix_fmt yuv420p',
            '-c:a aac',
            '-b:a 320k',
            '-shortest',
            '-movflags +faststart',
          ]
          if (fadeEnabled && fadeDuration > 0) {
            const fadeStart = Math.max(0, duration - fadeDuration)
            outputOpts.push(`-af afade=t=out:st=${fadeStart}:d=${fadeDuration}`)
          }

          const cmd = audioInput
            .outputOptions(outputOpts)
            .output(outputPath)
            .on('progress', (info) => {
              // parse timemark "HH:MM:SS.ss" → progress 0–1
              if (info.timemark) {
                const parts = info.timemark.split(':')
                const secs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
                const p = Math.min(secs / duration, 1)
                e.sender.send('export:progress', p)
              }
            })
            .on('end', () => {
              if (existsSync(tmp)) unlinkSync(tmp)
              resolve({ ok: true })
            })
            .on('error', (err) => {
              if (existsSync(tmp)) unlinkSync(tmp)
              resolve({ ok: false, error: err.message })
            })

          cmd.run()
        } catch (err) {
          if (existsSync(tmp)) unlinkSync(tmp)
          resolve({ ok: false, error: String(err) })
        }
      })
    }
  )
}
