# WIP: dt-scale the angle-of-repose slumping

`Slope.step` took no `dt` and moved half the excess over the repose angle *per
step*, so the rate a bank slumped was set by `SIM_HZ` — at 30 Hz, 15/s, fast
enough to project any bank onto the repose slope inside a single step.

## Steps

1. 🟢 `Slope.step` takes `dt` and slumps at a rate per second — committed (35c2508)
2. 🟢 clamp the per-step fraction so a large `dt` cannot overshoot — committed (5572ecc)
3. 🟢 measure river morphology against the slump rate, set the default

## Current step

**Step 3** — swept the rate on the game scene (256×256 `initBeach`, spring,
waves, tide, 120s) against the 15/s the shipped per-step fraction came to:

| rate | z=60 | z=80 | z=100 | z=120 | wall settles |
|------|------|------|-------|-------|--------------|
| 15/s (was) | 2.30/29 | 2.97/84 | 2.69/166 | 3.74/103 | 0.5s |
| 3/s | 1.98/29 | 2.96/80 | 2.66/162 | 3.90/99 | 3.7s |
| **1/s** | 1.20/24 | 3.59/77 | 2.66/159 | 3.95/98 | 11.7s |
| 0.5/s | 1.07/23 | 3.59/75 | 2.65/157 | 3.74/97 | 23.6s |
| 0.1/s | 1.04/3 | 3.37/65 | 2.57/141 | 3.63/89 | 60s+ |
| off | 0/0 | 2.63/38 | 2.25/109 | 3.42/72 | — |

(depth/width; settle time is a 20-high column, an extreme — a spade-high wall
settles in about a second at 1/s.)

`SLUMP_RATE = 1.0`: below it the channel stops improving and only the sand
starts feeling sluggish. Findings recorded in CLAUDE.md.

Status: ⏸️ WAITING — all three steps complete.

## Next action

None for this change. The open lead is that the river's width comes from the
wetted width and the shallow sand layer, not from any erosion knob — see the
CLAUDE.md section. `MAX_BED_RATE` saturating on 76–96% of steps makes the
capacity law inert in the game scene, which is what flattens the floor.
