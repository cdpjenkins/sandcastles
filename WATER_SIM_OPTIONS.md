# Water Simulation: Current Approach and Alternatives

An assessment of `src/sim/WaterSim.ts` and the erosion coupled to it, written to answer one question:
**what would it take to make the waves and shoreline read as real?**

> **Status.** This began as a forward-looking plan. Its recommendation — §6 option A, staged — has
> since been implemented in full (see [What the rework changed](#4-what-the-rework-changed)), so the
> document now describes the model **as built** rather than as proposed. The alternatives in §6 are
> kept as roads not taken; they remain accurate as a comparison. Numerical claims were measured
> against the code, historical ones against the pre-rework code and labelled as such — see
> [Evidence](#evidence).

---

## 1. What WaterSim actually is

It is a **pipe model** — an explicit, first-order, staggered-grid solver closely following Mei et
al. 2007, *Fast Hydraulic Erosion Simulation and Visualization on GPU*, with the pressure and
friction terms since brought into line with the shallow water equations.

**State.** Per cell: bed elevation `b = rock + sand`, water depth `w`. Per *edge* (staggered, not
per cell): a signed flux `flowX` across each x-edge, `flowZ` across each z-edge. A signed flux per
edge rather than Mei's four non-negative outflow pipes — the same model, more compactly stored.

**Each step does three passes:**

1. **Momentum.** For every edge, accelerate the flux down the free-surface gradient, then apply bed
   friction and clamp the implied velocity:

   ```
   f ← clamp( withDrag( f + g·h_edge·(H_i − H_j)·dt − v_avg·(∂u/∂n)·dt ) , ±(u_max·h_edge) )
   ```

   where `H = b + w` is the free-surface elevation (hydraulic head) and `h_edge` is the mean depth
   across the edge. `g·h_edge·ΔH` is the **depth-weighted** pressure term — the pipe's cross-section
   is proportional to depth, which is what gives `c = √(g·h)`. The advection term is upwind. `withDrag`
   is Manning bed friction, solved semi-implicitly (below). The clamp bounds the *velocity* at
   `u_max = MAX_VELOCITY = 8`, so the flux limit `u_max·h_edge` scales with depth rather than being a
   flat cap.

2. **Outflow limiting.** If a cell's outgoing fluxes would drain more than `w/dt`, scale them all
   down by `maxOut/outflow`. This is Mei's `K` factor, and it is what makes depth stay non-negative.

3. **Integration.** `w ← max(0, w + (Σinflow − Σoutflow)·dt + source·dt)`, plus the dirty mask and
   `velocityArr`. That last is now a true velocity — `min(meanFlux / w, u_max)` — which `Erosion`
   consumes.

**Manning friction, semi-implicit.** Rather than subtracting a drag term built from the old flux
(which can flip the flux's sign once `h` gets small), the new flux is solved implicitly:

```
withDrag(q) = q / ( 1 + g·n²·|q|·dt / h^(7/3) )
```

with `n = MANNING_N = 0.03`. This is stable at any depth and can never reverse the flux. It leaves
deep water almost undamped while a thin swash sheet slows quickly — the physical behaviour, replacing
the old flat `×0.95` per step.

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
| Pressure | `g·h·∂H/∂x` | `g·h_edge·ΔH` — **depth-weighted** | Wave speed follows `√(g·h)`: shoaling + refraction |
| Self-advection | `∂(q²/h)/∂x` | **absent** | No steepening into a true bore |
| Cross-advection | (part of the 2-D form) | present, upwind | Momentum turns with the flow |
| Friction | Manning/Chézy, `∝ q\|q\|/h^(7/3)` | semi-implicit Manning, same law | Deep water nearly undamped; thin swash slows |

Only the self-advection term is still missing, and §7 explains why that is the one deviation left to
rendering — it is the difference between a wave that *steepens and smears* and one that *breaks*.

---

## 2. Advantages of the current approach

These are real and worth protecting in any replacement.

- **Mass conservation is exact and structural.** Flux lives on the edge, so what leaves one cell
  provably enters its neighbour. No drift over hours of play. The `conserves total water volume`
  test passes because of the data layout, not because of tuning.
- **It is unconditionally robust.** The outflow limiter plus the velocity clamp mean it cannot
  explode, whatever the player builds. For a sandbox where the player can dig a 20-unit trench in
  one click, that matters more than it would in an offline solver.
- **Arbitrary terrain, dams, lakes, and wet/dry come free.** Dry cells simply have `w = 0` and
  don't flow. No special-casing the shoreline — which, as §6 notes, is where fancier schemes
  concentrate all their difficulty.
- **It couples cleanly to erosion.** `Erosion.transportSediment` reuses the very same edge fluxes
  to move sediment upwind, and `Erosion` reads the per-cell velocity for its capacity law. Any
  alternative must keep supplying per-edge flux and per-cell velocity.
- **O(N), local, cache-friendly, branch-light, and trivially portable to GPU** if it ever needs to
  be.
- **It is testable as pure functions.** 202 tests, no DOM, no WebGL. This is the constraint that
  should kill several of the alternatives below.

---

## 3. Erosion coupled to it

`Erosion` reads the water sim's per-cell velocity and per-edge flux each tick.

- **Capacity is stream power.** A cell's sediment capacity is `velocity · EROSION_K · surfaceSlope`,
  where `surfaceSlope` is the local gradient of the water surface `b + w`. Water carrying more than
  its capacity deposits the surplus; water carrying less picks sand up, bounded by `MAX_BED_RATE`.
  The slope factor is what makes it cut a channel rather than plane a flat sheet: speed alone cannot
  tell a river from a sheet wash, since a thin film over flat ground moves as fast as the deepest
  thread, so without slope every wet cell scours alike. With it, water gathering into a channel finds
  a steeper surface there than over the banks either side and cuts harder for it, so incision
  concentrates and the channel deepens instead of widening.
- **`MAX_BED_RATE` decouples stability from `EROSION_K`.** Moving the bed is a step change in the
  water surface above it, so an unbounded scour rate feeds back on itself — scour deepens the channel,
  the channel speeds the water, the faster water scours harder — until the sim tears itself apart.
  Capping the rate the bed may move per step keeps `EROSION_K` free as a pure tuning knob.
- **Channel width is set elsewhere.** The dominant control on how wide an eroded channel ends up is
  not in `Erosion` at all but in `Slope` — the talus angle of repose (32°). Too shallow an angle and
  the banks slump back as fast as the stream cuts them.

The units matter and were got wrong once: `velocity` must be a true `u = q/h`, not a flux. Feeding
`Erosion` a flux biases capacity by depth — deep slow water reports a large "velocity" and erodes
hard, exactly backwards from the thin fast swash that should scour most. `velocityArr` now divides
out the depth (§1, pass 3), which is what makes the capacity law read the right way round.

---

## 4. What the rework changed

The document originally diagnosed four things a shoreline needs, none of which the pre-rework model
had. Three are now present; the fourth is deliberately left to rendering (§7).

| Phenomenon | What it needs | Status |
|---|---|---|
| **Shoaling** (waves rise and steepen in shallows) | `c = √(g·h)` | ✅ depth-weighted pressure term |
| **Refraction** (crests bend to face the beach) | `c = √(g·h)` | ✅ same — emergent, nobody authors it |
| **Run-up / backwash** (the swash cycle) | waves that arrive with energy | ✅ travelling swell + Manning drag + sponge |
| **Breaking** (face steepens, collapses to a bore) | self-advection + shock capture | ❌ absent; see §6A cons and §7 |

Refraction being *emergent* is the pleasing part: waves crossing the sloping sea floor slow over the
shallows and bend toward shore on their own, given only `c = √(g·h)`. It is coupled to the swell
period — Snell's law only applies where depth varies slowly over a wavelength, so too long a period
makes the wavelength exceed the sea's width and nothing bends. The shipping period (2 s) is chosen
for this; see the note in `CLAUDE.md`.

---

## 5. Remaining drawbacks

The rework closed the depth-independence, non-physical damping, flux-as-velocity, and rigid-sea
problems that dominated the original assessment. What is left:

- **No true breaking.** Self-advection `∂(q²/h)/∂x` is absent, so a steepening wave face is smeared by
  upwind differencing rather than resolved into a clean bore. This is the one structural gap, and §7
  argues it is better answered in rendering than in the solver.
- **The velocity clamp is still a hard nonlinearity.** `MAX_VELOCITY = 8` bounds the implied speed,
  which silently discards momentum in the fastest water. Less binding than the old flat flux cap
  (the limit now scales with depth), but still a clip.
- **Four-neighbour pipes are anisotropic.** Flow prefers the grid axes; a circular dam break spreads
  as a diamond.
- **`max(0, …)` in the integration step can create water.** When the outflow limiter doesn't fully
  prevent a negative, the clamp quietly manufactures volume. Small, but it is the one hole in an
  otherwise exact conservation guarantee.

---

## 6. Alternatives (roads not taken)

### A. Fix the pipe model in place ⭐ *this is what was done*

Four staged changes, each independently tested and committed:

1. **Depth-weight the pipe.** `f += g · h_edge · ΔH · dt`. Mei's pipe cross-section `A` made
   proportional to depth instead of constant. Recovered `c = √(g·h)` → **shoaling + refraction**.
   (`13d7977`)
2. **Replace flat damping with depth-dependent drag** — semi-implicit Manning. Waves survive the
   crossing; shallow swash still slows realistically. (`5088f0b`)
3. **Drive swell from the deep boundary; stop pinning the sea.** A sinusoid drives the seaward rows
   at 30° off square-on, and a sponge layer absorbs outgoing reflections. Waves now travel in, shoal,
   bend, run up the beach, and wash back. (`1e33804`, `ed2f79b`, `bc90378`, `a380673`)
4. **Re-derive `velocityArr` as `flux/depth`.** Erosion finally gets a real velocity. (`d2da198`)

Plus the prerequisite fix for the sea-surface conflation bug (§8, `f3c8d37`), without which there was
no flat sea to judge the wave work against.

**Pros, realised.** Kept every advantage in §2 — conservation, robustness, erosion coupling, test
suite, architecture. Fitted the project's TDD and commit-per-step discipline exactly: each step an
observable behaviour change. Delivered 3 of the 4 phenomena in §4.

**Cons, still true.** No *true* breaking — upwind differencing smears a steepening face rather than
resolving a clean bore. Momentum isn't in conservative form. Pushed further than this, it would
become option B by accident, badly.

**Stability.** Removing the damping crutch means CFL matters. At the sea's deepest (22), `c = √(9.8 ×
22) ≈ 14.7` cells/s, so `CFL = c·dt/dx = 14.7/30 ≈ 0.49` — inside the explicit limit, no substepping
needed. The swell is driven at `SWELL_SPEED = 14`, matching that deep-water celerity. Deepening the
sea past about −40 would push `CFL > 0.65` and force substepping.

### B. Proper finite-volume SWE (well-balanced, shock-capturing)

Kurganov–Petrova central-upwind or an HLLC Riemann solver, with hydrostatic reconstruction, MUSCL
slope limiting, and explicit wet/dry handling.

**Pros.** All four phenomena, including genuine breaking — bores are shocks and the scheme captures
them properly. *Well-balanced* means a lake at rest stays exactly at rest with no spurious currents
over a sloping bed. True velocities for erosion. It is the physically correct answer.

**Cons.** Substantially more code, and subtle in a way that resists incremental development — you
cannot half-build a Riemann solver and commit it green. Worse, the notorious failure mode of these
schemes is **wet/dry fronts** (negative depths and spurious velocities as `h → 0`), and a beach is
nothing *but* wet/dry front. The risk is concentrated precisely where the payoff is. Cost is roughly
3–10× per cell.

**Verdict.** Correct but disproportionate. A multi-week numerics project to win one phenomenon
(breaking) that §7 argues is mostly a rendering problem.

### C. Linear wave-equation heightfield over the sea

`∂²h/∂t² = ∇·(g·h·∇h)`, Verlet-integrated, blended against the pipe model near shore.

**Pros.** Very cheap, well-behaved, and `c = √(g·h)` gives shoaling and refraction for free. The
classic games approach to open water.

**Cons.** Linear — no breaking, and crucially **no mass transport**, so it cannot produce run-up or
feed the erosion system. It models surface displacement, not moving water. Needs a blend region
against the pipe model, and the blend will be visible exactly at the shoreline. The pipe model now
gets shoaling and refraction anyway, so this buys nothing it doesn't already have.

**Verdict.** Good for deep water, useless at the shore — which is the actual target. Wrong tool for
this specific complaint.

### D. Kinematic ocean (Gerstner sum, or FFT/Tessendorf)

Not a simulation: a displacement function of `(x, z, t)`.

**Pros.** Beautiful and nearly free. Gerstner's sharp crests and flat troughs are exactly the shape
of real swell. Fully art-directable — swell period and direction become dials.

**Cons.** No mass, no interaction with terrain. Player-built dams would do nothing, which is the
entire game.

**Verdict.** Not a replacement — **but the right *source* for waves.** The current swell driver at the
deep boundary is the simple sinusoidal version of exactly this idea; a Gerstner sum could replace it
without touching the physical sim that carries the swell shoreward. Steal the idea, not the
architecture.

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
non-negotiable TDD workflow and 202 passing tests.

**Verdict.** Solves a problem the project doesn't have. The shoreline was wrong for *physics* reasons,
not flops — the sim isn't the bottleneck for realism. Revisit only if breaking work turns out to need
heavy substepping.

---

## 7. What remains, and where breaking should live

Option A is done. The one phenomenon left is breaking, and the recommendation is **not** to reach for
option B to get it:

**Breaking is mostly a rendering problem, not a simulation problem.** Now that shoaling makes the
crest genuinely steepen, the steepness is measurable (via `∂H/∂x` or the flux ratio) — detect it and
render foam and spray. Full shock capture buys the physics of the bore, but what reads as a breaker to
a player is *whitewater*. For a 2.5D isometric sandbox, foam is a few percent of B's cost for most of
B's payoff.

Option B is the right answer to a question this project isn't asking.

---

## 8. The sea-surface bug, fixed (historical)

**`Waves` once treated sea level as a depth while `Grid` treated it as an elevation, so the sea
surface was a ramp diving to −19 rather than a flat plane.** This was the prerequisite fixed before
any wave work (`f3c8d37`); it is recorded here because the *lesson* outlived the bug.

- `Grid.initBeach` sets `water[i] = seaLevel − rock[i]`, a depth chosen so the *surface elevation*
  lands at `Grid.seaLevel`. Correct: the sea starts flat.
- The old `Waves.step` then assigned a *depth* to every sea cell, ignoring the bed beneath it. Since
  the floor slopes to −20, the surface was dragged down with it.

**Why the green tests missed it.** `initBeach` was exercised only in `grid.test.ts`; `waves.test.ts`
built its own flat `rock = 1` grid. Nothing composed the real beach with `Waves`, so the two
conventions were never in the same room. The fix made `Grid.seaLevel` the single source of truth (an
elevation, `= 2.0`), and `Waves.step` now derives depth as `max(0, seaSurface − bed)`. `CLAUDE.md`
carries the general form of the lesson: *when a value could be read as either a depth or an elevation,
name it for which it is.*

---

## Evidence

The wave-behaviour measurements below are of the **pre-rework** model — they are what motivated option
A, and are kept as the record of the problem it solved. The current model behaves differently by
design (wave speed now follows `√(g·h)`, disturbances survive the crossing). Measured by driving the
real classes via `tsx`.

**Pre-rework: wave speed was independent of depth.** A 1-unit bump in a flat 200-cell channel, 2
seconds:

```
  depth= 1   front reached x=28   |  SWE predicts c=3.13 cells/s → x≈26
  depth= 5   front reached x=28   |  SWE predicts c=7.00 cells/s → x≈34
  depth=20   front reached x=28   |  SWE predicts c=14.0 cells/s → x≈48
```

Identical at every depth, where physics demands the depth-20 wave outrun the depth-1 wave by 4.5×.
This is what foreclosed shoaling and refraction, and what the depth-weighted pressure term fixed.

**Pre-rework: damping killed disturbances in about a second.** Peak deviation of the same bump, depth
5:

```
  t=0s  1.0000     t=1s  0.2387     t=2s  0.1132
  t=3s  0.0720     t=4s  0.0562     t=5s  0.0491
```

76% of the amplitude gone after one second — a wave crossing the ~56-cell sea would have been gone
many times over, which is why the old `Waves` had to inject its surge four rows from the beach.
Semi-implicit Manning drag replaced this, leaving deep water nearly undamped.

For the current erosion behaviour, the measurements that drove the stream-power capacity law and the
32° angle of repose are in the commit messages for `b4d2900` and `688175d`.
