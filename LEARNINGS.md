# Learnings: Look tool

## Gotchas

(none yet)

## Patterns That Worked

(none yet)

## Decisions Made

### Flow arrow direction is projected through the isometric camera basis
- **Options considered**: map `flowX`/`flowZ` directly to screen arrows (treats the
  grid as a top-down map); or project the flow vector through the camera's actual
  right/up basis vectors before picking an arrow.
- **Decision**: project through the camera basis, via a new
  `src/render/isoProjection.ts` shared by `IsoCamera` and `LookInfo`.
- **Rationale**: the game renders through a fixed isometric camera (45° yaw, ~35.26°
  pitch — see `IsoCamera.ts`), so a world `+x` flow visually moves down-right on
  screen, not directly right. Any future screen-space direction indicator (wind,
  particles, etc.) should reuse `worldToScreenDirection` rather than re-deriving this.
- **Trade-offs**: couples `LookInfo` (previously camera-agnostic) to the fixed iso
  angles; acceptable since the camera's orientation is a constant, not something the
  player can rotate.

## Edge Cases

### Float32Array round-trip breaks `toEqual` on struct-returning functions
- **Context**: `getLookInfo` reads values back out of `Grid`/`WaterSim`, which store
  state in `Float32Array`s.
- **Issue**: `toEqual({ flowX: 1.2, ... })` fails — `1.2` stored as Float32 comes back
  as `1.2000000476837158`, etc. Same class of issue as the earlier Float32 vs decimal
  gotcha, but here it's a whole-object equality check, not a threshold comparison.
- **Solution**: assert each numeric field individually with `toBeCloseTo` instead of
  `toEqual` on the whole object.
