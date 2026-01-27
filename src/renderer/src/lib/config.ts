export interface TextureConfig {
  // asset filename inside the app's textures folder
  src: string
  blendMode: GlobalCompositeOperation
  opacity: number
}

export interface CompositionConfig {
  // static label (record label name, same for all releases)
  labelName: string
  // default video duration in seconds
  duration: number
  // background image scale (1.0 = cover-fit, >1 = zoom in)
  backgroundScale: number
  fps: number
  size: { width: number; height: number }
  vinyl: {
    // how many degrees per second
    degreesPerSecond: number
    // radius as a fraction of canvas width
    radiusFraction: number
    // center position as fractions
    cx: number
    cy: number
    // center label image radius as fraction of vinyl radius
    labelRadiusFraction: number
    // label image scale within the label circle (1.0 = cover-fit, >1 = zoom in)
    labelImageScale: number
  }
  glitch: {
    // how long the initial reveal lasts (seconds)
    revealDuration: number
    // seconds between random glitch hits (min/max)
    intervalMin: number
    intervalMax: number
    // rgb split offset in pixels at 1500px scale
    rgbOffset: number
    // glow blur radius in pixels
    glowBlur: number
    // glow opacity
    glowOpacity: number
  }
  layout: {
    // positions as fractions of canvas width/height
    labelName: { x: number; y: number; align: CanvasTextAlign }
    releaseName: { x: number; y: number; align: CanvasTextAlign }
    artistName: { x: number; y: number; align: CanvasTextAlign }
    trackName: { x: number; y: number; align: CanvasTextAlign }
  }
  textures: TextureConfig[]
  font: {
    family: string
    labelSize: number
    releaseSize: number
    artistSize: number
    trackSize: number
    color: string
  }
}

export const defaultConfig: CompositionConfig = {
  labelName: 'DUB CULTURE',
  duration: 60,
  backgroundScale: 1.0,
  fps: 30,
  size: { width: 1500, height: 1500 },
  vinyl: {
    degreesPerSecond: 12,   // ~0.33 RPM — slow cinematic spin
    radiusFraction: 0.45,
    cx: 0.5,
    cy: 0.5,
    labelRadiusFraction: 1,
    labelImageScale: 1.0,
  },
  glitch: {
    revealDuration: 1.2,
    intervalMin: 6,
    intervalMax: 14,
    rgbOffset: 10,
    glowBlur: 22,
    glowOpacity: 0.6,
  },
  layout: {
    labelName:   { x: 0.045, y: 0.072, align: 'left' },
    releaseName: { x: 0.955, y: 0.072, align: 'right' },
    artistName:  { x: 0.5,   y: 0.944, align: 'center' },
    trackName:   { x: 0.5,   y: 0.962, align: 'center' },
  },
  textures: [
    { src: 'texture1.png', blendMode: 'source-over', opacity: 0.15 },
    { src: 'texture2.png', blendMode: 'multiply',    opacity: 1.0 },
    { src: 'texture3.png', blendMode: 'source-over', opacity: 1.0 },
  ],
  font: {
    family: 'Tactic Round',
    labelSize: 48,
    releaseSize: 48,
    artistSize: 58,
    trackSize: 46,
    color: '#ffffff',
  },
}
