# WIP: Tool-selector radio group

See PLAN.md for the full plan.

## Current step

**Step 3** — `setTool(mode)` checks the right radio and sets `data-selected`,
without firing `onToolChange`.

Status: ⏸️ WAITING (complete — awaiting commit approval)

## Next action

Commit step 3, then start **Step 4**: Look toggle button fires `onLookToggle`
with the new boolean; `setLook` reflects pressed state without firing.
