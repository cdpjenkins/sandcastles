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

### Threshold-detecting a wave front measures the numerical precursor, not the wave
- **Context**: verifying Step 3's claim that celerity is now `sqrt(g*h)`. Measured the front by
  finding the first cell whose depth deviated by more than `1e-4`.
- **Issue**: reported celerity came out ~40% high at *every* depth (ratios 1.37–1.43 vs `sqrt(g*h)`).
  An explicit scheme's numerical domain of dependence is one cell per step — here `1/(1/30)` = 30
  cells/s — so a vanishingly small precursor runs out ahead of the physical front and trips any
  tight threshold early.
- **Solution**: track the *crest* (argmax deviation) instead, which advances at the phase speed.
  That gave 3/4/6/10/14 cells/s against `sqrt(g*h)` of 3.13/4.43/7.00/9.90/14.00. Confirmed by
  sweeping the threshold at depth 20: `1e-4` → 15.13, `1e-3` → 14.52, converging on 14.0 from above
  as the precursor stops dominating.
- **Tell**: a bias that is near-constant across a swept parameter is a measurement artifact; a
  physics error would vary with the parameter. The `sqrt(h)` *scaling* was already near-exact
  (2.06/3.09/4.20 vs 2/3/4) while the absolute value was uniformly off — that pattern was the clue.

### A tuning constant silently encodes the units of whatever feeds it
- **Context**: `EROSION_K = 2.5` scaled `getVelocity` into sediment capacity. Step 4 changed
  `getVelocity` from a flux to a true velocity — same name, same call site, ~5x larger number.
- **Issue**: the beach steadily dissolved into suspension (31.5% of all sand suspended after 2
  minutes, still climbing). Nothing was broken numerically — sand + sediment stayed at 144504, exact,
  on every tick — but the equilibrium was gone.
- **Solution**: recalibrate the constant as part of the same change. Any constant that scales
  another module's output is coupled to that output's *units*, not just its value, and a change of
  units is a silent breaking change to every such constant. Grep for consumers before changing what
  an accessor means.

### 'Preserve the old behaviour' is wrong when the old behaviour was the bug
- **Context**: picking the new `EROSION_K`. The obvious target was to restore the previous
  equilibrium — Step 3 plateaued at 99% sand, so match that.
- **Issue**: that reasoning was backwards. Under flux-as-velocity, the beach's velocity percentiles
  were p50 = 0.000 and p90 = 0.113 — beach cells had almost no velocity at all. The only high values
  (~6.8) were out in the sea, **where there is no sand**. The tidy 99% equilibrium was not erosion
  in balance; it was erosion barely happening. Tuning to reproduce it would have restored *nothing
  happening* and quietly defeated the whole step.
- **Solution**: measure what the old numbers actually meant before adopting them as a target. The
  distribution, not the aggregate, was the tell.

### The same test broke three times, because it was pinned to the crutch each time
- **Context**: `flow does not overshoot into a strong reversal while settling` (`getFlowX > -1.4`)
  → re-derived at Step 2 to `a sloshing basin settles to a level surface` → re-derived again at
  Step 5 to `a sloshing basin loses energy rather than gaining it`.
- **Issue**: each form was pinned to whatever artificial dissipation happened to exist. `-1.4`
  measured `MAX_FLOW`. "Settles within 10s" measured `DAMPING = 0.95`. Both looked like physics
  assertions and were really assertions about a stability crutch — so each crutch removal broke the
  test again.
- **Solution**: the form that finally survives asserts the *invariant* rather than an outcome:
  energy decays rather than grows. That is true of the real system regardless of how the
  dissipation is modelled. When a test breaks every time you improve the model, the test is probably
  describing the model's flaws rather than its behaviour.

### Removing a crutch reveals what else was leaning on it
- **Context**: the old `Waves` pinned everything from `seaStart + 4` outward to sea level every tick.
  It read as a boundary condition. It was also, silently, a **mass sink** — it deleted the surge's
  ~10,240 units per period, and an energy sink, since it erased anything that reached it.
- **Issue**: Step 6 unpinned the sea and three separate things fell over that had been quietly
  depending on the pin: the surge (its water now had nowhere to go), the absence of any energy sink
  (any periodic forcing accumulates without bound), and erosion (see below). None of these were
  visible while the pin was deleting the evidence.
- **Solution**: when removing something that has been in place a long time, expect the blast radius
  to exceed its stated job. Bisect rather than guess — turning tide/stream/slope/erosion on one at a
  time found the real culprit in one run, after two wrong hypotheses.

### Erosion can destabilise the water sim, and the knob has a stability ceiling
- **Context**: choosing `EROSION_K` once the sea was open.
- **Issue**: it is not just a taste knob. Bisected on the open sea, tide, stream and slope are all
  stable indefinitely; only erosion blows the sim up — 0.5 at 122s, 0.25 at 147s, 0.1 stable past
  600s. Likely mechanism: erosion drops the bed by up to `capacity·dt` in a step, a step change in
  `H = b + w` that injects grid-scale energy. Deep water has no Manning drag to dissipate it, and
  grid-scale noise has near-zero group velocity in a staggered scheme so it never reaches the sponge
  either — it accumulates, raising velocity, raising erosion.
- **Solution**: `EROSION_K = 0.1` for now, forced rather than chosen. The real fix is a mechanism
  (rate-limit bed change per step, or a small interior dissipation to kill grid noise), not a number.
- **Tell**: "smaller value survives longer" is the signature of a slow fuse, not a fix — 10 blew up
  at 25s and 1 at 240s. A genuine threshold looks different: 0.25 fails at 147s while 0.1 survives
  600s+, i.e. a discontinuity, not a scaling.

### A sponge must absorb the surface anomaly, not just the momentum
- **Context**: PLAN.md specified "graded flux damping over the outermost N rows".
- **Issue**: flux damping alone only took the wave's *kinetic* energy. Its potential energy — the
  surface anomaly — remained and re-radiated. Measured: reflection fell 0.157 → 0.098, nowhere near
  enough.
- **Solution**: relax the surface toward the target as well as damping the flux, with the same
  graded strength (standard Rayleigh damping). Reflection then fell to 0.035 against a 0.516
  incident wave — ~7% reflection coefficient, the usual bar for an absorbing layer. Relaxing the
  surface breaks mass conservation inside the sponge, which is correct: it is an open boundary.

### A delta-function test signal disperses into a tail that drowns the measurement
- **Context**: the sponge test launched a wave by raising a single cell by 1.
- **Issue**: a one-cell bump is a delta function — every wavelength at once — so numerical dispersion
  smeared it into a ~0.05 background filling the whole channel. The test threshold of 0.05 was
  *below its own noise floor* and could never have passed however good the sponge was. The tell:
  profiling showed cells far from the sponge reading identically with and without it.
- **Solution**: launch a smooth `cos²` hump ~24 cells wide. Narrow spectrum, travels as a coherent
  packet, background drops to ~0.0003 and the reflection becomes unambiguous.

## Patterns That Worked

### Verify a physics change against an independent analytical law
- **What**: Step 5's payoff was checked against Green's law (`A ∝ h^(-1/4)` for a shoaling wave),
  not against "the waves look bigger now". Measured 1.016/1.041/1.127/1.224 at depths
  16.6/14.8/12.2/9.2 against predictions of 1.014/1.043/1.094/1.174, with average crest speed
  11.3 cells/s matching `sqrt(9.8 * 13)` for the mean depth.
- **Why it works**: the law is derived independently of this code, so agreeing with it is real
  evidence rather than confirmation of an expectation. It also localises errors — a constant offset
  would indicate a measurement artifact (as in Step 3), while a divergence that grows with the swept
  parameter would indicate a physics error.
- **Bonus**: the measured amplitude slightly *exceeds* Green's law as the wave shallows (1.224 vs
  1.174), which is the expected signature of nonlinear steepening on top of the linear prediction —
  the beginnings of the breaker the plan defers to a later reassessment.

### Verify a new test is RED against the old code, even mid-step
- **What**: Step 4's implementation was already written when the erosion-level test was added, so
  `git stash push src/sim/WaterSim.ts` → run → `git stash pop` was used to confirm it genuinely
  failed against the old code (0.0396 vs 0.0396 — identical erosion at either depth).
- **Why it works**: a test written after the implementation is a test that has never been seen to
  fail, and a test that has never failed is not yet known to test anything. Stashing the one file
  restores the RED step cheaply.

### Prefer the qualitative assertion when the quantitative one is quantisation-bound
- **What**: Step 3's test asserts "a disturbance travels further in deeper water" rather than
  "celerity equals `sqrt(g*h)`", even though the latter is what the step actually achieves and was
  verified by hand.
- **Why it works**: crest position is cell-quantised, so measuring speed over a 1 s window has ±1
  cell/s resolution. At depth 20 that is 14 ± 1 against a target of 14.0 — a `toBeCloseTo(14, 0)`
  would fail on a ±1 wobble. The law is real but the *measurement* is too coarse to assert tightly,
  and Step 5 changes the damping underneath it. The qualitative ordering is robust to both.

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
