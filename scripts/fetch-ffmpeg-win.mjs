// downloads the windows ffmpeg binary from ffmpeg-static's github releases
// and places it at node_modules/ffmpeg-static/ffmpeg.exe so electron-builder
// can bundle it into the windows build
import { existsSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

if (existsSync(dest)) {
  console.log('ffmpeg.exe already present, skipping download')
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(join(root, 'node_modules', 'ffmpeg-static', 'package.json'), 'utf8'))
const releaseTag = pkg['ffmpeg-static']['binary-release-tag']
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${releaseTag}/ffmpeg-win32-x64.gz`

console.log(`downloading ffmpeg.exe from ${url}`)

// curl -L follows all redirects; pipe through gunzip to decompress
execFileSync('sh', ['-c', `curl -fsSL "${url}" | gunzip > "${dest}"`], { stdio: 'inherit' })
execFileSync('chmod', ['+x', dest])

console.log('ffmpeg.exe saved to', dest)
