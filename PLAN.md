# Plan: M7 — Polish

## Goal

Make the game feel finished: varied sand colours, a satisfying wave sound, and a help overlay.

## Acceptance Criteria

- [ ] Sand surface has subtle per-cell colour variation (no flat uniform tint)
- [ ] A short audio burst plays when a wave hits
- [ ] Press `?` shows a controls overlay; press again to dismiss
- [ ] All tests still pass

## Steps

### Step 1: `src/render/cellNoise.ts` — position-based colour jitter

**Test**: same (x, z) always returns the same value; return value is in [-1, 1].

**Implementation**:
- Hash `(x, z)` with a simple integer mix → map to [-1, 1]
- `TerrainMesh.setVertex` adds `noise * JITTER` (e.g. 0.06) to each RGB channel of
  dry sand colour so adjacent cells differ slightly

**Done when**: noise tests pass; sand looks textured in browser.

### Step 2: `Waves.fired` flag + `src/audio/WaveAudio.ts`

**Test**: `Waves.fired` is `true` only in the step where a wave fires; `false` otherwise.

**Implementation**:
- Add `fired = false` to `Waves`; set to `true` when surge triggers, reset at start of
  each `step()` call
- `WaveAudio.play()` uses Web Audio API: short filtered noise burst (no external files)
- `Game.simStep` calls `waveAudio.play()` when `waves.fired`

**Done when**: flag test passes; audio burst audible in browser on wave.

### Step 3: `?` help overlay — controls reference

**Test**: none (DOM only).

**Implementation**:
- `Game` creates a hidden `<div>` listing all keybindings (S/D/W/R/?)
- `?` keydown toggles `display: block` / `display: none`

**Done when**: overlay appears and dismisses correctly in browser.
