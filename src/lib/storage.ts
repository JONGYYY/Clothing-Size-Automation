import localforage from 'localforage'
import type { DesignRecord } from './types'
import { uid } from './utils'

const store = localforage.createInstance({
  name: 'clothing-sizer',
  storeName: 'designs',
  description: 'Saved shirt design measurements',
})

export async function listDesigns(): Promise<DesignRecord[]> {
  const records: DesignRecord[] = []
  await store.iterate<DesignRecord, void>((value) => {
    records.push(value)
  })
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDesign(id: string): Promise<DesignRecord | null> {
  return (await store.getItem<DesignRecord>(id)) ?? null
}

export async function saveDesign(record: DesignRecord): Promise<DesignRecord> {
  const next = { ...record, updatedAt: Date.now() }
  await store.setItem(next.id, next)
  return next
}

export async function deleteDesign(id: string): Promise<void> {
  await store.removeItem(id)
}

export async function duplicateDesign(id: string): Promise<DesignRecord | null> {
  const original = await getDesign(id)
  if (!original) return null
  const copy: DesignRecord = {
    ...original,
    id: uid('design'),
    name: `${original.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await store.setItem(copy.id, copy)
  return copy
}
