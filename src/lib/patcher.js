/**
 * NoBlur — MP4 Container Patcher
 * Semua manipulasi binary terjadi di sini.
 */

export function patchMP4(inputBuf, opts = {}) {
  const logs = []
  const log  = (msg, cls = '') => logs.push({ msg, cls })

  let atomsModified = 0
  let elstInjected  = false
  let matrixPatched = false

  let data = new Uint8Array(inputBuf.slice(0))

  // ── Parse top-level atoms ──────────────────────────────────────────
  log('[init] membaca struktur atom...', '')
  const topAtoms = parseAtoms(data, 0, data.length)
  topAtoms.forEach(a => log(`  → ${a.type}  offset=${a.offset}  size=${a.size}`, 'info'))

  const moovAtom = topAtoms.find(a => a.type === 'moov')
  if (!moovAtom) throw new Error('Atom moov tidak ditemukan — bukan MP4/MOV yang valid.')

  log(`[moov] ditemukan di offset ${moovAtom.offset}`, 'ok')

  const moovChildren = parseAtoms(data, moovAtom.offset + 8, moovAtom.offset + moovAtom.size)

  // ── Pass 2: Display Matrix Patch ───────────────────────────────────
  if (opts.doMatrix) {
    const mvhdAtom = moovChildren.find(a => a.type === 'mvhd')
    if (mvhdAtom) {
      log('[pass2] mvhd ditemukan, membaca display matrix...', '')
      const version  = data[mvhdAtom.offset + 8]
      const matrixOff = mvhdAtom.offset + 8 + 4 + (version === 1 ? 28 : 16)
      const bOff = matrixOff + 4

      const view = new DataView(data.buffer, data.byteOffset)
      const currentB = view.getInt32(bOff, false)
      log(`  mvhd version=${version}  matrix_b saat ini = ${currentB}`, '')

      if (currentB === 0) {
        view.setInt32(bOff, 1, false)
        matrixPatched = true
        atomsModified++
        log('  [patch] matrix_b: 0 → 1 ✓', 'ok')
      } else {
        log(`  [skip] matrix_b sudah = ${currentB}`, 'warn')
      }
    } else {
      log('[pass2] mvhd tidak ditemukan, skip.', 'warn')
    }
  }

  // ── Pass 1: Edit List Injection ────────────────────────────────────
  if (opts.doElst) {
    const trakAtoms = moovChildren.filter(a => a.type === 'trak')
    log(`[pass1] ditemukan ${trakAtoms.length} track`, '')

    const toInject = []

    for (let ti = 0; ti < trakAtoms.length; ti++) {
      const trak = trakAtoms[ti]
      const trakChildren = parseAtoms(data, trak.offset + 8, trak.offset + trak.size)

      log(`  trak[${ti}] children: ${trakChildren.map(c => c.type).join(', ')}`, '')

      if (trakChildren.find(c => c.type === 'edts')) {
        log(`  trak[${ti}] sudah punya edts, skip.`, 'warn')
        continue
      }

      const tkhdAtom = trakChildren.find(c => c.type === 'tkhd')
      if (!tkhdAtom) { log(`  trak[${ti}] tkhd tidak ada, skip.`, 'warn'); continue }

      const tkhdVersion = data[tkhdAtom.offset + 8]
      const v2 = new DataView(data.buffer, data.byteOffset)
      let trackDuration

      if (tkhdVersion === 1) {
        const durHigh = v2.getUint32(tkhdAtom.offset + 28, false)
        const durLow  = v2.getUint32(tkhdAtom.offset + 32, false)
        trackDuration = durHigh * 0x100000000 + durLow
      } else {
        trackDuration = v2.getUint32(tkhdAtom.offset + 24, false)
      }

      log(`  trak[${ti}] durasi: ${trackDuration}`, '')
      const dur32 = trackDuration > 0xFFFFFFFF ? 0xFFFFFFFF : trackDuration
      toInject.push({ trakIndex: ti, insertAfterOffset: trak.offset + 8, dur32 })
    }

    for (let i = toInject.length - 1; i >= 0; i--) {
      const { trakIndex, insertAfterOffset, dur32 } = toInject[i]
      const edtsBuf = buildEdtsAtom(dur32)
      log(`  trak[${trakIndex}] inject edts/elst (${edtsBuf.byteLength}B) di offset ${insertAfterOffset}`, '')

      data = insertBytes(data, insertAfterOffset, new Uint8Array(edtsBuf))
      elstInjected = true
      atomsModified++

      if (opts.doOffset) {
        updateAncestorSizes(data, insertAfterOffset, edtsBuf.byteLength)
        recalcChunkOffsets(data, insertAfterOffset, edtsBuf.byteLength)
        log('  offsets recalculated ✓', 'ok')
      }
    }

    if (toInject.length > 0) {
      log(`[pass1] ${toInject.length} track berhasil di-inject ✓`, 'ok')
    } else {
      log('[pass1] semua track sudah punya edts.', 'warn')
    }
  }

  log(`[done] selesai — ${atomsModified} modifikasi`, 'ok')

  return {
    buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
    logs,
    atomsModified,
    elstInjected,
    matrixPatched,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildEdtsAtom(duration) {
  const buf = new ArrayBuffer(36)
  const v   = new DataView(buf)
  const u   = new Uint8Array(buf)
  v.setUint32(0, 36, false)
  u[4]=0x65; u[5]=0x64; u[6]=0x74; u[7]=0x73
  v.setUint32(8, 28, false)
  u[12]=0x65; u[13]=0x6c; u[14]=0x73; u[15]=0x74
  v.setUint32(16, 0, false)
  v.setUint32(20, 1, false)
  v.setUint32(24, duration >>> 0, false)
  v.setInt32(28, 0, false)
  v.setInt16(32, 1, false)
  v.setInt16(34, 0, false)
  return buf
}

function insertBytes(data, offset, insert) {
  const out = new Uint8Array(data.length + insert.length)
  out.set(data.subarray(0, offset), 0)
  out.set(insert, offset)
  out.set(data.subarray(offset), offset + insert.length)
  return out
}

function updateAncestorSizes(data, insertOffset, addedBytes) {
  const view = new DataView(data.buffer, data.byteOffset)
  let pos = 0
  while (pos < data.length - 8) {
    const size = view.getUint32(pos, false)
    if (size < 8) break
    const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
    if (insertOffset > pos && insertOffset <= pos + size) {
      view.setUint32(pos, size + addedBytes, false)
      if (['moov','trak'].includes(type)) {
        let cpos = pos + 8
        while (cpos < pos + size) {
          const csize = view.getUint32(cpos, false)
          if (csize < 8) break
          if (insertOffset > cpos && insertOffset <= cpos + csize)
            view.setUint32(cpos, csize + addedBytes, false)
          cpos += csize
        }
      }
    }
    pos += size
  }
}

function recalcChunkOffsets(data, insertOffset, addedBytes) {
  const view = new DataView(data.buffer, data.byteOffset)
  function scan(start, end) {
    let pos = start
    while (pos < end - 8) {
      const size = view.getUint32(pos, false)
      if (size < 8 || pos + size > end + 8) break
      const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
      if (type === 'stco') {
        const count = view.getUint32(pos + 12, false)
        for (let i = 0; i < count; i++) {
          const p = pos + 16 + i * 4
          const off = view.getUint32(p, false)
          if (off >= insertOffset) view.setUint32(p, off + addedBytes, false)
        }
      } else if (type === 'co64') {
        const count = view.getUint32(pos + 12, false)
        for (let i = 0; i < count; i++) {
          const p = pos + 16 + i * 8
          const hi = view.getUint32(p, false)
          const lo = view.getUint32(p + 4, false)
          const off = hi * 0x100000000 + lo
          if (off >= insertOffset) {
            const n = off + addedBytes
            view.setUint32(p,     Math.floor(n / 0x100000000), false)
            view.setUint32(p + 4, n >>> 0, false)
          }
        }
      } else if (['moov','trak','mdia','minf','stbl'].includes(type)) {
        scan(pos + 8, pos + size)
      }
      pos += size
    }
  }
  scan(0, data.length)
}

function parseAtoms(data, start, end) {
  const atoms = []
  const view  = new DataView(data.buffer, data.byteOffset)
  let pos = start
  while (pos < end - 8) {
    const size = view.getUint32(pos, false)
    if (size < 8 || pos + size > end + 8) break
    const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
    if (/^[a-zA-Z0-9©\-_]{4}$/.test(type)) {
      atoms.push({ type, offset: pos, size })
    }
    pos += size
  }
  return atoms
}
