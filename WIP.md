# WIP

## Current Task
Suppress rock height noise immediately next to seaStart (linear fade over 25 grid cells), so no rock spikes poke through near the shoreline. Rocks more than 25 units from seaStart keep their existing appearance.

## Status: ⏸️ WAITING
Implemented linear fade of `rockNoise` in `Grid.initBeach()` based on distance from `seaStart` (0 at the shoreline, full strength at 25+ grid cells away). Full suite (183 tests) and `tsc --noEmit` are clean. Refactor assessed: change is small and consistent with surrounding style, no refactor needed.

## Next Action
Awaiting commit approval.
