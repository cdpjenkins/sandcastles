# WIP: Evaporation as a real, ungated sink

`Drying` was a numerical cleanup for a drainage artifact wearing evaporation's
clothes: it gated on `FILM_DEPTH = 0.01` and removed water at `0.02/s` below
that, zero above. The gate made the rate a step function of depth — water at
0.011 never dried, water at 0.009 dried in half a second — and an advancing
sheet's leading edge lives permanently inside that band, so a thin sheet was
annihilated at its tip while a deeper channel crossed free. Measured: a steady
sheet fed onto a dry slope reached cell 28 without drying and cell 0 with it.

Replacing it with a true zeroth-order sink: `dh/dt = -k` at every depth, so
time-to-dry is `h/k` and the volume ratio alone makes films vanish while
puddles persist. Cells at or below the tide-adjusted sea surface are exempt —
they are the sea, replenished by the ocean they belong to, and `Sponge`
already pins the seaward rows to the swell.

Renaming to `Evaporation`, which is what it now genuinely is.

## Current Step

None - work complete.

## Status

⏸️ WAITING - suite green (335), tsc clean apart from the pre-existing
`fake-indexeddb` dev-dependency error in `indexedDbSnapshotStore.test.ts`.

## Completed

- [x] Step 1: `Evaporation` takes the same depth from every wet cell per
      second, with no threshold. Renamed from `Drying`, which described the
      numerical cleanup it used to be rather than the sink it now is.
- [x] Step 2: cells at or below the tide-adjusted sea surface are exempt —
      they are the sea, replenished by the ocean they belong to. `step` takes
      that elevation the way `Waves` and `Sponge` already do. Measured: beach
      volume over 180s is 189702.2 -> 189702.2, unchanged.
- [x] Step 3: wired into `Game.simStep`, which already had `seaSurface` to hand.

## Verified

- The reported bug: a sheet fed onto a dry slope reached cell 27 of 28 against
  the no-sink baseline, where under `Drying` it reached 0. At feed 0.1 and
  above the advance is byte-identical to no sink at all.
- Castle under 120s of waves loses 6.6% of its sand with evaporation against
  6.8% without, so `CRITICAL_POWER` is undisturbed.

## Notes

`EVAPORATION_RATE = 0.00002` is the user's choice, accepting that float32
quantisation makes the sink progressively lossier with depth — ~2% short at
depth 1, ~29% at depth 5, and nothing at all by depth 20. Films and shallow
puddles, the target of the feature, are unaffected. Recorded so it is not
rediscovered as a bug.
