# WIP

## Current Task
User reported rock fade (above) didn't fully work: sand was still visible right next to seaStart. Root cause: the shore fade was only ever applied to `rock`, never to `sand` — sand's noise term (amplitude 6, unfaded) can still produce ~2 unit mounds right at the shoreline. Fix: apply the same `shoreFade` factor to the sand formula too.

## Status: ⏸️ WAITING
Applied the same `shoreFade` factor already computed for rock to the sand formula in `Grid.initBeach()`. Both rock and sand now fade out together over the 25 units nearest seaStart; unchanged beyond that. Full suite (187 tests) and `tsc --noEmit` clean. Refactor assessed: one-line change, consistent with existing pattern, no further cleanup needed. Verified via tsx: combined surface height at 1 unit from seaStart is 0.31 (was up to ~1.7 before), full strength (5.91) restored by 25 units out.

## Next Action
Awaiting commit approval.
