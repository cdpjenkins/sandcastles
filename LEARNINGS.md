# Learnings: M5 — Erosion + Wet/Dry Sand

## Gotchas

### Float32Array precision vs decimal thresholds
- **Context**: Comparing a Float32Array-stored value against a decimal constant like `0.01`.
- **Issue**: `0.01` stored as Float32 is `≈ 0.009999999776`, which is less than the JS number `0.01`, causing `< 0.01` guards to fire unexpectedly.
- **Solution**: Use small powers of 10 that round-trip cleanly in Float32 (e.g. `1e-5`), or compare with `> 0`.

## Patterns That Worked

(none yet)

## Decisions Made

### Erosion uses WaterSim velocity, not raw flow pipes
- **Decision**: WaterSim exposes a computed velocity magnitude per cell; Erosion reads it.
- **Rationale**: Decouples erosion logic from pipe internals; velocity is the physically meaningful quantity.

### Sand angleOfRepose lowered from 34° to 20°
- **Decision**: Change in materials.ts as part of Step 4.
- **Rationale**: User observed towers were too steep; 20° gives more natural spreading.

## Edge Cases

### THREE.js Color stores in linear space, not sRGB
- **Context**: Testing `sandColour()` by comparing `.r` against `0xc2/255`.
- **Issue**: `new THREE.Color('#c2a06e').r` returns the sRGB-decoded linear value (~0.54), not 0xc2/255 (0.76).
- **Solution**: Compare with `.getHexString()` instead of raw channel values.

### makeGrid helper must set rock for all z rows
- **Context**: Slope test used `makeGrid(4, 4)` which only initialised rock for z=0.
- **Issue**: Other rows had rock=0, creating uneven base heights that triggered spurious slope movement.
- **Solution**: Loop over all `z` in `d` when setting initial rock height.
