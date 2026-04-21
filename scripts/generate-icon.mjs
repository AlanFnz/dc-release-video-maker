// Generates resources/icon.png with the Tactic Round glyphs converted to SVG
// paths. Sharp never has to resolve a font, so it cannot substitute a fallback.
import { readFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const fontPath = join(root, 'src/renderer/src/assets/fonts/TacticRound-Bld.ttf')
const destPath = join(root, 'resources/icon.png')

if (statSync(fontPath).size === 0) {
  throw new Error(`font asset is empty: ${fontPath}`)
}

const fontBuffer = readFileSync(fontPath)
const font = opentype.parse(
  fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength)
)

const size = 1024
const fontSize = 430
const unpositionedText = font.getPath('DC', 0, 0, fontSize)
const bounds = unpositionedText.getBoundingBox()
const textX = size / 2 - (bounds.x1 + bounds.x2) / 2
const textBaseline = size / 2 - (bounds.y1 + bounds.y2) / 2
const textPath = font
  .getPath('DC', textX, textBaseline, fontSize)
  .toPathData({ decimalPlaces: 2, optimize: true, flipY: false })

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#0a0a0a"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 20}"
    fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <path d="${textPath}" fill="white"/>
</svg>
`.trim()

if (!existsSync(dirname(destPath))) mkdirSync(dirname(destPath), { recursive: true })

await sharp(Buffer.from(svg)).png().toFile(destPath)
console.log(`icon written to ${destPath}`)
