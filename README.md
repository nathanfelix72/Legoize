# Legoize

Capstone prototype: upload a photo, map it to a LEGO color grid, and inspect a simple 3D brick model.

## Run

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## What it does (deterministic)

1. Downsamples the image and knocks out the background
2. Snaps each cell to the nearest LEGO color (CIELAB)
3. Builds a **rounded solid figure**: thickness from distance-to-edge (plump in the middle), mirrored front/back
4. Renders real solid bricks (rounded bodies + studs) — build steps reveal levels, no transparent ghosts
5. Parts list + ground-up instructions
