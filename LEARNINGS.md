# Learnings: Look tool

## Gotchas

(none yet)

## Patterns That Worked

(none yet)

## Decisions Made

(none yet)

## Edge Cases

### Float32Array round-trip breaks `toEqual` on struct-returning functions
- **Context**: `getLookInfo` reads values back out of `Grid`/`WaterSim`, which store
  state in `Float32Array`s.
- **Issue**: `toEqual({ flowX: 1.2, ... })` fails — `1.2` stored as Float32 comes back
  as `1.2000000476837158`, etc. Same class of issue as the earlier Float32 vs decimal
  gotcha, but here it's a whole-object equality check, not a threshold comparison.
- **Solution**: assert each numeric field individually with `toBeCloseTo` instead of
  `toEqual` on the whole object.
