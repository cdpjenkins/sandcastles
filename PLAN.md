# Plan: Tool-selector radio group in the top HUD

## Goal

Add a UI for choosing the active tool (Spade / Dump / Stream) to the existing
top-of-screen HUD. A radio button group selects one tool at a time, deselecting
the others, with a clear visual indication of the current selection. A **Look**
toggle button and a momentary **Reset water** button live in the same bar,
independent of the radio group.

## Design

Fold the top HUD into one styled, interactive bar containing, left-to-right:

- A **radio group** of three tools: ⛏ Spade · 🪣 Dump · 💧 Stream
- A **Look** toggle button — independent of the radio group (not a radio),
  reflects and controls `lookEnabled`
- A **Reset water** button (not a radio — momentary action)
- The existing **readouts** (bucket / wave / sea level) as text

Native `<input type="radio" name="tool">` inside `<label>`s gives real
exclusivity, keyboard arrow-navigation, and accessibility for free. The checked
tool gets a `data-selected="true"` attribute plus a highlight style. Tests
assert the attribute / `checked` state, not colour values (per the CLAUDE.md
"don't pin magic values" guidance).

### Look stays independent of `toolMode`

`lookEnabled` remains fully independent of `toolMode` — you can look while any
tool is active, exactly as today. The Look button is a plain toggle (pressed /
unpressed), not part of the radio group, and does not change or read
`toolMode`. `ToolMode` is unchanged (Spade / Dump / Stream only).

## Changes

### New module: `src/input/Toolbar.ts`

A UI module owning the bar's DOM. Pure DOM + selection state, no game logic:

- Renders one radio per `ToolMode` + a Look toggle button + a Reset button + a
  readouts `<span>`
- `onToolChange(cb)` — fires with the `ToolMode` when the user picks a radio
- `onLookToggle(cb)` — fires with the new boolean when the Look button is
  clicked
- `onReset(cb)` — fires when Reset is clicked
- `setTool(mode)` — checks the matching radio and updates `data-selected`
  **without** firing `onToolChange` (used to reflect keyboard changes)
- `setLook(enabled)` — sets the Look button's pressed state (`aria-pressed` /
  `data-selected`) **without** firing `onLookToggle` (reflects the `L` key)
- `setReadouts(text)` — updates the text span
- `element` — the root div to append to `document.body`

### `src/input/Tools.ts`

- Unchanged. `ToolMode` stays Spade / Dump / Stream.

### `src/core/Game.ts` wiring

- Replace the text-only `hud` div with a `Toolbar` instance (merged bar,
  `pointer-events:auto`).
- `lookEnabled` stays a plain independent boolean (unchanged semantics).
- `toolbar.onToolChange(mode => this.selectTool(mode))`;
  `toolbar.onLookToggle(enabled => this.setLook(enabled))`;
  `toolbar.onReset(() => this.resetWater())`.
- New `selectTool(mode)` sets `this.toolMode`, refreshes readouts, and calls
  `toolbar.setTool(mode)` — so keyboard (S/D/W) and clicks stay in sync through
  one path.
- New `setLook(enabled)` sets `this.lookEnabled`, toggles the look panel, and
  calls `toolbar.setLook(enabled)` — so the `L` key and the Look button stay in
  sync.
- `onCellPick`: unchanged (Spade / Dump / Stream only).
- Keyboard: `L` toggles Look via `setLook`; `R` still resets; `S` / `D` / `W`
  route through `selectTool`.
- `updateHud()` → builds the readout string and calls `toolbar.setReadouts(...)`.
- Update the help-overlay text (note the Look and Reset buttons).

## TDD steps

Each step: RED → GREEN → refactor assessment → `npm test` + `tsc --noEmit`
clean → commit, updating WIP.md.

1. `Toolbar` renders a radio per tool mode (assert one input per mode, correct
   labels / values).
2. Clicking a tool's radio fires `onToolChange` with that mode; selection is
   exclusive.
3. `setTool(mode)` checks the right radio and sets `data-selected`, **without**
   firing `onToolChange`.
4. Look toggle button fires `onLookToggle` with the new boolean; `setLook`
   reflects pressed state **without** firing `onLookToggle`.
5. Reset button fires `onReset`.
6. `setReadouts` updates the text span.
7. Wire `Toolbar` into `Game` and remove the old `hud` div; keep `lookEnabled`
   independent; update help text. (Game is untested like the other
   orchestrators — verified by running the app.)

## Verification

`npm test` + `tsc --noEmit`, then run the app (`npm run dev`) to confirm:

- Clicking each tool selects it exclusively with a visible highlight
- Keyboard shortcuts move the selection
- Reset clears water
- Readouts still update

## Notes / scope

- Keyboard shortcuts are kept and stay in sync.
- `L` stays a toggle; Look remains independent of the active tool, exactly as
  today. `ToolMode` is unchanged.
- README controls section left unchanged unless requested.
