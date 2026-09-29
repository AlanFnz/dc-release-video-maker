// called by electron-builder after packing each arch slice, and once more on the
// merged universal app (before electron-builder's own signing step).
//
// x64 slice: replaces the arm64 ffmpeg with the x64 binary so that
// @electron/universal can lipo them into a single universal binary.
//
// universal app: ad-hoc signs the bundle. lipo invalidates Electron's signatures, and
// with no valid signing identity electron-builder skips signing, so Apple Silicon would
// refuse to run the app. If an identity is available, electron-builder re-signs right
// after this hook (codesign --force) and replaces the ad-hoc signature.
const { join } = require('path')
const { copyFileSync, chmodSync } = require('fs')
const { execFileSync } = require('child_process')

// electron-builder Arch enum: x64 = 1, universal = 4
exports.default = async function (context) {
  const app = join(context.appOutDir, 'DC Release Video Maker.app')

  if (context.arch === 1) {
    const src = join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg-x64')
    const dest = join(app, 'Contents', 'Resources', 'ffmpeg')
    copyFileSync(src, dest)
    chmodSync(dest, 0o755)
    console.log('[afterPack] replaced ffmpeg with x64 binary in x64 slice')
  } else if (context.arch === 4) {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
    console.log('[afterPack] ad-hoc signed the universal app')
  }
}
