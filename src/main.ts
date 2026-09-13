import { Game, GRID_WIDTH, GRID_DEPTH } from './core/Game.ts'
import { loadSnapshot } from './core/GameSnapshot.ts'
import { IndexedDbSnapshotStore } from './core/IndexedDbSnapshotStore.ts'

// Awaited before the game is built rather than applied to a running one: the
// restore has to land before TerrainMesh reads the grid, and booting a fresh
// beach first would show a frame of the wrong world.
const store = new IndexedDbSnapshotStore()
const saved = await loadSnapshot(store, GRID_WIDTH, GRID_DEPTH)

const game = new Game(store, saved)

// A console handle on the running game, under `npm run dev` only: ES modules do
// not put their bindings on the global object, so without this nothing in here
// is reachable from DevTools. `game.isoCamera.snapshot()` is the camera's
// look-at target on the ground plane. The literal `import.meta.env.DEV` is what
// lets the production build drop this branch, so don't lift it into a constant.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { game })
}
