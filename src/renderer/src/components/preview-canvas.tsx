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

export function PreviewCanvas({ config, assets, release, audioSrc, audioStartTime = 0 }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const lastTsRef = useRef<number | null>(null)
  const glitchRef = useRef(makeGlitchState(config))
  const playingRef = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)

  const duration = config.duration

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
      setProgress(t / duration)

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

        {/* progress bar */}
        <div
          className="flex-1 h-1 rounded-full bg-neutral-800 cursor-pointer group relative"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full bg-white transition-none"
            style={{ width: `${progress * 100}%` }}
          />
          {/* scrub handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
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
