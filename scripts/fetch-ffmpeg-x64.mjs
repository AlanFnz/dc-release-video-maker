// downloads the x64 macOS ffmpeg binary from ffmpeg-static's github releases
// and places it at node_modules/ffmpeg-static/ffmpeg-x64 so electron-builder
// can bundle it into the universal mac build
import { existsSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg-x64')

if (existsSync(dest)) {
  console.log('ffmpeg-x64 already present, skipping download')
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(join(root, 'node_modules', 'ffmpeg-static', 'package.json'), 'utf8'))
const releaseTag = pkg['ffmpeg-static']['binary-release-tag']
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffmpeg-darwin-x64.gz`

console.log(`downloading ffmpeg-x64 from ${url}`)

execFileSync('sh', ['-c', `curl -fsSL "${url}" | gunzip > "${dest}"`], { stdio: 'inherit' })
execFileSync('chmod', ['+x', dest])

console.log('ffmpeg-x64 saved to', dest)
