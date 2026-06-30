# Sandcastles — Claude Instructions

## Commit discipline

**Commit after every completed step, not at the end of a milestone.**

After each RED-GREEN-REFACTOR cycle is done and `npm test` + `tsc --noEmit` are clean:

1. Stage the relevant files
2. Commit immediately
3. Then move to the next step

This keeps every step independently revertable.

## WIP.md discipline

**Update WIP.md after every step.**

- Before starting a step: set status to 🔴 RED and record the current step
- After tests pass: update to 🟢 GREEN
- After refactor assessment: update to ⏸️ WAITING and mark the step complete
- After commit: update Next Action to the next step

WIP.md must always reflect reality. If it doesn't match what's actually happening, update it immediately.
