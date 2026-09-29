// texture imports — these are baked into the app bundle
import texture1Url from '../assets/textures/texture1.png'
import texture2Url from '../assets/textures/texture2.png'
import texture3Url from '../assets/textures/texture3.png'
import vinylDiscUrl from '../assets/vinyl-disc.png'
import backgroundExampleUrl from '../assets/background-example.png'
import vinylLabelExampleUrl from '../assets/vinyl-lable-example.png'

import type { Assets } from './compositor'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// load an image from an absolute path chosen by the user
// reads via main process to avoid file:// csp restrictions
export async function loadImageFromPath(filePath: string): Promise<HTMLImageElement> {
  const dataUrl = await window.api.readAsDataUrl(filePath)
  return loadImage(dataUrl)
}

let customFontSeq = 0

// load a user-chosen font file (ttf/otf/woff/woff2) as a FontFace under a unique family name.
// the caller registers it with document.fonts once it decides to use it.
// `family` is the exact name given to the constructor: face.family reads back quoted
// ('"DC Custom Font 1"') when it contains spaces, which would not match in a canvas font string.
export async function loadFontFromPath(filePath: string): Promise<{ face: FontFace; family: string }> {
  const dataUrl = await window.api.readAsDataUrl(filePath)
  const family = `DC Custom Font ${++customFontSeq}`
  const face = await new FontFace(family, `url(${dataUrl})`).load()
  return { face, family }
}

// load all static assets bundled with the app
export async function loadStaticAssets(): Promise<Assets> {
  const [t1, t2, t3, disc, bg, label] = await Promise.all([
    loadImage(texture1Url),
    loadImage(texture2Url),
    loadImage(texture3Url),
    loadImage(vinylDiscUrl),
    loadImage(backgroundExampleUrl),
    loadImage(vinylLabelExampleUrl),
  ])
  return {
    vinylDisc: disc,
    textures: [t1, t2, t3],
    background: bg,
    vinylLabel: label,
    logo: null,
  }
}
