// Shots that failed to reach the server are parked here until the network is back.
// IndexedDB rather than localStorage because these are multi-megabyte blobs.

const DB_NAME = "flashback";
const DB_VERSION = 1;
const STORE = "pending_uploads";

export type QueuedShot = {
  id: string;
  eventCode: string;
  guestName: string;
  blob: Blob;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function enqueueShot(
  eventCode: string,
  guestName: string,
  blob: Blob
): Promise<void> {
  const shot: QueuedShot = {
    id: crypto.randomUUID(),
    eventCode,
    guestName,
    blob,
    createdAt: Date.now(),
  };
  await withStore("readwrite", (store) => store.add(shot));
}

export async function listQueuedShots(eventCode: string): Promise<QueuedShot[]> {
  const all = await withStore<QueuedShot[]>("readonly", (store) => store.getAll());
  return all
    .filter((shot) => shot.eventCode === eventCode)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedShot(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
