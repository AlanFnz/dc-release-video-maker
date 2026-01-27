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
  }
}
