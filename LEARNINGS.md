# Learnings: Realistic waves and shoreline

## Gotchas

### A unit conflation can hide indefinitely while the two units coincide numerically
- **Context**: `Waves` wrote sea level as a *depth*; `Grid.initBeach` computed it as an
  *elevation*. Introduced whenever `BASE_SEA_LEVEL` was added, but harmless for as long as the sea
  bed was flat at `rock = 1` and the depth was uniformly `1.0` — depth and elevation produced the
  same number, so nothing diverged.
- **Issue**: commit `8ad9b88` sloped the sea bed to −20. The two conventions instantly diverged and
  the sea surface became a ramp diving to −18.91, defeating that commit's own stated intent on the
  very next tick.
- **Solution**: `Grid.seaLevel` is now the single source of truth and is unambiguously an
  *elevation*; `Waves.step` takes a `seaSurface` elevation and derives depth as
  `max(0, seaSurface - bed)`. When a value can be read as either a depth or an elevation, name it
  for which one it is.

### A threshold test can be measuring a stability crutch rather than the thing it names
- **Context**: `flow does not overshoot into a strong reversal while settling` asserted
  `getFlowX > -1.4` after 30 steps. Written during the cross-advection work, so ostensibly about
  upwinding.
- **Issue**: it was really measuring `MAX_FLOW = 4`. A 4-unit head in a two-cell basin is an
  oscillator with a natural peak flux of ~8.9, so the cap was truncating the swing and the test was
  reading the truncation. Replacing the cap with a depth-scaled one let the real slosh through and
  the assertion failed at −3.79.
- **Solution**: before touching a test that breaks under a deliberate change, **measure whether the
  underlying behaviour is right**. Here: 300 steps showed the oscillation decaying monotonically
  (3.79 → 1.01 → 0.12 → 0.005) to 2.000/2.000 with volume drift of 1.19e-6 — a clean damped
  oscillation, not an instability. Only then was it safe to re-derive the test to assert what
  matters (the basin settles) rather than bump −1.4 to −4, which would have been tuning to green.

## Patterns That Worked

### Measuring the real classes before proposing a design
- **What**: before writing `WATER_SIM_OPTIONS.md`, drove `Grid`/`WaterSim`/`Waves`/`Tide` from a
  throwaway `tsx` script and measured celerity, damping, and sea-surface elevation.
- **Why it works**: two of the three headline claims were things I'd have asserted from reading the
  code anyway — but the sea-surface bug was only visible by *running* it. The unit conflation is
  invisible in either file alone; it only exists in the composition.

## Decisions Made

### `Grid.seaLevel = 2.0` (elevation) wins over `BASE_SEA_LEVEL = 1.0` (depth)
- **Options considered**: reconcile both constants at `1.0`, or make `Grid.seaLevel = 2.0`
  authoritative and delete `BASE_SEA_LEVEL`.
- **Decision**: `Grid.seaLevel` authoritative.
- **Rationale**: `initBeach` already uses it as an elevation in *both* branches (sea and beach), so
  it was already the de facto source of truth; `BASE_SEA_LEVEL` was the interloper.
- **Trade-offs**: the resting waterline moves — the sea gains a unit of depth at the shoreline and
  the HUD now reads `2.00` where it read `1.00`. This restores `initBeach`'s intent rather than
  changing it, but it is a visible change and was flagged as PLAN.md open question 1.

## Edge Cases

- Sea-region cells whose bed sits *above* the sea surface (a sandbar, or erosion depositing into the
  sea) would get a negative depth from `seaSurface - bed`; clamped with `max(0, …)` so they go dry
  instead.

---

# Learnings: Look tool

> ⚠️ This section predates the current feature and appears never to have been merged into CLAUDE.md
> or an ADR. The `isoProjection` decision below is still worth keeping somewhere permanent.

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
