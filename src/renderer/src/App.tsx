import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { defaultConfig } from './lib/config'
import { loadStaticAssets, loadImageFromPath } from './lib/assets'
import { useExport } from './lib/useExport'
import { generateAppIcon } from './lib/generate-icon'
import { useI18n } from './i18n'
import type { Assets } from './lib/compositor'
import { PreviewCanvas } from './components/preview-canvas'
import { FileField, type FileFilter } from './components/file-field'
import { TextField } from './components/text-field'
import { ExportPanel } from './components/export-panel'

const IMAGE_FILTERS: FileFilter[] = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
]
const AUDIO_FILTERS: FileFilter[] = [
  { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] },
]

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function App() {
  const { t, lang, setLang, languages } = useI18n()
  const baseConfig = defaultConfig

  // form state
  const [artistName, setArtistName] = useState('')
  const [trackName, setTrackName] = useState('')
  const [releaseName, setReleaseName] = useState('')
  const [backgroundPath, setBackgroundPath] = useState<string | null>(null)
  const [vinylLabelPath, setVinylLabelPath] = useState<string | null>(null)
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [audioStartTime, setAudioStartTime] = useState(0)
  const [duration, setDuration] = useState(baseConfig.duration)
  const [bottomFontSize, setBottomFontSize] = useState(baseConfig.font.artistSize)
  const [vinylRadius, setVinylRadius] = useState(baseConfig.vinyl.radiusFraction)
  const [labelRadius, setLabelRadius] = useState(baseConfig.vinyl.labelRadiusFraction)
  const [backgroundScale, setBackgroundScale] = useState(baseConfig.backgroundScale)
  const [labelImageScale, setLabelImageScale] = useState(baseConfig.vinyl.labelImageScale)
  const [fadeEnabled, setFadeEnabled] = useState(baseConfig.fadeToBlack.enabled)
  const [fadeDuration, setFadeDuration] = useState(baseConfig.fadeToBlack.duration)
  const config = useMemo(() => ({
    ...baseConfig,
    duration,
    backgroundScale,
    font: { ...baseConfig.font, artistSize: bottomFontSize },
    vinyl: { ...baseConfig.vinyl, radiusFraction: vinylRadius, labelRadiusFraction: labelRadius, labelImageScale },
    fadeToBlack: { enabled: fadeEnabled, duration: fadeDuration },
  }), [duration, bottomFontSize, vinylRadius, labelRadius, backgroundScale, labelImageScale, fadeEnabled, fadeDuration])

  // loaded assets
  const [staticAssets, setStaticAssets] = useState<Assets | null>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [labelImage, setLabelImage] = useState<HTMLImageElement | null>(null)

  // load static assets once (includes example placeholders)
  useEffect(() => {
    loadStaticAssets()
      .then(setStaticAssets)
      .catch((e) => console.error('failed to load static assets', e))
  }, [])

  // generate and set app icon after fonts load
  useEffect(() => {
    generateAppIcon()
      .then((buf) => window.api.setAppIcon(buf))
      .catch((e) => console.warn('icon generation failed:', e))
  }, [])

  // load background when path changes, fall back to example
  useEffect(() => {
    if (!backgroundPath) { setBgImage(null); return }
    loadImageFromPath(backgroundPath).then(setBgImage).catch(() => setBgImage(null))
  }, [backgroundPath])

  // load vinyl label when path changes, fall back to example
  useEffect(() => {
    if (!vinylLabelPath) { setLabelImage(null); return }
    loadImageFromPath(vinylLabelPath).then(setLabelImage).catch(() => setLabelImage(null))
  }, [vinylLabelPath])

  // probe duration + create blob URL when audio path changes
  useEffect(() => {
    if (!audioPath) { setAudioDuration(null); setAudioBlobUrl(null); return }
    Promise.all([
      window.api.getAudioDuration(audioPath),
      window.api.readAudioBuffer(audioPath),
    ]).then(([d, { buffer, mimeType }]) => {
      setAudioDuration(d)
      setAudioStartTime(0)
      setDuration((prev) => Math.min(prev, Math.floor(d)))
      const blob = new Blob([buffer], { type: mimeType })
      setAudioBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    }).catch(() => { setAudioDuration(null); setAudioBlobUrl(null) })
  }, [audioPath])

  const assets: Assets = useMemo(() => ({
    background: bgImage ?? staticAssets?.background ?? null,
    vinylDisc: staticAssets?.vinylDisc ?? null,
    vinylLabel: labelImage ?? staticAssets?.vinylLabel ?? null,
    textures: staticAssets?.textures ?? [],
  }), [bgImage, labelImage, staticAssets])

  const release = useMemo(() => ({
    artistName: artistName || 'Artist Name',
    trackName: trackName || 'Track Name',
    releaseName: releaseName || 'DUBC000',
  }), [artistName, trackName, releaseName])

  const { state: exportState, startExport, reset } = useExport(config, assets)

  const sidebarRef = useRef<HTMLElement>(null)
  const [atBottom, setAtBottom] = useState(false)
  const checkBottom = useCallback(() => {
    const el = sidebarRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 4)
  }, [])
  useEffect(() => { checkBottom() }, [checkBottom])

  const canExport = Boolean(
    artistName && trackName && releaseName && backgroundPath && vinylLabelPath && audioPath
  )

  function handleExport() {
    if (!audioPath) return
    startExport(release, audioPath, config.duration, audioStartTime)
  }

  // derived slider max values
  const maxStartTime = audioDuration !== null ? Math.max(0, Math.floor(audioDuration) - 1) : 0
  const maxDuration = audioDuration !== null ? Math.floor(audioDuration - audioStartTime) : 600

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ paddingTop: '28px' }}>
      {/* left panel — form */}
      <div className="relative w-72 shrink-0 border-r border-neutral-800">
        {!atBottom && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-950 to-transparent z-10" />
        )}
        <aside ref={sidebarRef} onScroll={checkBottom} className="h-full flex flex-col gap-5 overflow-y-scroll p-5 [scrollbar-width:thin] [scrollbar-color:#404040_transparent]">

          {/* header + language selector */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xs font-medium tracking-widest uppercase text-neutral-400 leading-tight">
              {t('app.title')}
            </h1>
            <div className="flex gap-1 shrink-0">
              {(Object.keys(languages) as (keyof typeof languages)[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  title={languages[l].label}
                  className={`text-base leading-none transition-opacity ${lang === l ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
                >
                  {languages[l].flag}
                </button>
              ))}
            </div>
          </div>

          {/* images */}
          <section className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.images')}</p>
            <FileField
              label={t('field.background')}
              accept={IMAGE_FILTERS}
              value={backgroundPath}
              onChange={setBackgroundPath}
              placeholder={t('placeholder.chooseImage')}
              hint={t('hint.recommended')}
              previewSrc={bgImage?.src ?? null}
              previewShape="square"
            />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.backgroundScale')}</label>
                <span className="text-xs text-neutral-600">{backgroundScale.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.5} max={3.0} step={0.05}
                value={backgroundScale}
                onChange={(e) => setBackgroundScale(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
            <FileField
              label={t('field.vinylLabel')}
              accept={IMAGE_FILTERS}
              value={vinylLabelPath}
              onChange={setVinylLabelPath}
              placeholder={t('placeholder.chooseImage')}
              hint={t('hint.recommended')}
              previewSrc={labelImage?.src ?? null}
              previewShape="circle"
            />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.labelImageScale')}</label>
                <span className="text-xs text-neutral-600">{labelImageScale.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.5} max={3.0} step={0.05}
                value={labelImageScale}
                onChange={(e) => setLabelImageScale(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </section>

          {/* text */}
          <section className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.text')}</p>
            <TextField label={t('field.artist')} value={artistName} onChange={setArtistName} placeholder={t('placeholder.artistName')} />
            <TextField label={t('field.track')} value={trackName} onChange={setTrackName} placeholder={t('placeholder.trackName')} />
            <TextField label={t('field.release')} value={releaseName} onChange={setReleaseName} placeholder={t('placeholder.releaseCode')} />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.bottomTextSize')}</label>
                <span className="text-xs text-neutral-600">{bottomFontSize}</span>
              </div>
              <input
                type="range" min={24} max={80} step={1}
                value={bottomFontSize}
                onChange={(e) => setBottomFontSize(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </section>

          {/* vinyl */}
          <section className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.vinyl')}</p>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.discSize')}</label>
                <span className="text-xs text-neutral-600">{vinylRadius.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.2} max={0.6} step={0.01}
                value={vinylRadius}
                onChange={(e) => setVinylRadius(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.labelSize')}</label>
                <span className="text-xs text-neutral-600">{labelRadius.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.1} max={1.0} step={0.01}
                value={labelRadius}
                onChange={(e) => setLabelRadius(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </section>

          {/* audio */}
          <section className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.audio')}</p>
            <FileField
              label={t('field.soundtrack')}
              accept={AUDIO_FILTERS}
              value={audioPath}
              onChange={setAudioPath}
              placeholder={t('placeholder.uploadAudio')}
            />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.startTime')}</label>
                <span className="text-xs text-neutral-600">
                  {fmtTime(audioStartTime)}{audioDuration !== null ? ` / ${fmtTime(audioDuration)}` : ''}
                </span>
              </div>
              <input
                type="range" min={0} max={maxStartTime} step={1}
                value={audioStartTime}
                disabled={audioDuration === null}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setAudioStartTime(v)
                  setDuration((prev) => Math.min(prev, Math.floor((audioDuration ?? 0) - v)))
                }}
                className="w-full accent-white disabled:opacity-30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.duration')}</label>
                <span className="text-xs text-neutral-600">
                  {fmtTime(duration)}{audioDuration !== null ? ` — ${t('hint.max')} ${fmtTime(maxDuration)}` : ''}
                </span>
              </div>
              <input
                type="range" min={1} max={maxDuration || 600} step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
            {/* fade to black */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-neutral-500">{t('field.fadeToBlack')}</label>
                <button
                  onClick={() => setFadeEnabled(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${fadeEnabled ? 'bg-white' : 'bg-neutral-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${fadeEnabled ? 'translate-x-4 bg-neutral-900' : 'translate-x-0 bg-white'}`} />
                </button>
              </div>
              {fadeEnabled && (
                <div className="flex justify-between items-center gap-2">
                  <input
                    type="range" min={0.5} max={Math.min(10, duration)} step={0.5}
                    value={fadeDuration}
                    onChange={(e) => setFadeDuration(Number(e.target.value))}
                    className="flex-1 accent-white"
                  />
                  <span className="text-xs text-neutral-600 shrink-0">{fadeDuration}s</span>
                </div>
              )}
            </div>
          </section>

          <div className="mt-auto">
            <ExportPanel
              state={exportState}
              canExport={canExport}
              onExport={handleExport}
              onReset={reset}
            />
          </div>
        </aside>
      </div>

      {/* right panel — preview */}
      <main className="flex-1 flex items-center justify-center bg-neutral-950 overflow-hidden p-6">
        {staticAssets ? (
          <PreviewCanvas config={config} assets={assets} release={release} audioSrc={audioBlobUrl} audioStartTime={audioStartTime} />
        ) : (
          <p className="text-neutral-700 text-sm">{t('preview.loading')}</p>
        )}
      </main>
    </div>
  )
}
