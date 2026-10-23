import type { PersistedGameState, SaveSlotId, SaveSlotRecord } from './types';

const DATABASE = 'core-nuclear-saves';
const VERSION = 1;
const STORE = 'slots';
const SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3];

function isFiniteTriple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((part: unknown) => typeof part === 'number' && Number.isFinite(part));
}

function isSlot(value: unknown): value is SaveSlotRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<SaveSlotRecord>;
  const payload = record.payload;
  if (!(record.slot === 1 || record.slot === 2 || record.slot === 3) || typeof record.savedAt !== 'number' || !payload || typeof payload !== 'object') return false;
  const data = payload as PersistedGameState;
  const settings = data.settings;
  return data.version === 1
    && data.savedAt === record.savedAt
    && (data.cameraMode === 'fps' || data.cameraMode === 'orbit' || data.cameraMode === 'cinematic')
    && isFiniteTriple(data.position)
    && isFiniteTriple(data.target)
    && Number.isFinite(data.yaw)
    && Number.isFinite(data.pitch)
    && Number.isFinite(data.orbitDistance)
    && data.orbitDistance >= 4 && data.orbitDistance <= 42
    && typeof settings === 'object' && settings !== null
    && ['low', 'med', 'high', 'ultra'].includes(settings.graphicsTier)
    && (settings.graphicsMode === 'auto' || settings.graphicsMode === 'manual')
    && [settings.masterVolume, settings.musicVolume, settings.sfxVolume, settings.voiceVolume].every((volume) => Number.isFinite(volume) && volume >= 0 && volume <= 1)
    && typeof settings.touchControls === 'boolean'
    && typeof settings.reducedMotion === 'boolean'
    && typeof data.simulation === 'object' && data.simulation !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'slot' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to open the save database.'));
    request.onblocked = () => reject(new Error('Save database upgrade is blocked by another CORE: Nuclear tab.'));
  });
}

export class SaveRepository {
  private database: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    this.database ??= openDatabase().catch((error: unknown) => {
      this.database = null;
      throw error;
    });
    return this.database;
  }

  async save(slot: SaveSlotId, payload: PersistedGameState): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put({ slot, savedAt: payload.savedAt, payload } satisfies SaveSlotRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Save transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Save transaction was aborted.'));
    });
  }

  async load(slot: SaveSlotId): Promise<SaveSlotRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(slot);
      request.onsuccess = () => resolve(isSlot(request.result) ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read the selected save slot.'));
    });
  }

  async list(): Promise<Partial<Record<SaveSlotId, number>>> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => {
        const timestamps: Partial<Record<SaveSlotId, number>> = {};
        for (const item of request.result as unknown[]) if (isSlot(item)) timestamps[item.slot] = item.savedAt;
        resolve(timestamps);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to list save slots.'));
    });
  }

  async clear(slot: SaveSlotId): Promise<void> {
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(slot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear the save slot.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Save slot deletion was aborted.'));
    });
  }

  async listSlots(): Promise<readonly SaveSlotId[]> {
    await this.getDb();
    return SLOT_IDS;
  }
}
