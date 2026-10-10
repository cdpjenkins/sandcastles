# WIP: A toolbar that fits the screen

The bar is one unwrapped flex row, `position:fixed` inside a `body` with
`overflow:hidden`, so anything past the right edge is not merely ugly - it is
unclickable. Estimated intrinsic width ~2123px with a status message showing,
~1600px at rest, against 46% of that being the ten controls and **49% being
the `readouts` and `status` spans**.

So two changes, in that order of value:

- **D**: move `readouts` and `status` out of the bar into their own HUD,
  bottom-left. Removes ~1042px, the single biggest win, and is the only part
  aimed at what actually drives the width.
- **C**: `flex-wrap:wrap` and a `max-width` on the bar, so nothing can ever be
  unreachable again regardless of screen size, label changes or future
  buttons.

A submenu was considered and rejected: it addresses the 46%, not the 49%, and
would still overflow at 1280.

## Current Step

Step 4: docs.

## Status

🟢 GREEN - suite green (391), tsc clean, production build clean.

## Completed

- [x] Step 1: `Hud` owns the readouts and the status, bottom-left. Status
      hidden while empty so the HUD gains no blank line.
- [x] Step 2: the bar holds controls only (-1042px); `Game` places the HUD.
      The three text-span tests moved to `hud.test.ts` rather than being
      dropped, and `toolbar.test.ts` now fails if any text goes back in.
- [x] Step 3: `flex-wrap` and `max-width:calc(100vw - 24px)`. The bar wants
      ~1069px now: one row at 1280, two at 1024. The test can only assert the
      rules are declared - jsdom has no layout - and says so.

## Shipped before this

- A Sources panel and its `F` key (`bd12438`..`b989a7b`).
