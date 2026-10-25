# Plan: extract the beach generator as version 1

## Context

The beach is generated in four places: the shape constants, noise and terrain
in `Grid` (`initBeach`, `initSpring`, `hashNoise`/`smoothNoise`/`fractalNoise`),
seed text in `BeachSeed`, spring placement in `SpringSite`, and the assembly in
`newGameSnapshot`. A fifth, `Game`'s first boot, repeats the generation by hand.

This plan gathers all of it into a **version 1 generator**, frozen, and records
in every save which generator built the beach. A later v2 can then change how
beaches grow without changing any beach v1 grew: restarting a v1 beach, or
regenerating one from its seed, gives back the same beach forever.

CLAUDE.md asked for exactly this decision before the next change to what a seed
grows. This is that decision.

### Decisions taken up front

- **Extract and version.** Saves record the generator (`generator: 1`).
  Snapshot version 4. v1's code is frozen; changes go into a v2 beside it.
- **v1 owns everything it calls**: the shape constants, the noise, the
  terrain, the classic spring, and its own copy of the spring scoring and
  placement (`SpringSite.ts` moves into v1). A later v2 copies what it wants
  to change rather than editing v1's. Duplication is the price of freezing.
- **Shared and frozen already:** `seedFromText`, which is part of the save
  format and belongs to every generator.
- **v1 has its own spring rate**, 1.0, rather than `STREAM_RATE`. That
  constant is shared with the player's Stream tool (`Game.ts:337`); tuning the
  tool must not change every v1 beach.
- **The sea is a value per beach, set by the generator, held on `Grid`.**
  `seaStart` and `seaLevel` stay on `Grid` because the sim reads them every
  step, but the generator sets them instead of the constructor deciding. One
  value each per beach - a straight shoreline. A shoreline that curves across
  the beach would need a value per column and is not this.
  - **They are stored in the snapshot.** Today they are recomputed from the
    grid's size; once a generator can choose them, a reload must restore them.
  - **`new Grid(w, d)` keeps today's values as defaults**, so the hundred-odd
    grids built in tests without a generator behave as now.
  - A v2 that moves them needs its own sweep first: the tide, the swell,
    refraction and castle survival were all tuned against today's sea. That is
    v2's problem, recorded here so it is not forgotten.
- **Classic is a v1 idea.** `seed: null` is valid only for a generator that
  has a classic beach; v1 does, and a v2 will not. The guard refuses a save
  claiming otherwise.
- **New seeds use the newest generator.** Random and typed seeds get
  `LATEST_GENERATOR`; *Restart this beach* keeps the beach's own generator;
  *Classic* is always v1. Choosing an older generator is left open, not built:
  everything downstream of the dialog carries a generator version, so adding a
  way to pick one later touches only the dialog and `resolveBeach`.
- **The version is visible.** The Hud reads `Beach: salty-gull-42 (v1)` and
  `Beach: classic (v1)`; the dialog's restart option names it too. Typing an
  old version waits until a v2 exists.
- **The version goes in the export filename:**
  `sandcastles-v1-salty-gull-42-2026-10-25T10-00-00.json`. Version first, so a
  directory of exports sorts by generator, then beach, then time. The filename
  is still only a label; import reads the version from inside the file.
- **Old saves are v1, as a fact.** A v3 save migrates to v4 as `generator: 1`
  with today's `seaStart` and `seaLevel` for its depth: every beach that exists
  was built by what is about to become v1.

## Design

### The generator

```ts
// src/core/generators/BeachGenerator.ts
export interface BeachGenerator {
  readonly version: number
  readonly hasClassic: boolean
  // Lays out sea, rock, sand, water and the spring on a fresh grid.
  generate(grid: Grid, seed: BeachSeed): void
}

export interface BeachSpec {
  generator: number
  seed: BeachSeed
}

export const LATEST_GENERATOR = 1
export function generatorFor(version: number): BeachGenerator | null
```

`src/core/generators/v1/` holds `BeachGeneratorV1.ts` (constants, noise,
terrain, classic spring, the sea) and `SpringSiteV1.ts` (today's
`SpringSite.ts`, moved whole). v1's header says it is frozen and why, and
points at the checksums that hold it.

### `Grid`

Loses `initBeach`, `initSpring` and the noise. Gains `setSea(seaStart,
seaLevel)`; `seaStart` and `seaLevel` become private-set, public-read. The
constructor's defaults stay today's numbers.

### The snapshot (version 4)

`GameSnapshot` gains `generator: number`, `seaStart: number`, `seaLevel:
number` beside `seed`. `isValidSnapshot`: `generator` is one `generatorFor`
knows; `seed` is `null` only where that generator `hasClassic`; `seaStart` an
integer inside the grid; `seaLevel` finite. `applySnapshot` calls
`grid.setSea`. `createSnapshot` reads them from the grid and the game's
`BeachSpec`. `GameFile` carries them as scalars, and the file's own version
follows the snapshot's as before. `migrateSnapshot` gains v3 -> v4.

### New games

`newGameSnapshot(width, depth, spec: BeachSpec)` builds a `Grid`, calls
`generatorFor(spec.generator).generate(grid, spec.seed)`, and snapshots it.
`resolveSeed` becomes `resolveBeach(choice, current: BeachSpec, random):
BeachSpec`. `Game` holds a `BeachSpec` where it held a seed, and its first boot
goes through `newGameSnapshot` + `applySnapshot` like a new game, instead of
calling `initBeach` itself.

## Steps

Each step is a RED-GREEN-REFACTOR cycle, committed on its own once `npm test` and
`tsc --noEmit` are clean. Steps 3 and 4 are pure moves: no test's expectation
changes, only where it imports from.

1. **Pin a seeded beach, whole.** Checksums of every layer `newGameSnapshot`
   produces - rock, sand, water, source - for two seeds, and water and source
   for classic (rock and sand are pinned already). Written before anything
   moves; must hold unchanged through every later step.
2. **`Grid.setSea`.** Sets both; the defaults are unchanged; `snapshot`/
   `restore` are unaffected (the sea is restored by `applySnapshot`, step 6).
3. **Extract v1's terrain.** Constants, noise, `initBeach`, `initSpring` move
   into `BeachGeneratorV1`; `generate` sets the sea explicitly to today's
   values, then the terrain, then the spring. The beach-shape tests in
   `grid.test.ts` move to `beachGeneratorV1.test.ts`; the other test files
   build beaches through v1. Step 1's checksums hold.
4. **Move spring placement into v1.** `SpringSite.ts` -> `v1/SpringSiteV1.ts`,
   with its tests; v1's spring rate becomes its own constant. Checksums hold.
5. **The registry and `BeachSpec`.** `generatorFor`, `LATEST_GENERATOR`;
   `newGameSnapshot` takes a `BeachSpec`; `Game`'s first boot goes through it.
   `generatorFor` of an unknown version is `null`.
6. **Snapshot v4.** The three fields through `createSnapshot`, the guard,
   `applySnapshot`, `GameFile`, and the v3 -> v4 migration (and v1 -> v4
   through every step). A guard test that a v1 classic is fine and a
   generator without a classic beach refuses `seed: null` (a test double, since
   v2 does not exist).
7. **`resolveBeach`.** Classic -> `{1, null}`; random and chosen ->
   `LATEST_GENERATOR`; restart keeps the current generator and seed. `Game`
   holds a `BeachSpec`.
8. **The version is shown.** Hud `Beach: <seed or classic> (v<n>)`; the
   dialog's restart option names the version.
9. **The export filename carries it.** `sandcastles-v<n>-<seed>-<stamp>.json`,
   and `sandcastles-v<n>-<stamp>.json` where the seed cleans to nothing.
10. **Verify in the browser.** Classic, random, typed and restart each look as
    before and show `(v1)`; reload and an import keep the beach and its
    version; the export name carries `v1`; an export from before this imports
    as v1.
11. **CLAUDE.md** - what v1 freezing means and what it costs, `hasClassic`, the
    sea as per-beach state, v1's own spring rate, and the rule for v2: copy,
    don't edit, and sweep before shipping anything that moves the sea.

## Out of scope

- **A v2 generator.** This only makes room for one.
- **Choosing a generator in the dialog, or typing `v1:seed`.** Left open by
  `BeachSpec`; built when a v2 exists.
- **A shoreline that varies across the beach.**
