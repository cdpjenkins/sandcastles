# WIP: Export and import the beach as a JSON file

`PLAN.md` has the design. The game already snapshots itself into IndexedDB, but
a player cannot get a beach out of the browser. Adding an Export button (enabled
only while paused) that writes a JSON file, and an Import button that reads one
back.

Cell layers travel as base64 rather than JSON numbers: measured 2.80 MB against
~5 MB, and bit-exact where a 4 dp rounding would round away the sediment
columns (~1e-6) and the drying film (~1e-4).

## Current Step

Step 7 complete. Next: Step 8, wiring into `Game` — Export builds the file and
downloads it; Import reads a chosen file, parses it, confirms, then applies it
and rebuilds the terrain. The Blob download and the file input are plumbing
only; every decision in the feature is already tested above.

## Status

⏸️ WAITING — suite green (339), tsc clean, build clean.

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
- [x] Step 4: `toGameFile` turns a snapshot into the file object. Takes the
      timestamp as an argument rather than reading the clock. `GridLayerFile`
      and `FlowLayerFile` are mapped types over the sim's own snapshot shapes,
      so a layer added to the sim is a compile error here rather than a layer
      quietly missing from every exported file — verified by adding one.
- [x] Step 5: `parseGameFile` reads a file back, decoding the layers and then
      deferring to `isValidSnapshot` rather than growing a second set of rules.
      The explicit null check on the decoded groups turned out to be dead - the
      guard already rejects a null group - so it went. Every remaining guard
      was mutation-checked against the test that holds it up.
- [x] Step 6: `exportFilename(date)` names the download. Dashes because a
      colon is illegal in a Windows filename; the ISO form otherwise, so a
      directory of exports sorts into the order it was saved.
- [x] Step 7: Toolbar gained Export (disabled unless paused), Import (never
      disabled, deliberately) and `setStatus`. The status is its own element
      because `updateHud` rewrites the readouts every frame. jsdom's `.click()`
      honours `disabled`, so the gate needs no second guard in the handler.
- [ ] Step 8: Wire into `Game`
- [ ] Step 9: Verify in the browser
