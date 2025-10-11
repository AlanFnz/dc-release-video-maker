// texture imports — these are baked into the app bundle
import texture1Url from '../assets/textures/texture1.png'
import texture2Url from '../assets/textures/texture2.png'
import texture3Url from '../assets/textures/texture3.png'
import vinylDiscUrl from '../assets/vinyl-disc.png'

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
export async function loadStaticAssets(): Promise<Omit<Assets, 'background' | 'vinylLabel'>> {
  const [t1, t2, t3, disc] = await Promise.all([
    loadImage(texture1Url),
    loadImage(texture2Url),
    loadImage(texture3Url),
    loadImage(vinylDiscUrl),
  ])
  return {
    vinylDisc: disc,
    textures: [t1, t2, t3],
  }
}
