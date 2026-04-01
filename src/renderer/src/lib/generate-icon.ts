// generates the app icon using the renderer canvas (so Tactic Round font is available)
// returns a PNG as ArrayBuffer to be sent to the main process
export async function generateAppIcon(): Promise<ArrayBuffer> {
  await document.fonts.ready

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // dark circular background
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // subtle white ring
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2)
  ctx.stroke()

  // "DC" text
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 430px "Tactic Round"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('DC', size / 2, size / 2 + 16)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(resolve)
    }, 'image/png')
  })
}
