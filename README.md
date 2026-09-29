# DC Release Video Maker

DC Release Video Maker is a desktop app for creating square, vinyl-style release videos for Dub Culture. It combines release artwork, a rotating vinyl label, animated text, glitch effects, and audio into an MP4 ready for social media.

## Features

- Real-time 1500 x 1500 video preview
- Custom background and vinyl label artwork
- Adjustable artwork scale, disc size, label size, and text size
- Artist, track, and release code overlays using Tactic Round, or any `.ttf`, `.otf`, `.woff`, or `.woff2` font you choose
- Editable logo text, or replace it with any PNG, JPG, or WebP image with adjustable size and position
- Animated decoder reveal, RGB split, glow, noise, and glitch effects
- Configurable audio start time and video duration
- Optional synchronized audio fade and fade to black
- MP4 export with H.264 video and AAC audio
- Save and load projects as `.dcproject` files
- English and Argentinian Spanish interface

## Requirements

- Node.js 20 or newer
- Yarn 1.x
- macOS for universal DMG builds

FFmpeg is bundled into packaged applications. A system FFmpeg installation is not required.

## Development

Install dependencies:

```sh
yarn install
```

Start the Electron development app:

```sh
yarn dev
```

Run the type checks:

```sh
yarn typecheck
```

Create a production renderer build:

```sh
yarn build
```

## Packaging

Build a universal macOS DMG:

```sh
yarn package
```

Build the Windows ZIP package:

```sh
yarn package:win
```

Packaged files are written to `dist-electron/`.

The macOS package script generates the app icon, builds the Electron application, downloads the x64 FFmpeg binary when needed, and combines the x64 and arm64 app slices into a universal build.

Merging the slices invalidates Electron's code signature, so the script ad-hoc signs the universal app (see `scripts/after-pack.cjs`). This needs no certificate and is enough to run the app on the Mac that built it. If a valid Developer ID certificate is available, electron-builder signs the app with it instead. Distributing the app to other Macs still requires a Developer ID certificate and notarization; otherwise Gatekeeper will warn on first launch.

## Usage

1. Choose a square background image and vinyl label image.
2. Enter the artist, track, and release code.
3. Optionally edit the logo text, or choose a logo image to replace it and adjust its size and position. Choose a font file to change the typeface of all text; use **×** to go back to the default.
4. Load an audio file and select its start time.
5. Adjust the composition, duration, and fade settings while watching the preview.
6. Select **Export MP4** and choose an output location.

Use **Save** to store the current setup as a `.dcproject` file and **Load** to continue working on it later.
