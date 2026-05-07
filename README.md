# Vid Aider

Vid Aider is an XDOES-style browser app for video creation workflows around 3D objects.

## MVP

- Browser-only Three.js model viewport.
- Import STL, OBJ, GLTF, and GLB files with drag/drop or file picker.
- Move/scale/spin objects for simple showcase loops.
- PNG frame export.
- WebM recording through `canvas.captureStream()` and `MediaRecorder`.
- Resolution and FPS target controls.
- XDOES `node.xdoes.space` look and feel: dark shell, purple accents, minimal catalogue-style UI.

## Roadmap

- Real render-size matching for export presets.
- Browser-worker GIF encoder with palette and dithering controls.
- Timeline/keyframe editor for camera and model transforms.
- Transparent/background presets.
- Scene lighting presets and material overrides.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## Deployment

This repo is static-export ready. GitHub Pages deployment is configured in `.github/workflows/pages.yml`.

Live URL after Pages is enabled:

```text
https://x-does.github.io/vid-aider/
```
