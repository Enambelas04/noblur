'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const DB_NAME  = 'noblur_v2_db'
const STORE    = 'history'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        s.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export function useHistory() {
  const [entries, setEntries] = useState([])
  const [ttlHours, setTtlHours] = useState(3)
  const dbRef = useRef(null)

  const getAll = useCallback(async () => {
    if (!dbRef.current) dbRef.current = await openDB()
    return new Promise(resolve => {
      dbRef.current
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .getAll().onsuccess = e => resolve(e.target.result)
    })
  }, [])

  const prune = useCallback(async (ttl) => {
    const all    = await getAll()
    const cutoff = Date.now() - ttl * 3600000
    const expired = all.filter(e => e.createdAt < cutoff)
    if (!expired.length) return

    const tx = dbRef.current.transaction(STORE, 'readwrite')
    const st = tx.objectStore(STORE)
    expired.forEach(e => st.delete(e.id))
    return new Promise(resolve => { tx.oncomplete = resolve })
  }, [getAll])

  const refresh = useCallback(async (ttl) => {
    await prune(ttl ?? ttlHours)
    const all = await getAll()
    setEntries(all.sort((a, b) => b.createdAt - a.createdAt))
  }, [prune, getAll, ttlHours])

  const add = useCallback(async (entry) => {
    if (!dbRef.current) dbRef.current = await openDB()
    return new Promise(resolve => {
      dbRef.current
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .add({ ...entry, createdAt: Date.now() }).onsuccess = () => {
          refresh()
          resolve()
        }
    })
  }, [refresh])

  const remove = useCallback(async (id) => {
    if (!dbRef.current) dbRef.current = await openDB()
    return new Promise(resolve => {
      dbRef.current
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .delete(id).onsuccess = () => { refresh(); resolve() }
    })
  }, [refresh])

  const clear = useCallback(async () => {
    if (!dbRef.current) dbRef.current = await openDB()
    return new Promise(resolve => {
      dbRef.current
        .transaction(STORE, 'readwrite')
        .objectStore(STORE)
        .clear().onsuccess = () => { refresh(); resolve() }
    })
  }, [refresh])

  const changeTTL = useCallback((hours) => {
    setTtlHours(hours)
    refresh(hours)
  }, [refresh])

  // Init + auto-prune setiap 1 menit
  useEffect(() => {
    openDB().then(db => {
      dbRef.current = db
      refresh()
    })
    const interval = setInterval(() => refresh(), 60000)
    return () => clearInterval(interval)
  }, [refresh])

  return { entries, ttlHours, add, remove, clear, changeTTL }
}

// Helper: hitung sisa waktu sebelum expire
export function timeLeft(createdAt, ttlHours) {
  const exp = createdAt + ttlHours * 3600000
  const rem = exp - Date.now()
  if (rem <= 0) return { text: 'kedaluwarsa', soon: true }
  const h = Math.floor(rem / 3600000)
  const m = Math.floor((rem % 3600000) / 60000)
  return {
    text: h > 0 ? `${h}j ${m}m` : `${m}m`,
    soon: rem < 1800000,
  }
}
