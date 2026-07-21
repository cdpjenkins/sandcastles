# WIP: Tool-selector radio group

See PLAN.md for the full plan.

## Current step

**Step 2** — clicking a tool's radio fires `onToolChange` with that mode;
selection is exclusive.

Status: ⏸️ WAITING (complete — awaiting commit approval)

## Next action

Commit step 2, then start **Step 3**: `setTool(mode)` checks the right radio and
sets `data-selected`, without firing `onToolChange`.
