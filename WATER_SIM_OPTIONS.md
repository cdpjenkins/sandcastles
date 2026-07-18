# Water Simulation: Current Approach and Alternatives

An assessment of `src/sim/WaterSim.ts`, written to answer one question: **what would it take to
make the waves and shoreline read as real?**

Everything below that makes a numerical claim was measured against the actual code, not reasoned
from the source. The measurements are in [Evidence](#evidence).

---

## 1. What WaterSim actually is

It is a **pipe model** — an explicit, first-order, staggered-grid solver closely following Mei et
al. 2007, *Fast Hydraulic Erosion Simulation and Visualization on GPU*.

**State.** Per cell: bed elevation `b = rock + sand`, water depth `w`. Per *edge* (staggered, not
per cell): a signed flux `flowX` across each x-edge, `flowZ` across each z-edge. A signed flux per
edge rather than Mei's four non-negative outflow pipes — the same model, more compactly stored.

**Each step does three passes:**

1. **Momentum.** For every edge, accelerate the flux down the free-surface gradient:

   ```
   f ← clamp( (f + g·(H_i − H_j)·dt − v_avg·(∂u/∂n)·dt) × 0.95 , ±4 )
   ```

   where `H = b + w` is the free-surface elevation (hydraulic head). The second term is
   cross-advection, upwind-differenced. `0.95` is `DAMPING`; `±4` is `MAX_FLOW`.

2. **Outflow limiting.** If a cell's outgoing fluxes would drain more than `w/dt`, scale them all
   down by `maxOut/outflow`. This is Mei's `K` factor, and it is what makes depth stay
   non-negative.

3. **Integration.** `w ← max(0, w + (Σinflow − Σoutflow)·dt + source·dt)`, plus the dirty mask and
   `velocityArr` (the mean of the four edge flux magnitudes), which `Erosion` consumes.

### How it compares to the equations it approximates

The shallow water equations (1-D, flux form) are:

```
∂h/∂t + ∂q/∂x = 0                          (mass)
∂q/∂t + ∂(q²/h)/∂x + g·h·∂H/∂x = −friction  (momentum)
```

Lining the code up against them:

| Term | SWE | WaterSim | Consequence |
|---|---|---|---|
| Mass | `∂h/∂t + ∂q/∂x = 0` | exact, in flux form | Volume conserved to round-off |
| Pressure | `g·h·∂H/∂x` | `g·ΔH` — **no depth factor** | Wave speed independent of depth |
| Self-advection | `∂(q²/h)/∂x` | **absent** | No steepening, no bores |
| Cross-advection | (part of the 2-D form) | present, upwind | Momentum turns with the flow |
| Friction | Manning/Chézy, `∝ q\|q\|/h^(7/3)` | flat `×0.95` per step | Waves die in ~1 s regardless of depth |

The missing depth factor is not a bug — a constant pipe cross-section is the standard pipe-model
simplification. But it is the single most consequential deviation for this project, and §4 explains
why.

---

## 2. Advantages of the current approach

These are real and worth protecting in any replacement.

- **Mass conservation is exact and structural.** Flux lives on the edge, so what leaves one cell
  provably enters its neighbour. No drift over hours of play. The `conserves total water volume`
  test passes because of the data layout, not because of tuning.
- **It is unconditionally robust.** The outflow limiter plus `MAX_FLOW` clamp mean it cannot
  explode, whatever the player builds. For a sandbox where the player can dig a 20-unit trench in
  one click, that matters more than it would in an offline solver.
- **Arbitrary terrain, dams, lakes, and wet/dry come free.** Dry cells simply have `w = 0` and
  don't flow. No special-casing the shoreline — which, as §5 notes, is where fancier schemes
  concentrate all their difficulty.
- **It couples cleanly to erosion.** `Erosion.transportSediment` reuses the very same edge fluxes
  to move sediment upwind. That reuse is elegant and any alternative must keep supplying per-edge
  flux and per-cell velocity.
- **O(N), local, cache-friendly, branch-light, and trivially portable to GPU** if it ever needs to
  be.
- **It is testable as pure functions.** 187 tests, no DOM, no WebGL. This is the constraint that
  should kill several of the alternatives below.

---

## 3. Drawbacks

- **Wave speed does not depend on depth.** Measured: identical propagation at depths 1, 5 and 20,
  where physics demands a 4.5× spread. See [Evidence](#evidence).
- **Damping is not physical.** `0.95` per step at 30 Hz is `0.95³⁰ ≈ 0.21` per second. Measured: a
  disturbance falls to 24% of its amplitude in one second. Real friction scales with `1/h` and
  nearly vanishes in deep water; this applies equally everywhere.
- **`MAX_FLOW = 4.0` is a hard nonlinearity** that silently discards momentum in exactly the fast,
  deep water where waves carry the most energy.
- **`velocityArr` is a flux, not a velocity.** True velocity is `u = q/h`. Erosion therefore reads
  a quantity biased by depth: for the same real current speed, deep water reports a larger
  "velocity" and erodes harder. Backwards — a thin fast swash sheet should scour more than a deep
  slow lagoon.
- **The sea is not simulated.** `Waves.step` pins every cell from `seaStart + 4` outward to a fixed
  value each tick. That is a rigid Dirichlet wall: waves cannot travel in from deep water, and
  anything reaching it is annihilated rather than reflected or absorbed. The 10-unit surge is
  injected into the *four rows nearest the beach* because a wave launched any further out could
  never survive the trip (§3, damping).
- **Four-neighbour pipes are anisotropic.** Flow prefers the grid axes; a circular dam break spreads
  as a diamond.
- **`max(0, …)` in the integration step can create water.** When the outflow limiter doesn't fully
  prevent a negative, the clamp quietly manufactures volume. Small, but it is the one hole in an
  otherwise exact conservation guarantee.

---

## 4. The core diagnosis

Four things make a shoreline read as real. The current model gets **none** of them, and — this is
the important part — misses them **structurally, not by mistuning**:

| Phenomenon | What it needs | Why WaterSim can't |
|---|---|---|
| **Shoaling** (waves rise and steepen in shallows) | `c = √(g·h)` | No depth factor in the pressure term |
| **Refraction** (crests bend to face the beach) | `c = √(g·h)` | Same |
| **Breaking** (face steepens, collapses to a bore) | self-advection `∂(q²/h)/∂x` + shock capture | Term absent; `MAX_FLOW` would clip it anyway |
| **Run-up / backwash** (the swash cycle) | waves that arrive with energy | `0.95`/step damping; sea pinned flat |

Shoaling and refraction are the same fix — **restore the depth factor**. That one change is the
highest realism-per-line ratio available in this codebase.

Note the pleasing consequence: `c = √(g·h)` makes refraction *emergent*. Waves crossing the sloping
sea floor slow down over the shallows and bend toward the shore on their own. Nobody has to author
it.

---

## 5. Alternatives

### A. Fix the pipe model in place ⭐ *recommended*

Four staged changes, each independently testable and revertable:

1. **Depth-weight the pipe.** `f += g · h_edge · ΔH · dt`, with `h_edge` the mean (or upwind) depth
   across the edge. This is Mei's pipe cross-section `A` made proportional to depth instead of
   constant. Recovers `c = √(g·h)` → **shoaling + refraction**.
2. **Replace `DAMPING` with depth-dependent drag** (Manning, or simply quadratic `∝ q|q|/h`).
   Waves survive the crossing; shallow swash still slows realistically.
3. **Drive swell from the deep boundary; stop pinning the sea.** Replace the surge-injection with a
   sinusoid (or Gerstner sum, per option D) driving the *far* rows, plus a sponge layer to absorb
   outgoing reflections. Waves then travel in, shoal, run up the beach, and wash back — instead of
   materialising four rows from shore.
4. **Re-derive `velocityArr` as `flux/depth`.** Erosion finally gets a real velocity.

**Pros.** Keeps every advantage in §2 — conservation, robustness, erosion coupling, test suite,
architecture. Fits the project's TDD and commit-per-step discipline exactly: four commits, four
observable behaviour changes. Gets 3 of the 4 phenomena in §4.

**Cons.** Still no *true* breaking — upwind differencing will smear a steepening face rather than
resolve a clean bore. Momentum still isn't in conservative form. Push this far enough and you have
rewritten option B by accident, badly.

**Stability.** Removing the damping crutch means CFL starts to matter. At the current sea depth of
22, `c = √(9.8 × 22) ≈ 14.7` cells/s, so `CFL = c·dt/dx = 14.7/30 ≈ 0.49` — inside the explicit
limit, no substepping needed. Worth knowing: deepening the sea past about −40 pushes `CFL > 0.65`
and would force substepping.

### B. Proper finite-volume SWE (well-balanced, shock-capturing)

Kurganov–Petrova central-upwind or an HLLC Riemann solver, with hydrostatic reconstruction, MUSCL
slope limiting, and explicit wet/dry handling.

**Pros.** All four phenomena, including genuine breaking — bores are shocks and the scheme captures
them properly. *Well-balanced* means a lake at rest stays exactly at rest with no spurious currents
over a sloping bed, which is directly relevant given the new sea floor. True velocities for erosion.
It is the physically correct answer.

**Cons.** Substantially more code, and subtle in a way that resists incremental development — you
cannot half-build a Riemann solver and commit it green. Worse, the notorious failure mode of these
schemes is **wet/dry fronts** (negative depths and spurious velocities as `h → 0`), and a beach is
nothing *but* wet/dry front. The risk is concentrated precisely where the payoff is. Cost is roughly
3–10× per cell.

**Verdict.** Correct but disproportionate. A multi-week numerics project to win one phenomenon
(breaking) that §6 argues is mostly a rendering problem.

### C. Linear wave-equation heightfield over the sea

`∂²h/∂t² = ∇·(g·h·∇h)`, Verlet-integrated, blended against the pipe model near shore.

**Pros.** Very cheap, well-behaved, and `c = √(g·h)` gives shoaling and refraction for free. The
classic games approach to open water.

**Cons.** Linear — no breaking, and crucially **no mass transport**, so it cannot produce run-up or
feed the erosion system. It models surface displacement, not moving water. Needs a blend region
against the pipe model, and the blend will be visible exactly at the shoreline.

**Verdict.** Good for deep water, useless at the shore — which is the actual target. Wrong tool for
this specific complaint.

### D. Kinematic ocean (Gerstner sum, or FFT/Tessendorf)

Not a simulation: a displacement function of `(x, z, t)`.

**Pros.** Beautiful and nearly free. Gerstner's sharp crests and flat troughs are exactly the shape
of real swell. Fully art-directable — swell period and direction become dials.

**Cons.** No mass, no interaction with terrain. Player-built dams would do nothing, which is the
entire game.

**Verdict.** Not a replacement — **but the right *source* for waves.** Use it to drive the deep
boundary in option A step 3 and let the physical sim carry the swell shoreward. Steal the idea, not
the architecture.

### E. Lattice Boltzmann shallow water (LABSWE)

**Pros.** Purely local, trivially parallel, handles complex flow well.

**Cons.** Nine distributions per cell; low viscosity (what you want for waves) is where it gets
unstable; wet/dry boundaries are a known LBM weak spot — again, exactly the beach. Considerably more
exotic for anyone maintaining it.

**Verdict.** No advantage over B here, and more surprises. No.

### F. SPH / FLIP / PIC particles

**Pros.** The only option that gives a genuinely overturning, spraying breaker.

**Cons.** Abandons the 2.5D heightfield the whole game rests on — `TerrainMesh` raises vertices by
water height, `Picker` raycasts that mesh, `Erosion` is per-cell. Needs 10⁵–10⁶ particles for this
sea, plus a surfacing pass (marching cubes or screen-space fluid), which is an entire renderer.

**Verdict.** A different game. No.

### G. Move to WebGPU compute

Not a model — a substrate. Any of A/B/C/E ports well.

**Pros.** Removes all budget concerns: 1024² with 8× substepping becomes easy, which would make B's
cost a non-issue.

**Cons.** `Erosion` and `LookInfo` read flux back on the CPU, so either erosion moves to the GPU too
(likely — it's the same stencil) or you eat readback latency every tick. More seriously, **Vitest
cannot test compute shaders headlessly without a real device**, which collides head-on with a
non-negotiable TDD workflow and 187 passing tests.

**Verdict.** Solves a problem the project doesn't have. The shoreline is wrong for *physics*
reasons, not flops — the sim isn't the bottleneck for realism. Revisit only if A or B turn out to
need heavy substepping.

---

## 6. Recommendation

**Option A, staged — but fix the sea-surface bug in §7 first.** Right now the sea isn't flat, so
there is no trustworthy baseline to judge any wave work against.

Then, in order:

| # | Change | Buys |
|---|---|---|
| 0 | Fix depth/elevation conflation in `Waves` (§7) | A flat sea to build on |
| 1 | Depth-weight the pipe pressure term | Shoaling **and** refraction |
| 2 | Depth-dependent drag instead of flat `DAMPING` | Waves that survive the crossing |
| 3 | Swell boundary at the deep edge + sponge layer | Real travelling waves, run-up, backwash |
| 4 | `velocityArr = flux / depth` | Erosion that scours the swash, not the lagoon |

Four commits after the fix, each a visible behaviour change, each revertable. That ordering is
deliberate: step 1 is the big one, and steps 2 and 3 are what let you actually *see* step 1 working.

**Then stop and look before considering option B.** The remaining gap is breaking waves — and
**breaking is mostly a rendering problem, not a simulation problem.** Once step 1 gives you
shoaling, the crest genuinely steepens; detect that steepness (via `∂H/∂x` or the flux ratio) and
render foam and spray. Full shock capture buys the physics of the bore, but what reads as a breaker
to a player is *whitewater*. For a 2.5D isometric sandbox, foam is a few percent of B's cost for
most of B's payoff.

Option B is the right answer to a question this project isn't asking.

---

## 7. A live bug found while measuring

**`Waves` treats sea level as a depth; `Grid` treats it as an elevation. The sea surface is
currently a ramp diving to −19, not a flat plane.**

- `Grid.initBeach` sets `water[i] = this.seaLevel − rock[i]`, i.e. a depth chosen so the *surface
  elevation* lands at `Grid.seaLevel = 2.0`. Correct: the sea starts flat.
- `Waves.step` then does `setWaterHeight(x, z, seaLevel)` with `seaLevel = BASE_SEA_LEVEL + tide.offset ≈ 1.0`
  — assigning a *depth* of 1.0 to every sea cell, ignoring the bed beneath it. Since the floor slopes
  to −20, the surface is dragged down with it.

Measured at `x = 128`, after one second of the real `Game` sim loop:

```
             initBeach          after 30 ticks
  z=199      surface  2.00      surface   1.89
  z=203      surface  2.00      surface  -0.33
  z=210      surface  2.00      surface  -2.90
  z=230      surface  2.00      surface -10.04
  z=255      surface  2.00      surface -18.91
```

**Origin.** Commit `8ad9b88` ("slope the sea floor down from seaStart"). Before it, the sea bed was
flat and the depth was uniformly `1.0`, so *depth* and *elevation* happened to coincide numerically
and the conflation was harmless. That commit's own message states the intent — "water height is
recomputed so the surface stays flat at seaLevel while actual depth grows away from shore" — and
`Waves.step` defeats it on the very next tick.

**Why 187 green tests missed it.** `initBeach` is exercised only in `grid.test.ts`; `waves.test.ts`
builds its own flat `rock = 1` grid. Nothing composes the real beach with `Waves`, so the two
conventions are never in the same room. A test that runs `initBeach` and then one `Waves.step` and
asserts the sea surface is still flat would have caught it — and is worth adding regardless of which
option above you pick.

Two constants named for the same concept disagree, which is worth cleaning up either way:
`Grid.seaLevel = 2.0` (elevation) vs `Waves.BASE_SEA_LEVEL = 1.0` (depth). The HUD reports the
latter, so it currently displays `1.00` for a sea whose intended surface is at `2.0`.

---

## Evidence

Measured by driving the real classes (`Grid`, `WaterSim`, `Waves`, `Tide`) via `tsx`.

**Wave speed is independent of depth.** A 1-unit bump in a flat 200-cell channel, 2 seconds:

```
  depth= 1   front reached x=28   |  SWE predicts c=3.13 cells/s → x≈26
  depth= 5   front reached x=28   |  SWE predicts c=7.00 cells/s → x≈34
  depth=20   front reached x=28   |  SWE predicts c=14.0 cells/s → x≈48
```

Identical at every depth. (Because of the damping, that front is really where the signal drops below
the detection threshold rather than a clean celerity — but the *identity across depths* is the
finding, and it's unambiguous.) Physically, the depth-20 wave should outrun the depth-1 wave by 4.5×.
This is what forecloses shoaling and refraction.

**Damping kills disturbances in about a second.** Peak deviation of the same bump, depth 5:

```
  t=0s  1.0000     t=1s  0.2387     t=2s  0.1132
  t=3s  0.0720     t=4s  0.0562     t=5s  0.0491
```

76% of the amplitude is gone after one second. A wave crossing the ~56-cell sea at ~4 cells/s takes
14 seconds — it would be gone many times over, which is exactly why `Waves` has to inject its surge
four rows from the beach. (The residual ~0.05 isn't a surviving wave: it's the bump's mass, correctly
conserved, spread into a flat mound.)

Probe script: `scratchpad/probe.ts` (not committed — reproduce with the three probes described above).
