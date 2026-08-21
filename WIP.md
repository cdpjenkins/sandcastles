# WIP: Export and import the beach as a JSON file

`PLAN.md` has the design. The game already snapshots itself into IndexedDB, but
a player cannot get a beach out of the browser. Adding an Export button (enabled
only while paused) that writes a JSON file, and an Import button that reads one
back.

Cell layers travel as base64 rather than JSON numbers: measured 2.80 MB against
~5 MB, and bit-exact where a 4 dp rounding would round away the sediment
columns (~1e-6) and the drying film (~1e-4).

## Current Step

Step 3 complete. Next: Step 4, `toGameFile` — `GameSnapshot` to the file
object, layers encoded, scalars verbatim, `encoding` and `savedAt` stamped.

## Status

⏸️ WAITING — suite green (314), tsc clean, build clean.

## Completed

- [x] Step 1: `encodeCells` / `decodeCells` round-trip a layer through base64
      bit-exactly. Chunked at 0x8000 bytes because `String.fromCharCode` takes
      its bytes as arguments and a 262,144-byte layer overflows the call stack.
      Decode treats its input as hostile: not-base64 and wrong-cell-count both
      give `null`. Encode honours a view's `byteOffset`/`byteLength`.
- [x] Step 2: `Bucket.setAmount` sets rather than adds, clamped to
      `[0, capacity]`. `fill` stays as it is — expressing it via `setAmount`
      would clamp `fill(-1)` at zero, which no test covers.
- [x] Step 3: `applySnapshot` puts a fresh game into the state a snapshot
      describes, camera included, so boot and import share one path. Verified
      by mutation that the round-trip test catches both a dropped camera and a
      bucket that adds instead of sets.
- [ ] Step 4: `toGameFile`
- [ ] Step 5: `parseGameFile`
- [ ] Step 6: `exportFilename`
- [ ] Step 7: Toolbar Export and Import
- [ ] Step 8: Wire into `Game`
- [ ] Step 9: Verify in the browser
