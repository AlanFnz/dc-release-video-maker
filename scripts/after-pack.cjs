// called by electron-builder after packing each arch slice.
// replaces the arm64 ffmpeg with the x64 binary in the x64 slice so that
// @electron/universal can lipo them into a single universal binary.
const { join } = require('path')
const { copyFileSync, chmodSync } = require('fs')

// electron-builder Arch enum: x64 = 1
exports.default = async function (context) {
  if (context.arch !== 1) return // only act on x64 slice
  const src = join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg-x64')
  const dest = join(context.appOutDir, 'DC Release Video Maker.app', 'Contents', 'Resources', 'ffmpeg')
  copyFileSync(src, dest)
  chmodSync(dest, 0o755)
  console.log('[afterPack] replaced ffmpeg with x64 binary in x64 slice')
}
