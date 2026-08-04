import { openDB } from "idb";

// All user-uploaded media (images, videos, documents) lives entirely in
// IndexedDB on the user's device. Nothing here is ever sent to the
// backend — the server only ever sees chat text.
const DB_NAME = "ei-companion-media";
const STORE_NAME = "attachments";

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function saveAttachment(file) {
  const db = await getDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await db.put(STORE_NAME, record);
  return record;
}

export async function getAttachment(id) {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

export async function listAttachments() {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function deleteAttachment(id) {
  const db = await getDb();
  return db.delete(STORE_NAME, id);
}

export function attachmentUrl(record) {
  return URL.createObjectURL(record.blob);
}
