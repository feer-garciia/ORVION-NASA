// orvion-pwa/src/db/indexeddb.js
import { openDB } from 'idb';

export const initDB = async () => {
  return openDB('orvion-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('nasa-cache')) {
        db.createObjectStore('nasa-cache');
      }
      if (!db.objectStoreNames.contains('drone-data')) {
        db.createObjectStore('drone-data');
      }
    },
  });
};

export async function saveNasaCache(lat, lon, crop, data) {
  const db = await initDB();
  const key = `${lat.toFixed(4)}_${lon.toFixed(4)}_${crop}`;
  await db.put('nasa-cache', data, key);
}

export async function getNasaCache(lat, lon, crop) {
  const db = await initDB();
  const key = `${lat.toFixed(4)}_${lon.toFixed(4)}_${crop}`;
  return db.get('nasa-cache', key);
}

export async function saveDroneData(lat, lon, dronePayload) {
  const db = await initDB();
  const key = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  await db.put('drone-data', { timestamp: Date.now(), ...dronePayload }, key);
}

export async function getDroneData(lat, lon) {
  const db = await initDB();
  const key = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  return db.get('drone-data', key);
}