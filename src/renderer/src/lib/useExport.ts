import { useRef, useState, useCallback } from 'react'
import type { CompositionConfig } from './config'
import type { Assets } from './compositor'
import type { ReleaseData } from './compositor'
import { drawFrame } from './compositor'
import { makeGlitchState, tickGlitch, glitchIntensity } from './glitch'

export type ExportStatus = 'idle' | 'recording' | 'encoding' | 'done' | 'error'

export interface ExportState {
  status: ExportStatus
  progress: number   // 0–1
  error: string | null
}

interface FileFilter { name: string; extensions: string[] }

export interface ProjectData {
  version: 1
  artistName: string
  trackName: string
  releaseName: string
  backgroundPath: string | null
  vinylLabelPath: string | null
  audioPath: string | null
  backgroundScale: number
  labelImageScale: number
  bottomFontSize: number
  vinylRadius: number
  labelRadius: number
  audioStartTime: number
  duration: number
  fadeEnabled: boolean
  fadeDuration: number
}

declare global {
  interface Window {
    api: {
      readAsDataUrl: (filePath: string) => Promise<string>
      getAudioDuration: (filePath: string) => Promise<number>
      readAudioBuffer: (filePath: string) => Promise<{ buffer: ArrayBuffer; mimeType: string }>
      setAppIcon: (buffer: ArrayBuffer) => Promise<void>
      saveProject: (data: object, defaultName: string) => Promise<string | null>
      loadProject: () => Promise<ProjectData | null>
      openFile: (filters: FileFilter[]) => Promise<string | null>
      saveFile: (defaultName: string) => Promise<string | null>
      exportVideo: (
        webmBuffer: ArrayBuffer,
        audioPath: string,
        outputPath: string,
        duration: number,
        audioStartTime: number
      ) => Promise<{ ok: true } | { ok: false; error: string }>
      onExportProgress: (cb: (progress: number) => void) => () => void
    }
  }
}

export function useExport(config: CompositionConfig, assets: Assets) {
  const [state, setState] = useState<ExportState>({ status: 'idle', progress: 0, error: null })
  const abortRef = useRef(false)

  const startExport = useCallback(
    async (release: ReleaseData, audioPath: string, duration: number, audioStartTime: number) => {
      abortRef.current = false
      setState({ status: 'recording', progress: 0, error: null })

      try {
        // ask user where to save
        const safeName = `${release.artistName} - ${release.trackName}`
          .replace(/[^\w\s-]/g, '')
          .trim()
        const outputPath = await window.api.saveFile(`${safeName}.mp4`)
        if (!outputPath) {
          setState({ status: 'idle', progress: 0, error: null })
          return
        }

        const { width, height } = config.size
        const fps = config.fps

        // offscreen canvas for rendering
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!

        // capture stream and record
        const stream = canvas.captureStream(fps)
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 25_000_000,
        })

        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

        recorder.start(100)  // collect chunks every 100ms

        // animate frame by frame driven by real time
        let glitchSt = makeGlitchState(config)
        const startTime = performance.now()
        let lastProgressUpdate = 0

        await new Promise<void>((resolve) => {
          function tick(): void {
            if (abortRef.current) { recorder.stop(); resolve(); return }

            const now = performance.now()
            const t = (now - startTime) / 1000

            // throttle state updates to ~10/s so React can keep up
            if (now - lastProgressUpdate >= 100) {
              lastProgressUpdate = now
              setState((s) => ({ ...s, progress: Math.min(t / duration, 1) }))
            }

            glitchSt = tickGlitch(glitchSt, t, config)
            const intensity = glitchIntensity(glitchSt, t, config)

            drawFrame(ctx, { t, glitch: glitchSt, glitchIntensity: intensity, release }, assets, config)

            if (t >= duration) {
              recorder.stop()
              resolve()
            } else {
              requestAnimationFrame(tick)
            }
          }
          requestAnimationFrame(tick)
        })

        if (abortRef.current) {
          setState({ status: 'idle', progress: 0, error: null })
          return
        }

        // wait for recorder to flush
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve()
        })

        setState({ status: 'encoding', progress: 0, error: null })

        // collect webm blob → ArrayBuffer
        const blob = new Blob(chunks, { type: 'video/webm' })
        const webmBuffer = await blob.arrayBuffer()

        // subscribe to ffmpeg encoding progress
        const unsubProgress = window.api.onExportProgress((p) => {
          setState((s) => s.status === 'encoding' ? { ...s, progress: p } : s)
        })

        // hand off to main process for ffmpeg muxing
        const result = await window.api.exportVideo(webmBuffer, audioPath, outputPath, duration, audioStartTime)
        unsubProgress()

        if (result.ok) {
          setState({ status: 'done', progress: 1, error: null })
        } else {
          setState({ status: 'error', progress: 0, error: result.error })
        }
      } catch (err) {
        setState({ status: 'error', progress: 0, error: String(err) })
      }
    },
    [config, assets]
  )

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ status: 'idle', progress: 0, error: null })
  }, [])

  return { state, startExport, reset }
}
