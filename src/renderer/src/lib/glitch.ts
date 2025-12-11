import type { CompositionConfig } from './config'

export interface GlitchState {
  nextGlitchAt: number
  glitchStartedAt: number | null
  glitchDuration: number
}

export function makeGlitchState(config: CompositionConfig): GlitchState {
  return {
    nextGlitchAt: config.glitch.revealDuration + randomBetween(config.glitch.intervalMin, config.glitch.intervalMax),
    glitchStartedAt: null,
    glitchDuration: 0,
  }
}

export function tickGlitch(state: GlitchState, t: number, config: CompositionConfig): GlitchState {
  let { nextGlitchAt, glitchStartedAt, glitchDuration } = state

  if (glitchStartedAt !== null && t > glitchStartedAt + glitchDuration) {
    glitchStartedAt = null
  }

  if (glitchStartedAt === null && t >= nextGlitchAt) {
    glitchStartedAt = t
    glitchDuration = randomBetween(0.22, 0.42)
    nextGlitchAt = t + randomBetween(config.glitch.intervalMin, config.glitch.intervalMax)
  }

  return { nextGlitchAt, glitchStartedAt, glitchDuration }
}

// returns 0–1 — 0 during reveal phase (decoder handles it internally)
export function glitchIntensity(state: GlitchState, t: number, config: CompositionConfig): number {
  if (t < config.glitch.revealDuration) return 0

  if (state.glitchStartedAt !== null) {
    const progress = (t - state.glitchStartedAt) / state.glitchDuration
    return progress < 0.5 ? progress * 2 : (1 - progress) * 2
  }

  return 0
}

// ─── decoder + glitch combined ────────────────────────────────────────────────

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&?<>[]{}|/\\'

export interface DecoderTextOptions {
  text: string
  x: number
  y: number
  font: string
  color: string
  align: CanvasTextAlign
  progress: number  // 0 = fully scrambled, 1 = fully revealed
}

export interface GlitchParams {
  rgbOffset: number
  glowBlur: number
  glowOpacity: number
}

// draws decoder text with rgb-split + slice glitch mixed in.
// glitch intensity is derived from progress: strong when scrambling, fades as text locks in.
export function drawDecoderGlitchText(
  ctx: CanvasRenderingContext2D,
  opts: DecoderTextOptions,
  glitch: GlitchParams
): void {
  const { text, x, y, font, color, align, progress } = opts
  const { rgbOffset, glowBlur, glowOpacity } = glitch

  // three sharp spikes spread through the reveal — snappy, not continuous
  const intensity = revealSpikeIntensity(progress)

  // measure each character using the final char so layout stays stable
  ctx.save()
  ctx.font = font
  const chars = Array.from(text)
  const widths = chars.map(c => ctx.measureText(c).width)
  ctx.restore()

  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const fontSize = parseFloat(font)
  const textHeight = fontSize * 1.5
  const baseline = fontSize * 1.15
  const pad = Math.ceil(rgbOffset * 4)
  const offW = Math.ceil(totalWidth) + pad * 2
  const offH = Math.ceil(textHeight) + pad * 2

  // starting x of the text run within the offscreen canvas
  let curX: number
  if (align === 'left') curX = pad
  else if (align === 'center') curX = offW / 2 - totalWidth / 2
  else curX = offW - pad - totalWidth
  const textY = pad + baseline

  // render decoder frame to offscreen
  const off = document.createElement('canvas')
  off.width = offW
  off.height = offH
  const offCtx = off.getContext('2d')!
  offCtx.font = font
  offCtx.fillStyle = color
  offCtx.textBaseline = 'alphabetic'
  offCtx.textAlign = 'left'

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === ' ') { curX += widths[i]; continue }

    const lockAt = i / chars.length
    const isLocked = progress >= lockAt + (1 / chars.length)

    let drawChar: string
    let alpha: number
    if (isLocked) {
      drawChar = ch
      alpha = 1
    } else {
      drawChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      alpha = 0.35 + 0.3 * progress
    }

    offCtx.globalAlpha = alpha
    offCtx.fillText(drawChar, curX, textY)
    curX += widths[i]
  }

  // top-left of offscreen in main canvas space
  let destX: number
  if (align === 'left') destX = x - pad
  else if (align === 'center') destX = x - offW / 2
  else destX = x - totalWidth - pad
  const destY = y - textY

  const rgbShift = rgbOffset * intensity * 3.5
  const rgbVShift = rgbOffset * intensity * 1.2
  const sliceJitter = rgbOffset * intensity * 2.2

  if (intensity > 0.02) applyNoise(off, intensity)

  // glow
  if (intensity > 0.02) {
    ctx.save()
    ctx.globalAlpha = glowOpacity * intensity
    ctx.shadowColor = color
    ctx.shadowBlur = glowBlur * intensity * 1.4
    ctx.drawImage(off, destX, destY)
    ctx.restore()

    // rgb channels — horizontal + vertical offset
    drawSliced(ctx, tintCanvas(off, '#ff2200'), destX - rgbShift, destY - rgbVShift, intensity, sliceJitter, 'screen', 0.5)
    drawSliced(ctx, tintCanvas(off, '#0044ff'), destX + rgbShift, destY + rgbVShift, intensity, sliceJitter, 'screen', 0.5)
  }

  // base text — still slice-jittered while glitching, stable once revealed
  drawSliced(ctx, off, destX, destY, Math.max(intensity, 0.05), sliceJitter * 0.5, 'source-over', 1.0)
}

// ─── rgb-split glitch text (post-reveal periodic hits) ────────────────────────

export interface GlitchTextOptions {
  text: string
  x: number
  y: number
  font: string
  color: string
  align: CanvasTextAlign
  intensity: number
  rgbOffset: number
  glowBlur: number
  glowOpacity: number
}

export function drawGlitchText(ctx: CanvasRenderingContext2D, opts: GlitchTextOptions): void {
  const { text, x, y, font, color, align, intensity, rgbOffset, glowBlur, glowOpacity } = opts

  if (intensity <= 0) {
    ctx.save()
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(text, x, y)
    ctx.restore()
    return
  }

  ctx.save()
  ctx.font = font
  const textWidth = ctx.measureText(text).width
  ctx.restore()

  const fontSize = parseFloat(font)
  const textHeight = fontSize * 1.5
  const baseline = fontSize * 1.15
  const pad = Math.ceil(rgbOffset * 4)
  const offW = Math.ceil(textWidth) + pad * 2
  const offH = Math.ceil(textHeight) + pad * 2

  let textOriginX: number
  if (align === 'left') textOriginX = pad
  else if (align === 'center') textOriginX = offW / 2
  else textOriginX = offW - pad
  const textOriginY = pad + baseline

  const textCanvas = makeTextCanvas(offW, offH, text, font, color, textOriginX, align, textOriginY)

  let destX: number
  if (align === 'left') destX = x - pad
  else if (align === 'center') destX = x - offW / 2
  else destX = x - textWidth - pad
  const destY = y - textOriginY

  const rgbShift = rgbOffset * intensity * 3.5
  const rgbVShift = rgbOffset * intensity * 1.2
  const sliceJitter = rgbOffset * intensity * 2.2

  ctx.save()
  ctx.globalAlpha = glowOpacity * intensity
  ctx.shadowColor = color
  ctx.shadowBlur = glowBlur * intensity * 1.4
  ctx.drawImage(textCanvas, destX, destY)
  ctx.restore()

  applyNoise(textCanvas, intensity)
  drawSliced(ctx, tintCanvas(textCanvas, '#ff2200'), destX - rgbShift, destY - rgbVShift, intensity, sliceJitter, 'screen', 0.5)
  drawSliced(ctx, tintCanvas(textCanvas, '#0044ff'), destX + rgbShift, destY + rgbVShift, intensity, sliceJitter, 'screen', 0.5)
  drawSliced(ctx, textCanvas, destX, destY, intensity, sliceJitter * 0.5, 'source-over', 1.0)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function drawSliced(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  x: number,
  y: number,
  intensity: number,
  maxOffset: number,
  blendMode: GlobalCompositeOperation,
  alpha: number
): void {
  const numSlices = Math.round(8 + intensity * 10)
  const sliceH = src.height / numSlices
  // vertical jitter is smaller — just enough to feel 2D
  const maxVOffset = maxOffset * 0.3

  ctx.save()
  ctx.globalCompositeOperation = blendMode
  ctx.globalAlpha = alpha

  for (let i = 0; i < numSlices; i++) {
    const sy = i * sliceH
    const sh = Math.min(sliceH, src.height - sy)
    if (sh <= 0) continue
    const dx = (Math.random() - 0.5) * maxOffset * 2
    const dy = (Math.random() - 0.5) * maxVOffset * 2
    ctx.drawImage(src, 0, sy, src.width, sh, x + dx, y + sy + dy, src.width, sh)
  }

  ctx.restore()
}

function makeTextCanvas(
  w: number, h: number,
  text: string, font: string, color: string,
  textX: number, align: CanvasTextAlign, textY: number
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, textX, textY)
  return c
}

function tintCanvas(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(src, 0, 0)
  return c
}

// three sharp triangle pulses — irregular spacing so they don't feel metronomic
function revealSpikeIntensity(progress: number): number {
  const spikes = [0.06, 0.27, 0.68]
  const halfWidth = 0.045
  let peak = 0
  for (const center of spikes) {
    const dist = Math.abs(progress - center)
    if (dist < halfWidth) {
      peak = Math.max(peak, 1 - dist / halfWidth)
    }
  }
  return peak
}

// scatter random noise pixels onto a canvas during glitch hits
function applyNoise(canvas: HTMLCanvasElement, intensity: number): void {
  const ctx = canvas.getContext('2d')!
  const count = Math.round(intensity * 180)
  ctx.save()
  for (let i = 0; i < count; i++) {
    const nx = Math.random() * canvas.width
    const ny = Math.random() * canvas.height
    const size = 1 + Math.random() * 2
    const v = Math.floor(Math.random() * 255)
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.55})`
    ctx.fillRect(nx, ny, size, size)
  }
  ctx.restore()
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
