import type { GameSnapshot } from './GameSnapshot.ts'
import type { SnapshotStore } from './SnapshotStore.ts'

const DB_NAME = 'sandcastles'
const DB_VERSION = 1
const STORE_NAME = 'saves'
const SAVE_KEY = 'autosave'

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Deliberately plumbing only. Everything that can be wrong about a save -
// whether it is valid, when to write one - is decided by isValidSnapshot,
// loadSnapshot and AutoSaver, all of which are tested. jsdom has no
// indexedDB, so anything with a decision in it would be untestable here.
export class IndexedDbSnapshotStore implements SnapshotStore {
  private db: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    if (this.db === null) {
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => {
          // The connection is held for the life of the page, which would
          // otherwise block a second tab running a newer schema from
          // upgrading until this one is closed.
          request.result.onversionchange = () => {
            request.result.close()
            this.db = null
          }
          resolve(request.result)
        }
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error('sandcastles database blocked'))
      })
    }
    return this.db
  }

  async load(): Promise<unknown> {
    const db = await this.open()
    const transaction = db.transaction(STORE_NAME, 'readonly')
    return promisify(transaction.objectStore(STORE_NAME).get(SAVE_KEY))
  }

  async save(snapshot: GameSnapshot): Promise<void> {
    const db = await this.open()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    // Resolve on the transaction, not the request: the request succeeds before
    // the transaction commits, and a save that reports done before it is
    // durable would let AutoSaver start the next one over the top of it.
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    transaction.objectStore(STORE_NAME).put(snapshot, SAVE_KEY)
    return committed
  }
}
