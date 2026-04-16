import { useEffect, useRef, useState, useCallback } from 'react'
import type { CompositionConfig } from '../lib/config'
import type { Assets, ReleaseData } from '../lib/compositor'
import { drawFrame } from '../lib/compositor'
import { makeGlitchState, tickGlitch, glitchIntensity } from '../lib/glitch'

interface PreviewCanvasProps {
  config: CompositionConfig
  assets: Assets
  release: ReleaseData
  audioSrc?: string | null
  audioStartTime?: number
}

const WAVEFORM_BARS = 80
const WAVEFORM_CSS_H = 40 // logical px height of the waveform area

function drawWaveform(canvas: HTMLCanvasElement, samples: number[], progress: number, dpr: number) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  const n = samples.length
  const step = w / n
  const barW = step * 0.55

  for (let i = 0; i < n; i++) {
    const x = i * step + (step - barW) / 2
    const barH = Math.max(samples[i] * h * 0.85, 2 * dpr)
    const y = (h - barH) / 2

    // smooth transition: full white behind playhead
    const barCenter = (i + 0.5) / n
    const diff = progress - barCenter
    const t = Math.max(0, Math.min(1, diff * n + 0.5))
    const alpha = 0.15 + 0.75 * t

    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
    ctx.beginPath()
    ctx.roundRect(x, y, barW, barH, Math.min(barW / 2, 3 * dpr))
    ctx.fill()
  }

  // playhead line
  const px = Math.round(progress * w)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(px, 0, Math.ceil(dpr), h)
}

export function PreviewCanvas({ config, assets, release, audioSrc, audioStartTime = 0 }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)
  const glitchRef = useRef(makeGlitchState(config))
  const playingRef = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<number[] | null>(null)
  // cache decoded audio buffer so re-slicing on startTime/duration change doesn't re-decode
  const audioBufCacheRef = useRef<{ src: string; buf: AudioBuffer } | null>(null)
  const dprRef = useRef(window.devicePixelRatio || 1)

  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [hasWaveform, setHasWaveform] = useState(false)

  const duration = config.duration

  // decode (once per src) then slice samples for the audioStartTime..audioStartTime+duration window
  useEffect(() => {
    if (!audioSrc) {
      waveformRef.current = null
      setHasWaveform(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let audioBuf: AudioBuffer
        if (audioBufCacheRef.current?.src === audioSrc) {
          audioBuf = audioBufCacheRef.current.buf
        } else {
          const res = await fetch(audioSrc)
          const ab = await res.arrayBuffer()
          const audioCtx = new AudioContext()
          audioBuf = await audioCtx.decodeAudioData(ab)
          await audioCtx.close()
          if (cancelled) return
          audioBufCacheRef.current = { src: audioSrc, buf: audioBuf }
        }

        // compute samples only for the played window
        const ch = audioBuf.getChannelData(0)
        const totalSamples = ch.length
        const totalDuration = audioBuf.duration
        const startSample = Math.floor((audioStartTime / totalDuration) * totalSamples)
        const endSample = Math.min(
          Math.floor(((audioStartTime + duration) / totalDuration) * totalSamples),
          totalSamples
        )
        const windowLen = Math.max(endSample - startSample, 1)
        const blockSize = Math.max(Math.floor(windowLen / WAVEFORM_BARS), 1)
        const samples: number[] = []
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let sum = 0
          const offset = startSample + i * blockSize
          for (let j = 0; j < blockSize; j++) {
            const idx = offset + j
            if (idx < totalSamples) sum += ch[idx] ** 2
          }
          samples.push(Math.sqrt(sum / blockSize))
        }
        const max = Math.max(...samples, 1e-6)
        if (cancelled) return
        waveformRef.current = samples.map(v => v / max)
        setHasWaveform(true)
      } catch (e) {
        console.warn('[waveform] decode failed:', e)
      }
    })()
    return () => { cancelled = true }
  }, [audioSrc, audioStartTime, duration])

  // size the waveform canvas to match its CSS footprint × dpr for crisp rendering
  useEffect(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas || !hasWaveform) return
    const dpr = dprRef.current
    const cssW = canvas.getBoundingClientRect().width || 600
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(WAVEFORM_CSS_H * dpr)
  }, [hasWaveform])

  // create/destroy audio element when src changes; seek + play once ready
  useEffect(() => {
    if (!audioSrc) {
      audioRef.current?.pause()
      audioRef.current = null
      return
    }
    const audio = new Audio()
    audioRef.current = audio
    audio.src = audioSrc

    const onReady = () => {
      audio.currentTime = audioStartTime + elapsedRef.current
      if (playingRef.current) {
        audio.play().catch((e) => console.error('[audio] play failed:', e))
      }
    }
    audio.addEventListener('canplay', onReady, { once: true })

    return () => {
      audio.removeEventListener('canplay', onReady)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  // intentionally omit audioStartTime — seek happens inside onReady via closure value at creation time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc])

  // seek audio when audioStartTime changes (without recreating the element)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioSrc) return
    audio.currentTime = audioStartTime + elapsedRef.current
    if (playingRef.current) audio.play().catch((e) => console.error('[audio] play failed:', e))
  }, [audioStartTime]) // eslint-disable-line react-hooks/exhaustive-deps

  // reset glitch state when config changes
  useEffect(() => {
    glitchRef.current = makeGlitchState(config)
  }, [config])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function tick(now: number) {
      if (playingRef.current) {
        if (lastTsRef.current !== null) {
          elapsedRef.current += (now - lastTsRef.current) / 1000
        }
        lastTsRef.current = now

        // loop at duration — restart audio too
        if (elapsedRef.current >= duration) {
          elapsedRef.current = elapsedRef.current % duration
          glitchRef.current = makeGlitchState(config)
          const audio = audioRef.current
          if (audio) {
            audio.currentTime = audioStartTime
            audio.play().catch((e) => console.error('[audio] play failed:', e))
          }
        }
      } else {
        lastTsRef.current = null
      }

      const t = elapsedRef.current
      glitchRef.current = tickGlitch(glitchRef.current, t, config)
      const intensity = glitchIntensity(glitchRef.current, t, config)

      drawFrame(ctx, { t, glitch: glitchRef.current, glitchIntensity: intensity, release }, assets, config)

      const p = t / duration
      setProgress(p)

      // update waveform canvas directly in the raf loop — no react re-render
      const wc = waveformCanvasRef.current
      const samples = waveformRef.current
      if (wc && samples) drawWaveform(wc, samples, p, dprRef.current)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [config, assets, release, duration, audioSrc, audioStartTime])

  const togglePlay = useCallback(() => {
    const nowPlaying = !playingRef.current
    playingRef.current = nowPlaying
    setPlaying(nowPlaying)
    const audio = audioRef.current
    if (!audio) return
    if (nowPlaying) {
      audio.currentTime = audioStartTime + elapsedRef.current
      audio.play().catch((e) => console.error('[audio] play failed:', e))
    } else {
      audio.pause()
    }
  }, [audioSrc, audioStartTime])

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    elapsedRef.current = fraction * duration
    glitchRef.current = makeGlitchState(config)
    setProgress(fraction)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = audioStartTime + fraction * duration
      if (playingRef.current) audio.play().catch((e) => console.error('[audio] play failed:', e))
    }
    const wc = waveformCanvasRef.current
    const samples = waveformRef.current
    if (wc && samples) drawWaveform(wc, samples, fraction, dprRef.current)
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <canvas
        ref={canvasRef}
        width={config.size.width}
        height={config.size.height}
        className="w-full flex-1 object-contain min-h-0"
        style={{ imageRendering: 'auto' }}
      />

      <div className="flex items-center gap-3 px-1">
        {/* play/pause button */}
        <button
          onClick={togglePlay}
          className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
        >
          {playing ? (
            // pause icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="0" width="4" height="14" rx="1"/>
              <rect x="9" y="0" width="4" height="14" rx="1"/>
            </svg>
          ) : (
            // play icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="1,0 13,7 1,14"/>
            </svg>
          )}
        </button>

        {/* waveform or plain progress bar */}
        <div
          className="flex-1 relative cursor-pointer group"
          style={{ height: hasWaveform ? WAVEFORM_CSS_H : 4 }}
          onClick={handleSeek}
        >
          {hasWaveform ? (
            <canvas
              ref={waveformCanvasRef}
              className="w-full h-full"
            />
          ) : (
            <>
              <div className="absolute inset-0 rounded-full bg-neutral-800" />
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-white transition-none"
                style={{ width: `${progress * 100}%` }}
              />
            </>
          )}
          {/* scrub handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 pointer-events-none"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        {/* time */}
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
          {fmt(progress * duration)} / {fmt(duration)}
        </span>
      </div>
    </div>
  )
}
