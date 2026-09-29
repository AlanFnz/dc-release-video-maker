import { useState, useEffect, useMemo, useRef } from 'react'
import { defaultConfig } from './lib/config'
import { loadStaticAssets, loadImageFromPath, loadFontFromPath } from './lib/assets'
import { useExport, type ProjectData } from './lib/useExport'
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
const FONT_FILTERS: FileFilter[] = [
  { name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] },
]

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    // h-full lets the scroll container below resolve its own h-full against the window height;
    // without it this wrapper sizes to its content and the sidebar never scrolls.
    <div className="relative w-60 shrink-0 h-full">
      <div
        className="h-full overflow-y-auto flex flex-col p-5 gap-0 [scrollbar-width:thin] [scrollbar-color:#404040_transparent]"
        // fade height must stay within the bottom padding + spacer (44px) so the last field is fully opaque when scrolled to the end
        style={{ maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)' }}
      >
        {children}
        <div className="shrink-0 h-6" />
      </div>
    </div>
  )
}

function SidebarGroup({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <>
      {!first && <div className="border-t border-neutral-800 -mx-5 my-4" />}
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </>
  )
}

function SliderField({ label, value, min, max, step, onChange, display, disabled }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <label className="text-xs uppercase tracking-widest text-neutral-500">{label}</label>
        <span className="text-xs text-neutral-600">{display ?? value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white disabled:opacity-30"
      />
    </div>
  )
}

export default function App() {
  const { t, lang, setLang, languages } = useI18n()
  const baseConfig = defaultConfig

  // release content
  const [artistName, setArtistName] = useState('')
  const [trackName, setTrackName] = useState('')
  const [releaseName, setReleaseName] = useState('')
  const [backgroundPath, setBackgroundPath] = useState<string | null>(null)
  const [vinylLabelPath, setVinylLabelPath] = useState<string | null>(null)

  // visual settings
  const [backgroundScale, setBackgroundScale] = useState(baseConfig.backgroundScale)
  const [labelImageScale, setLabelImageScale] = useState(baseConfig.vinyl.labelImageScale)
  const [bottomFontSize, setBottomFontSize] = useState(baseConfig.font.artistSize)
  const [vinylRadius, setVinylRadius] = useState(baseConfig.vinyl.radiusFraction)
  const [labelRadius, setLabelRadius] = useState(baseConfig.vinyl.labelRadiusFraction)

  // logo (image replaces the text when set) and font
  const [logoText, setLogoText] = useState(baseConfig.labelName)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(baseConfig.logo.size)
  const [logoX, setLogoX] = useState(baseConfig.logo.x)
  const [logoY, setLogoY] = useState(baseConfig.logo.y)
  const [fontPath, setFontPath] = useState<string | null>(null)
  const [fontFamily, setFontFamily] = useState<string | null>(null)
  const [fontError, setFontError] = useState(false)
  const fontFaceRef = useRef<FontFace | null>(null)

  // audio settings
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [audioStartTime, setAudioStartTime] = useState(0)
  const [duration, setDuration] = useState(baseConfig.duration)
  const [fadeEnabled, setFadeEnabled] = useState(baseConfig.fadeToBlack.enabled)
  const [fadeDuration, setFadeDuration] = useState(baseConfig.fadeToBlack.duration)

  const config = useMemo(() => ({
    ...baseConfig,
    labelName: logoText,
    duration,
    backgroundScale,
    font: { ...baseConfig.font, family: fontFamily ?? baseConfig.font.family, artistSize: bottomFontSize },
    vinyl: { ...baseConfig.vinyl, radiusFraction: vinylRadius, labelRadiusFraction: labelRadius, labelImageScale },
    logo: { size: logoSize, x: logoX, y: logoY },
    fadeToBlack: { enabled: fadeEnabled, duration: fadeDuration },
  }), [logoText, duration, bottomFontSize, fontFamily, vinylRadius, labelRadius, backgroundScale, labelImageScale, logoSize, logoX, logoY, fadeEnabled, fadeDuration])

  // loaded assets
  const [staticAssets, setStaticAssets] = useState<Assets | null>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [labelImage, setLabelImage] = useState<HTMLImageElement | null>(null)
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    loadStaticAssets().then(setStaticAssets).catch((e) => console.error('failed to load static assets', e))
  }, [])

  useEffect(() => {
    if (!backgroundPath) { setBgImage(null); return }
    loadImageFromPath(backgroundPath).then(setBgImage).catch(() => setBgImage(null))
  }, [backgroundPath])

  useEffect(() => {
    if (!vinylLabelPath) { setLabelImage(null); return }
    loadImageFromPath(vinylLabelPath).then(setLabelImage).catch(() => setLabelImage(null))
  }, [vinylLabelPath])

  useEffect(() => {
    if (!logoPath) { setLogoImage(null); return }
    loadImageFromPath(logoPath).then(setLogoImage).catch(() => setLogoImage(null))
  }, [logoPath])

  // register the chosen font with the document (canvas can only use registered fonts).
  // the previous face is dropped only once the new one is ready, so text never flashes a fallback font.
  useEffect(() => {
    let cancelled = false
    const drop = () => {
      if (fontFaceRef.current) document.fonts.delete(fontFaceRef.current)
      fontFaceRef.current = null
    }
    setFontError(false)
    if (!fontPath) { drop(); setFontFamily(null); return }
    loadFontFromPath(fontPath)
      .then(({ face, family }) => {
        if (cancelled) return
        drop()
        document.fonts.add(face)
        fontFaceRef.current = face
        setFontFamily(family)
      })
      .catch(() => {
        if (cancelled) return
        drop()
        setFontFamily(null)
        setFontError(true)
      })
    return () => { cancelled = true }
  }, [fontPath])

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
    logo: logoImage,
    textures: staticAssets?.textures ?? [],
  }), [bgImage, labelImage, logoImage, staticAssets])

  const release = useMemo(() => ({
    artistName: artistName || 'Artist Name',
    trackName: trackName || 'Track Name',
    releaseName: releaseName || 'DUBC000',
  }), [artistName, trackName, releaseName])

  const { state: exportState, startExport, reset } = useExport(config, assets)

  const canExport = Boolean(artistName && trackName && releaseName && backgroundPath && vinylLabelPath && audioPath)

  function handleExport() {
    if (!audioPath) return
    startExport(release, audioPath, config.duration, audioStartTime, fadeEnabled, fadeDuration)
  }

  function handleNew() {
    setArtistName('')
    setTrackName('')
    setReleaseName('')
    setBackgroundPath(null)
    setVinylLabelPath(null)
    setAudioPath(null)
    setBackgroundScale(baseConfig.backgroundScale)
    setLabelImageScale(baseConfig.vinyl.labelImageScale)
    setBottomFontSize(baseConfig.font.artistSize)
    setVinylRadius(baseConfig.vinyl.radiusFraction)
    setLabelRadius(baseConfig.vinyl.labelRadiusFraction)
    setLogoText(baseConfig.labelName)
    setLogoPath(null)
    setLogoSize(baseConfig.logo.size)
    setLogoX(baseConfig.logo.x)
    setLogoY(baseConfig.logo.y)
    setFontPath(null)
    setAudioStartTime(0)
    setDuration(baseConfig.duration)
    setFadeEnabled(baseConfig.fadeToBlack.enabled)
    setFadeDuration(baseConfig.fadeToBlack.duration)
  }

  async function handleSave() {
    const data: ProjectData = {
      version: 1,
      artistName, trackName, releaseName,
      backgroundPath, vinylLabelPath, audioPath,
      backgroundScale, labelImageScale, bottomFontSize,
      vinylRadius, labelRadius,
      audioStartTime, duration,
      fadeEnabled, fadeDuration,
      logoText, logoPath, logoSize, logoX, logoY, fontPath,
    }
    const name = releaseName ? `${releaseName}.dcproject` : 'project.dcproject'
    await window.api.saveProject(data, name)
  }

  async function handleLoad() {
    const data = await window.api.loadProject()
    if (!data) return
    setArtistName(data.artistName ?? '')
    setTrackName(data.trackName ?? '')
    setReleaseName(data.releaseName ?? '')
    setBackgroundPath(data.backgroundPath ?? null)
    setVinylLabelPath(data.vinylLabelPath ?? null)
    setAudioPath(data.audioPath ?? null)
    setBackgroundScale(data.backgroundScale ?? 1)
    setLabelImageScale(data.labelImageScale ?? 1)
    setBottomFontSize(data.bottomFontSize ?? 58)
    setVinylRadius(data.vinylRadius ?? 0.45)
    setLabelRadius(data.labelRadius ?? 1)
    setLogoText(data.logoText ?? baseConfig.labelName)
    setLogoPath(data.logoPath ?? null)
    setLogoSize(data.logoSize ?? baseConfig.logo.size)
    setLogoX(data.logoX ?? baseConfig.logo.x)
    setLogoY(data.logoY ?? baseConfig.logo.y)
    setFontPath(data.fontPath ?? null)
    setAudioStartTime(data.audioStartTime ?? 0)
    setDuration(data.duration ?? 60)
    setFadeEnabled(data.fadeEnabled ?? false)
    setFadeDuration(data.fadeDuration ?? 2)
  }

  const maxStartTime = audioDuration !== null ? Math.max(0, Math.floor(audioDuration) - 1) : 0
  const maxDuration = audioDuration !== null ? Math.floor(audioDuration - audioStartTime) : 600

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950" style={{ paddingTop: '28px' }}>
      {/* drag region for frameless window — must be explicit on macOS hiddenInset */}
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: 28, WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* left sidebar — content */}
      <div className="border-r border-neutral-800">
        <Sidebar>
          {/* header */}
          <SidebarGroup first>
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
          </SidebarGroup>

          {/* images */}
          <SidebarGroup>
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
            <SliderField
              label={t('field.backgroundScale')}
              value={backgroundScale} min={0.5} max={3.0} step={0.05}
              display={backgroundScale.toFixed(2)}
              onChange={setBackgroundScale}
            />
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
            <SliderField
              label={t('field.labelImageScale')}
              value={labelImageScale} min={0.5} max={3.0} step={0.05}
              display={labelImageScale.toFixed(2)}
              onChange={setLabelImageScale}
            />
          </SidebarGroup>

          {/* logo — the image replaces the text when set */}
          <SidebarGroup>
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.logo')}</p>
            <TextField
              label={t('field.logoText')}
              value={logoText}
              onChange={setLogoText}
              placeholder={t('placeholder.logoText')}
              disabled={logoImage !== null}
            />
            <FileField
              label={t('field.logoImage')}
              accept={IMAGE_FILTERS}
              value={logoPath}
              onChange={setLogoPath}
              onClear={() => setLogoPath(null)}
              clearLabel={t('field.clear')}
              placeholder={t('placeholder.chooseImage')}
              hint={logoImage ? t('hint.logoReplacesText') : undefined}
              previewSrc={logoImage?.src ?? null}
              previewShape="square"
            />
            <SliderField
              label={t('field.logoSize')}
              value={logoSize} min={0.05} max={0.6} step={0.01}
              display={logoSize.toFixed(2)}
              disabled={logoImage === null}
              onChange={setLogoSize}
            />
            <SliderField
              label={t('field.logoX')}
              value={logoX} min={0} max={0.95} step={0.005}
              display={logoX.toFixed(3)}
              disabled={logoImage === null}
              onChange={setLogoX}
            />
            <SliderField
              label={t('field.logoY')}
              value={logoY} min={0} max={0.95} step={0.005}
              display={logoY.toFixed(3)}
              disabled={logoImage === null}
              onChange={setLogoY}
            />
          </SidebarGroup>

          {/* text */}
          <SidebarGroup>
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.text')}</p>
            <TextField label={t('field.artist')} value={artistName} onChange={setArtistName} placeholder={t('placeholder.artistName')} />
            <TextField label={t('field.track')} value={trackName} onChange={setTrackName} placeholder={t('placeholder.trackName')} />
            <TextField label={t('field.release')} value={releaseName} onChange={setReleaseName} placeholder={t('placeholder.releaseCode')} />
            <SliderField
              label={t('field.bottomTextSize')}
              value={bottomFontSize} min={24} max={80} step={1}
              onChange={setBottomFontSize}
            />
            <FileField
              label={t('field.font')}
              accept={FONT_FILTERS}
              value={fontPath}
              onChange={setFontPath}
              onClear={() => setFontPath(null)}
              clearLabel={t('field.clear')}
              placeholder={t('placeholder.chooseFont')}
              hint={fontPath ? undefined : t('hint.fontDefault')}
            />
            {fontError && <p className="text-xs text-red-400">{t('error.font')}</p>}
            {fontPath && (
              <button
                onClick={() => setFontPath(null)}
                className="self-start text-left text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300 transition-colors"
              >
                {t('action.resetFont')}
              </button>
            )}
          </SidebarGroup>
        </Sidebar>
      </div>

      {/* center — preview + export */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center overflow-hidden p-6 min-h-0">
          {staticAssets ? (
            <PreviewCanvas config={config} assets={assets} release={release} audioSrc={audioBlobUrl} audioStartTime={audioStartTime} />
          ) : (
            <p className="text-neutral-700 text-sm">{t('preview.loading')}</p>
          )}
        </div>
        <div className="shrink-0 border-t border-neutral-800 px-6 py-4 flex items-center gap-4">
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleNew}
              className="rounded border border-neutral-700 text-neutral-400 text-sm py-2 px-3 hover:border-neutral-500 transition-colors"
            >
              {t('project.new')}
            </button>
            <button
              onClick={handleSave}
              className="rounded border border-neutral-700 text-neutral-400 text-sm py-2 px-3 hover:border-neutral-500 transition-colors"
            >
              {t('project.save')}
            </button>
            <button
              onClick={handleLoad}
              className="rounded border border-neutral-700 text-neutral-400 text-sm py-2 px-3 hover:border-neutral-500 transition-colors"
            >
              {t('project.load')}
            </button>
          </div>
          <div className="w-px self-stretch bg-neutral-800 shrink-0" />
          <div className="flex-1">
            <ExportPanel
              state={exportState}
              canExport={canExport}
              onExport={handleExport}
              onReset={reset}
            />
          </div>
        </div>
      </main>

      {/* right sidebar — settings */}
      <div className="border-l border-neutral-800">
        <Sidebar>
          {/* vinyl */}
          <SidebarGroup first>
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.vinyl')}</p>
            <SliderField
              label={t('field.discSize')}
              value={vinylRadius} min={0.2} max={0.6} step={0.01}
              display={vinylRadius.toFixed(2)}
              onChange={setVinylRadius}
            />
            <SliderField
              label={t('field.labelSize')}
              value={labelRadius} min={0.1} max={1.0} step={0.01}
              display={labelRadius.toFixed(2)}
              onChange={setLabelRadius}
            />
          </SidebarGroup>

          {/* audio */}
          <SidebarGroup>
            <p className="text-xs uppercase tracking-widest text-neutral-600">{t('section.audio')}</p>
            <FileField
              label={t('field.soundtrack')}
              accept={AUDIO_FILTERS}
              value={audioPath}
              onChange={setAudioPath}
              placeholder={t('placeholder.uploadAudio')}
            />
            <SliderField
              label={t('field.startTime')}
              value={audioStartTime} min={0} max={maxStartTime} step={1}
              display={`${fmtTime(audioStartTime)}${audioDuration !== null ? ` / ${fmtTime(audioDuration)}` : ''}`}
              disabled={audioDuration === null}
              onChange={(v) => {
                setAudioStartTime(v)
                setDuration((prev) => Math.min(prev, Math.floor((audioDuration ?? 0) - v)))
              }}
            />
            <SliderField
              label={t('field.duration')}
              value={duration} min={1} max={maxDuration || 600} step={1}
              display={`${fmtTime(duration)}${audioDuration !== null ? ` — ${t('hint.max')} ${fmtTime(maxDuration)}` : ''}`}
              onChange={setDuration}
            />
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
          </SidebarGroup>
        </Sidebar>
      </div>

    </div>
  )
}
