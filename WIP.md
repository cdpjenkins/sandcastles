# WIP

## Current Task
Deepen the sea floor: rock height should slope linearly from 0 at `seaStart` to -20 at `depth-1` (currently flat at 1.0, making the sea uniformly ~1 unit deep). Water height in the sea region should be recomputed as `seaLevel - rock` so the water surface stays flat while depth increases away from shore. Land side (`z < seaStart`) unaffected.

## Status: ⏸️ WAITING
Implemented linear rock slope (0 at seaStart to -20 at depth-1) and recomputed water height (`seaLevel - rock`) in the sea branch of `Grid.initBeach()`. Full suite (185 tests) and `tsc --noEmit` are clean. Refactor assessed: minimal diff, consistent with existing style, no refactor needed. Manually verified via tsx that rock slopes correctly and rock+water stays flat at seaLevel (2.0) across the sea.

## Next Action
Awaiting commit approval.
