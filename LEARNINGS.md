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

(none yet)
