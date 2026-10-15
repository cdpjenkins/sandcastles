# Plan: choose the beach a new game starts on

## Context

New game (`confirmNewGame` -> `startNewGame` -> `newGameSnapshot`) always builds
the same beach. The generator is already deterministic: `Grid.hashNoise` is a
pure hash of `(x, z)`, so today's beach is in effect one hard-coded seed. This
plan lets the player pick what a new game starts on:

- **Classic** - the beach every game has started on so far.
- **Restart this beach** - the current beach's seed, regenerated.
- **Random** - a fresh seed, shown to the player so it can be shared or replayed.
- **Choose a seed** - text the player types.

### Decisions taken up front

- **Only the rock and sand noise varies.** The ridge, the sea's place and depth,
  and the spring's position (top-centre) are the same on every seed, for now.
- **Seeds are text**, hashed to 32 bits. The hash is part of the save format from
  the moment it ships, so it is a fixed FNV-1a rather than anything that could be
  "improved" later.
- **Classic is `null`, not a seed value.** Mixing seed 0 into the hash reproduces
  today's beach exactly, but if classic were *a text* some typed string would
  collide with it, and if it were the number 0 a hash could land on it. `null`
  cannot be typed.
- **The seed is stored in the snapshot and the file** (version 3), and shown in the
  Hud. Restoring does not need it - `rock` and `sand` are stored - but showing and
  restarting do.
- **The "destroys your beach" warning stays a separate step** after the chooser.
  Choosing an option is not consent to lose the beach.
- **N opens the chooser**, as the New game button does.

### The seed sweep (done before planning)

Every scene in CLAUDE.md was tuned on the classic beach, so 50 seeds (`s1`..`s50`)
were run for 300s through the full `Game.simStep` pipeline in a scratch probe
that XORed the seed into `hashNoise`:

| | classic | 50 seeds: min / median / max |
|---|---|---|
| NaN or negative depth | none | none |
| Open-sea mean surface vs tide | 0.17 | 0.11 / 0.15 / 0.26 |
| Deepest closed depression on land | 3.0 | 2.0 / 3.5 / 7.0 |
| Deepest standing water inland | 5.2 | 3.2 / 5.5 / 9.4 |
| Highest rock | 16.4 | 13.8 / 17.8 / 20.9 |

No seed needs constraining. The deep-lake advection instability set in at depth
~22; the deepest any seed reached is 9.4. (Max velocity pinned at `MAX_VELOCITY`
for every seed, classic included, so it measured the cap and says nothing.)

The one difference is the stream: classic's reaches the sea at 185s, and only 17
of 50 seeds' did inside 300s (65-285s). The rest are ponding in a depression or
still soaking. **Accepted** - a stream that pools is a fine beach, and the player
digs channels anyway.

## Design

### Seeding the generator

`initBeach(seed: number = 0)` threads the seed down through `fractalNoise` and
`smoothNoise` into `hashNoise`, which XORs it into `h` before the avalanche.
Seed 0 is the identity, so classic is byte-identical by construction - and a test
pinned *before* the change proves it.

`seedFromText(text)` is FNV-1a over the UTF-16 code units, `| 0`. `noiseSeed(seed:
string | null)` is `0` for `null` and `seedFromText` otherwise. Text is trimmed;
an empty seed cannot be started (the dialog disables Start).

### Random seeds are readable

`randomSeed(random: () => number)` returns `word-word-NN` from two short beach word
lists (e.g. `salty-gull-42`) - something a player can read aloud. The random
source is injected so the test can pin it.

### The snapshot carries the seed

`GameSnapshot.seed: string | null`, `SNAPSHOT_VERSION` 3. `isValidSnapshot`
requires `seed` to be a string or `null`. `migrateSnapshot` gains v2 -> v3 setting
`seed: null` - which is *true*, not a guess: every beach before this shipped was
classic. It chains after v1 -> v2. `GameFile` follows the snapshot's version and
needs only the seed passed through as a scalar.

`createSnapshot` takes the seed from `SnapshotSources`; `Game` holds the current
seed and adopts it from whatever it restores, imports or starts.

### The choice, as data

```ts
type NewGameChoice =
  | { kind: 'classic' }
  | { kind: 'restart' }
  | { kind: 'random' }
  | { kind: 'chosen'; text: string }
```

`resolveSeed(choice, currentSeed, random)` turns it into a `string | null`.
`confirmNewGame` takes the resolved seed and keeps its injected `ask`; declining
still returns `null` and changes nothing. `newGameSnapshot(width, depth, seed)`
builds from real components as today. Restart regenerates from the seed: should
the generator's constants ever change, a restarted beach will differ from the one
first played, which is acceptable and recorded.

### The dialog

`NewGameDialog` (`src/input/`) is plain DOM, tested under jsdom like `Toolbar`:
four radio choices, a seed text field (enabled only for *Choose a seed*), Start
and Cancel. Start is disabled while *Choose a seed* has an empty field. Escape
and Cancel close it with no choice. `onChoose(handler)` reports a
`NewGameChoice`; the random seed is resolved *after* the dialog, so the dialog
never needs a random source.

**The game's keys must not fire while it is open.** `Game.onKeyDown` listens on
`window`, so typing `r` into the seed field would reset the water, `n` reopen the
chooser and `s` pick the Spade. The dialog stops propagation of keydown from
inside itself, and `Game.onKeyDown` returns early while `dialog.isOpen` - both,
since the first alone misses focus sitting elsewhere while it is open.

## Steps

Each step is a RED-GREEN-REFACTOR cycle, committed on its own once `npm test` and
`tsc --noEmit` are clean.

1. **Pin the classic beach.** A `grid.test.ts` test asserting a checksum of
   `rock` and `sand` from `initBeach()` today. Written and committed *before* the
   generator is touched; it must pass unchanged through every later step.
2. **Seeded noise.** `initBeach(seed)`: default and `0` keep step 1 green; two
   seeds give different sand; the same seed twice is identical; the sea rows are
   the same on every seed.
3. **`seedFromText` and `noiseSeed`** - `src/core/BeachSeed.ts`. Stable known
   values (pins the hash), `null` -> 0, trimming.
4. **`randomSeed(random)`** - format, and determinism under a pinned source.
5. **Snapshot v3.** `seed` through `createSnapshot`, `isValidSnapshot` (string or
   `null`, rejects others and a missing field), `migrateSnapshot` v2 -> v3 and
   v1 -> v3, and the `GameFile` round trip.
6. **`resolveSeed` and seeded `newGameSnapshot` / `startNewGame` /
   `confirmNewGame`.** Each choice gives the expected seed and beach; restart of a
   classic game is classic; declining still changes nothing; the round trip
   through `createSnapshot` still holds with the camera exempt.
7. **`NewGameDialog`.** Opens and closes; each choice reports the right
   `NewGameChoice`; Start disabled on an empty seed; Escape cancels; keydown inside
   does not reach `window`.
8. **The Hud shows the seed** - `Beach: classic` / `Beach: salty-gull-42`.
9. **Wire into `Game`.** Button and N open the dialog; `onKeyDown` ignores keys
   while it is open; a choice -> `resolveSeed` -> `confirmNewGame` (the warning) ->
   adopt state and seed -> rebuild mesh -> Hud. Import and restore adopt the
   seed too.
10. **Verify in the browser.** Each of the four options; type a seed containing
    `r`, `n`, `s`, `p` and check nothing else happens; a random seed shown in the
    Hud, typed back in, gives the same beach; reload keeps the seed; export and
    import carry it.
11. **CLAUDE.md** - the sweep's figures, why classic is `null`, and that the hash
    is now part of the save format.

## Out of scope

- **Varying the spring's position, the shoreline or the ridge per seed.**
- **Steering a seed's stream to the sea.** Measured and accepted above.
- **A seed in the URL** for sharing by link.
