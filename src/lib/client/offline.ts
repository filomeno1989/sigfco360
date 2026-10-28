// =====================================================================
// SIGFCO — Motor offline do motorista (§8.2, OFF-001..010, AT-008..011)
// Persistência real em IndexedDB (sobrevive a fecho/reinício — AT-010),
// fila com UUID por registo, reenvio automático com backoff (OFF-005),
// ACK do servidor antes de remover a cópia local (OFF-004) e fotos
// comprimidas no dispositivo (AT-011).
// =====================================================================
'use client'

const DB_NAME = 'sigfco-offline'
const STORE = 'fila'
const META = 'meta'

export type FilaItem = {
  clientUuid: string
  type: 'EXPENSE' | 'INCIDENT' | 'TRIP_EVENT' | 'GPS_MOBILE'
  deviceTime: string // hora original do dispositivo (OFF-002)
  payload: Record<string, unknown>
  estadoLocal: 'GUARDADO' | 'A_ENVIAR' | 'SINCRONIZADO' | 'ERRO'
  tentativas: number
  erro?: string
  resumo: string // descrição legível para a fila visível (OFF-006)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'clientUuid' })
        store.createIndex('estadoLocal', 'estadoLocal')
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

export async function filaListar(): Promise<FilaItem[]> {
  const all = await tx<FilaItem[]>(STORE, 'readonly', (s) => s.getAll())
  return (all || []).sort((a, b) => a.deviceTime.localeCompare(b.deviceTime))
}

export async function filaGuardar(item: FilaItem) {
  await tx(STORE, 'readwrite', (s) => s.put(item))
}

export async function filaMarcar(uuid: string, patch: Partial<FilaItem>) {
  const all = await filaListar()
  const item = all.find((i) => i.clientUuid === uuid)
  if (item) await tx(STORE, 'readwrite', (s) => s.put({ ...item, ...patch }))
}

export async function filaRemover(uuid: string) {
  await tx(STORE, 'readwrite', (s) => s.delete(uuid))
}

export async function filaContarPendentes(): Promise<number> {
  const all = await filaListar()
  return all.filter((i) => i.estadoLocal !== 'SINCRONIZADO').length
}

export function novoUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}

// ------------------------- Fotografia (AT-011) -----------------------
/** Comprime no dispositivo: largura máx. configurável, JPEG ~0.7 —
 *  mantém legibilidade do valor/data/estabelecimento do talão. */
export function comprimirImagem(file: File, maxWidth = 1280, quality = 0.72): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas indisponível')); return }
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h })
      }
      img.onerror = () => reject(new Error('Imagem ilegível'))
      img.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('Ficheiro ilegível'))
    reader.readAsDataURL(file)
  })
}

// ------------------------- Geolocalização (FR-052) -------------------
export function obterPosicao(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null as never }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    )
  })
}

// ------------------------- Sincronização (OFF-003..005) --------------
let syncing = false
let backoffMs = 5_000
export let ultimaSincronizacao: Date | null = null

/** Envia a fila pendente; devolve nº de itens confirmados. Repetir o
 *  mesmo UUID nunca duplica registos no servidor (AT-009). */
export async function sincronizar(): Promise<{ enviados: number; erros: number }> {
  if (syncing) return { enviados: 0, erros: 0 }
  syncing = true
  let enviados = 0, erros = 0
  try {
    const fila = (await filaListar()).filter((i) => i.estadoLocal === 'GUARDADO' || i.estadoLocal === 'ERRO' || i.estadoLocal === 'A_ENVIAR')
    if (fila.length === 0) { syncing = false; return { enviados: 0, erros: 0 } }

    for (const item of fila) await filaMarcar(item.clientUuid, { estadoLocal: 'A_ENVIAR' })

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: fila.map((i) => ({ clientUuid: i.clientUuid, type: i.type, deviceTime: i.deviceTime, payload: i.payload })) }),
    })

    if (res.status === 401) {
      for (const item of fila) await filaMarcar(item.clientUuid, { estadoLocal: 'ERRO', erro: 'Sessão expirada — autentique-se para sincronizar' })
      syncing = false
      return { enviados: 0, erros: fila.length }
    }
    if (!res.ok) {
      for (const item of fila) await filaMarcar(item.clientUuid, { estadoLocal: 'ERRO', erro: `Servidor respondeu ${res.status}` })
      syncing = false
      return { enviados: 0, erros: fila.length }
    }

    const data = (await res.json()) as { acks: Array<{ clientUuid: string; ok: boolean; id?: string; error?: string }> }
    for (const ack of data.acks) {
      if (ack.ok) {
        // OFF-004: só remove/marca sincronizado APÓS ACK durável
        await filaMarcar(ack.clientUuid, { estadoLocal: 'SINCRONIZADO', erro: undefined })
        enviados++
      } else {
        await filaMarcar(ack.clientUuid, { estadoLocal: 'ERRO', erro: ack.error ?? 'Erro desconhecido', tentativas: (fila.find((f) => f.clientUuid === ack.clientUuid)?.tentativas ?? 0) + 1 })
        erros++
      }
    }
    if (enviados > 0) { ultimaSincronizacao = new Date(); backoffMs = 5_000 }
    else backoffMs = Math.min(backoffMs * 2, 120_000)
  } finally {
    syncing = false
  }
  return { enviados, erros }
}

/** Agendador: tenta sincronizar quando há rede; tolera navegadores que
 *  só permitem sincronizar com a app aberta (OFF-023 — sem promessas
 *  falsas de telemetria de segundo plano). */
export function iniciarAutoSync(onMudanca?: () => void) {
  const tentar = () => {
    if (navigator.onLine) {
      sincronizar().then(() => onMudanca?.()).catch(() => onMudanca?.())
    }
  }
  window.addEventListener('online', tentar)
  const loop = () => {
    setTimeout(() => { if (navigator.onLine) tentar(); loop() }, backoffMs)
  }
  loop()
  tentar()
  return () => window.removeEventListener('online', tentar)
}
