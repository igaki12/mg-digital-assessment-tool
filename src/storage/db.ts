import { openDB } from "idb";
import type { SessionMeta, TimeSeriesRecord, VideoRecord } from "../types";

const DB_NAME = "MG_Assessment_DB";
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("sessions")) {
      db.createObjectStore("sessions", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("time_series_data")) {
      db.createObjectStore("time_series_data", { keyPath: "sessionId" });
    }
    if (!db.objectStoreNames.contains("videos")) {
      const store = db.createObjectStore("videos", { keyPath: "sessionId" });
      store.createIndex("createdAt", "createdAt");
    }
  }
});

export async function addSession(session: SessionMeta) {
  const db = await dbPromise;
  await db.put("sessions", session);
}

export async function listSessions() {
  const db = await dbPromise;
  return db.getAll("sessions") as Promise<SessionMeta[]>;
}

export async function addTimeSeries(record: TimeSeriesRecord) {
  const db = await dbPromise;
  await db.put("time_series_data", record);
}

export async function getTimeSeries(sessionId: number) {
  const db = await dbPromise;
  return (await db.get("time_series_data", sessionId)) as
    | TimeSeriesRecord
    | undefined;
}

export async function addVideo(record: VideoRecord) {
  const db = await dbPromise;
  await db.put("videos", record);
  await pruneVideos(5);
}

export async function getVideo(sessionId: number) {
  const db = await dbPromise;
  return (await db.get("videos", sessionId)) as VideoRecord | undefined;
}

export async function pruneVideos(limit: number) {
  const db = await dbPromise;
  const tx = db.transaction("videos", "readwrite");
  const store = tx.store;
  const index = store.index("createdAt");
  const keys = await index.getAllKeys();
  if (keys.length > limit) {
    const sorted = (await index.getAll()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const removeCount = sorted.length - limit;
    for (let i = 0; i < removeCount; i += 1) {
      await store.delete(sorted[i].sessionId);
    }
  }
  await tx.done;
}

export async function clearAllData() {
  const db = await dbPromise;
  const tx = db.transaction(["sessions", "time_series_data", "videos"], "readwrite");
  await tx.objectStore("sessions").clear();
  await tx.objectStore("time_series_data").clear();
  await tx.objectStore("videos").clear();
  await tx.done;
}
