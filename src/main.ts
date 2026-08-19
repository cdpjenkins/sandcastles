import { Game, GRID_WIDTH, GRID_DEPTH } from './core/Game.ts'
import { loadSnapshot } from './core/GameSnapshot.ts'
import { IndexedDbSnapshotStore } from './core/IndexedDbSnapshotStore.ts'

// Awaited before the game is built rather than applied to a running one: the
// restore has to land before TerrainMesh reads the grid, and booting a fresh
// beach first would show a frame of the wrong world.
const store = new IndexedDbSnapshotStore()
const saved = await loadSnapshot(store, GRID_WIDTH, GRID_DEPTH)

new Game(store, saved)
