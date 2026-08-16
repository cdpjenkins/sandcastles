# WIP: D selects Dump instead of toggling

`D` was the only tool key written as a toggle (`Game.ts:174`), so pressing it
twice landed you back in Spade. Worse, from Stream mode it selected Spade
rather than Dump, because the ternary only knew about two of the three tools.

`Game`'s key handling cannot be tested where it stands -- the constructor
builds a WebGL `Renderer` -- so the mapping moves to a pure function first.

## Current Step

Step 2 complete. Next: the help overlay.

## Status

🟢 GREEN - suite green, tsc clean

## Completed

- [x] Step 1: `toolForKey` maps a key to a tool, with no current-mode input
- [x] Step 2: `Game` delegates its tool keys to `toolForKey`
- [ ] Step 3: the help overlay describes `D` as Dump

## Blockers

None.

## Next Action

Update the help overlay so `D` no longer advertises a toggle.
