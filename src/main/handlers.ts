import { ipcMain, dialog, app } from 'electron'
import { join, dirname, extname } from 'path'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import ffmpegStatic from 'ffmpeg-static'
import Ffmpeg from 'fluent-ffmpeg'

if (ffmpegStatic) Ffmpeg.setFfmpegPath(ffmpegStatic)

export function registerHandlers(): void {
  // read a user file and return it as a base64 data url (avoids file:// csp issues)
  ipcMain.handle('fs:readAsDataUrl', (_e, filePath: string) => {
    const buf = readFileSync(filePath)
    const ext = extname(filePath).slice(1).toLowerCase()
    const mime =
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      'application/octet-stream'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  // open a file picker and return the chosen path
  ipcMain.handle('dialog:openFile', async (_e, filters: Electron.FileFilter[]) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    return canceled ? null : filePaths[0]
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
    (_e, webmBuffer: ArrayBuffer, audioPath: string, outputPath: string, duration: number) => {
      return new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
        // write webm to temp file
        const tmp = join(tmpdir(), `vvg-${Date.now()}.webm`)
        try {
          writeFileSync(tmp, Buffer.from(webmBuffer))
          const outDir = dirname(outputPath)
          if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

          const cmd = Ffmpeg()
            .input(tmp)
            .input(audioPath)
            .outputOptions([
              `-t ${duration}`,
              '-c:v libx264',
              '-preset fast',
              '-crf 18',
              '-pix_fmt yuv420p',
              '-c:a aac',
              '-b:a 320k',
              '-shortest',
              '-movflags +faststart',
            ])
            .output(outputPath)
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
