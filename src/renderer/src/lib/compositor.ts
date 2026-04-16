import type { CompositionConfig } from './config'
import { drawGlitchText, drawDecoderGlitchText, type GlitchState } from './glitch'

export interface FrameInput {
  t: number             // current time in seconds
  glitch: GlitchState
  glitchIntensity: number
  release: ReleaseData
}

export interface ReleaseData {
  artistName: string
  trackName: string
  releaseName: string
}

export interface Assets {
  background: HTMLImageElement | null
  vinylDisc: HTMLImageElement | null
  vinylLabel: HTMLImageElement | null
  textures: (HTMLImageElement | null)[]
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: FrameInput,
  assets: Assets,
  config: CompositionConfig
): void {
  const { width, height } = config.size
  const { t, release, glitchIntensity } = frame

  ctx.clearRect(0, 0, width, height)

  // 1. background
  if (assets.background) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()
    drawImageCover(ctx, assets.background, 0, 0, width, height, config.backgroundScale)
    ctx.restore()
  } else {
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)
  }

  // 2. textures
  drawTextures(ctx, assets, config, width, height)

  // 3. vinyl disc
  drawVinyl(ctx, assets, config, t, width, height)

  // 4. text overlays
  drawText(ctx, frame, release, config, width, height, glitchIntensity, t)

  // 5. canvas-wide noise — constant low level, boosted during glitches
  drawNoise(ctx, width, height, glitchIntensity)

  // 6. fade to black overlay
  if (config.fadeToBlack.enabled && config.fadeToBlack.duration > 0) {
    const fadeStart = config.duration - config.fadeToBlack.duration
    if (t >= fadeStart) {
      const alpha = Math.min(1, (t - fadeStart) / config.fadeToBlack.duration)
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, 0, width, height)
    }
  }
}

// draws an image cover-fitted (no distortion) into dest rect, with optional zoom scale
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  scale: number
): void {
  const imgAspect = img.width / img.height
  const destAspect = destW / destH
  let drawW: number, drawH: number
  if (imgAspect > destAspect) {
    // image is wider — fit by height
    drawH = destH * scale
    drawW = drawH * imgAspect
  } else {
    // image is taller — fit by width
    drawW = destW * scale
    drawH = drawW / imgAspect
  }
  const offsetX = destX + (destW - drawW) / 2
  const offsetY = destY + (destH - drawH) / 2
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
}

function drawTextures(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  config: CompositionConfig,
  w: number,
  h: number
): void {
  for (let i = 0; i < config.textures.length; i++) {
    const tex = config.textures[i]
    const img = assets.textures[i]
    if (!img) continue

    ctx.save()
    ctx.globalAlpha = tex.opacity
    ctx.globalCompositeOperation = tex.blendMode
    ctx.drawImage(img, 0, 0, w, h)
    ctx.restore()
  }
}

function drawVinyl(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  config: CompositionConfig,
  t: number,
  w: number,
  h: number
): void {
  const { cx, cy, radiusFraction, labelRadiusFraction, degreesPerSecond } = config.vinyl
  const centerX = cx * w
  const centerY = cy * h
  const radius = radiusFraction * w
  const angle = (t * degreesPerSecond * Math.PI) / 180

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(angle)

  // clip to circle
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.clip()

  if (assets.vinylDisc) {
    ctx.drawImage(assets.vinylDisc, -radius, -radius, radius * 2, radius * 2)
  } else {
    // fallback: black disc with grooves
    ctx.fillStyle = '#111111'
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
    ctx.strokeStyle = '#222222'
    ctx.lineWidth = 2
    for (let r = radius * 0.15; r < radius; r += 8) {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // vinyl center label (does not rotate relative to disc — both rotate together)
  if (assets.vinylLabel) {
    const lr = radius * labelRadiusFraction
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, lr, 0, Math.PI * 2)
    ctx.clip()
    drawImageCover(ctx, assets.vinylLabel, -lr, -lr, lr * 2, lr * 2, config.vinyl.labelImageScale)
    ctx.restore()
  }

  ctx.restore()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  _frame: FrameInput,
  release: ReleaseData,
  config: CompositionConfig,
  w: number,
  h: number,
  intensity: number,
  t: number
): void {
  const { font, layout, glitch } = config
  const px = (size: number) => `${Math.round(size * (w / 1500))}px`
  const isRevealing = t < glitch.revealDuration
  const decoderProgress = isRevealing ? t / glitch.revealDuration : 1

  const entries: Array<{
    text: string
    pos: typeof layout.labelName
    size: number
    useGlitch: boolean
  }> = [
    { text: config.labelName,      pos: layout.labelName,   size: font.labelSize,   useGlitch: false },
    { text: release.releaseName.toUpperCase(),   pos: layout.releaseName, size: font.releaseSize, useGlitch: false },
    {
      text: `${release.artistName} - ${release.trackName}`.toUpperCase(),
      pos: layout.artistName,
      size: font.artistSize,
      useGlitch: true,
    },
  ]

  for (const entry of entries) {
    const fontStr = `${px(entry.size)} '${font.family}', sans-serif`
    const ex = entry.pos.x * w
    const ey = entry.pos.y * h

    if (entry.useGlitch && isRevealing) {
      drawDecoderGlitchText(
        ctx,
        { text: entry.text, x: ex, y: ey, font: fontStr, color: font.color, align: entry.pos.align, progress: decoderProgress },
        { rgbOffset: glitch.rgbOffset * (w / 1500), glowBlur: glitch.glowBlur * (w / 1500), glowOpacity: glitch.glowOpacity }
      )
    } else {
      drawGlitchText(ctx, {
        text: entry.text,
        x: ex,
        y: ey,
        font: fontStr,
        color: font.color,
        align: entry.pos.align,
        intensity: entry.useGlitch ? intensity : 0,
        rgbOffset: glitch.rgbOffset * (w / 1500),
        glowBlur: glitch.glowBlur * (w / 1500),
        glowOpacity: glitch.glowOpacity,
      })
    }
  }
}

// full-canvas noise grain — uses a tiled ImageData approach for performance
function drawNoise(ctx: CanvasRenderingContext2D, w: number, h: number, glitchIntensity: number): void {
  const tileSize = 256
  const off = document.createElement('canvas')
  off.width = tileSize
  off.height = tileSize
  const offCtx = off.getContext('2d')!
  const imageData = offCtx.createImageData(tileSize, tileSize)
  const data = imageData.data

  // base alpha visible always; extra alpha added during glitch hits
  const baseAlpha = 14
  const extraAlpha = Math.round(glitchIntensity * 52)
  const totalAlpha = baseAlpha + extraAlpha

  // ~10% pixel density — sparse enough to read as grain, not fog
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() > 0.10) continue
    const v = Math.floor(Math.random() * 255)
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = Math.round(totalAlpha * (0.5 + Math.random() * 0.5))
  }

  offCtx.putImageData(imageData, 0, 0)

  ctx.save()
  for (let ty = 0; ty < h; ty += tileSize) {
    for (let tx = 0; tx < w; tx += tileSize) {
      ctx.drawImage(off, tx, ty)
    }
  }
  ctx.restore()
}
