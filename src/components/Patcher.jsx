Meet 2 : 28 Feb 2026
'use client'

import { useState, useRef, useCallback } from 'react'
import { patchMP4 } from '@/lib/patcher'

// ── tiny helpers ──────────────────────────────────────────────────────
const fmt = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB'
const cls  = (...args) => args.filter(Boolean).join(' ')

// ── Toggle component ──────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cls(
        'relative w-10 h-[22px] rounded-full border transition-all duration-200 flex-shrink-0',
        checked
          ? 'bg-[rgba(232,255,71,0.15)] border-accent'
          : 'bg-surface2 border-[rgba(255,255,255,0.12)]'
      )}
    >
      <span className={cls(
        'absolute top-[3px] w-4 h-4 rounded-full transition-all duration-200',
        checked ? 'left-[18px] bg-accent' : 'left-[2px] bg-[#666]'
      )} />
    </button>
  )
}

// ── Log line component ────────────────────────────────────────────────
function LogLine({ msg, cls: c }) {
  const colorMap = {
    ok:   'text-[#4fffb0]',
    warn: 'text-[#e8ff47]',
    err:  'text-[#ff4f4f]',
    info: 'text-[#7eb8ff]',
    '':   'text-[#666]',
  }
  return (
    <div className={`font-mono text-xs leading-relaxed ${colorMap[c] || colorMap['']}`}>
      {msg}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function Patcher() {
  const [file,    setFile]    = useState(null)
  const [opts,    setOpts]    = useState({ doElst: true, doMatrix: true, doOffset: true })
  const [status,  setStatus]  = useState('idle')   // idle | processing | done | error
  const [logs,    setLogs]    = useState([])
  const [result,  setResult]  = useState(null)
  const [isDrag,  setIsDrag]  = useState(false)

  const blobRef    = useRef(null)
  const fileInputRef = useRef(null)

  // ── File handling ────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['mp4', 'mov'].includes(ext)) {
      alert('Hanya file MP4 atau MOV yang didukung.')
      return
    }
    setFile(f)
    setStatus('idle')
    setLogs([])
    setResult(null)
    blobRef.current = null
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDrag(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const removeFile = () => {
    setFile(null)
    setStatus('idle')
    setLogs([])
    setResult(null)
    blobRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Patch ────────────────────────────────────────────────────────
  const runPatch = async () => {
    if (!file) return
    setStatus('processing')
    setLogs([])
    setResult(null)

    try {
      const buf = await file.arrayBuffer()
      // Jalankan di microtask agar UI tidak freeze
      await new Promise(r => setTimeout(r, 0))

      const res = patchMP4(buf, opts)

      blobRef.current = new Blob([res.buffer], { type: file.type })
      setLogs(res.logs)
      setResult({
        size:          fmt(blobRef.current.size),
        atomsModified: res.atomsModified,
        elstInjected:  res.elstInjected,
        matrixPatched: res.matrixPatched,
        name:          file.name.replace(/\.(mp4|mov)$/i, '_noblur.$1'),
      })
      setStatus('done')
    } catch (err) {
      setLogs([{ msg: `[error] ${err.message}`, cls: 'err' }])
      setStatus('error')
    }
  }

  // ── Download ─────────────────────────────────────────────────────
  const download = () => {
    if (!blobRef.current || !result) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blobRef.current)
    a.download = result.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3v12" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="9" cy="9" r="3" fill="#0a0a0a"/>
            </svg>
          </div>
          <span className="font-syne font-extrabold text-lg tracking-tight">NoBlur</span>
        </div>

        <h1 className="font-syne font-extrabold text-5xl leading-[1.05] tracking-[-2px] mb-4">
          Patch video.<br />
          <span className="text-accent">Skip the blur.</span>
        </h1>

        <p className="font-mono font-light text-[15px] text-[#666] leading-relaxed max-w-md">
          Modifikasi container metadata MP4/MOV langsung di browser —
          tanpa upload ke server, tanpa instal apapun.
        </p>

        <div className="flex flex-wrap gap-2 mt-5">
          {[
            { label: '✓ 100% client-side', color: 'border-[rgba(79,255,176,0.3)] text-[#4fffb0]' },
            { label: '✓ No upload',        color: 'border-[rgba(79,255,176,0.3)] text-[#4fffb0]' },
            { label: 'MP4 · MOV',          color: 'border-[rgba(232,255,71,0.3)] text-accent' },
            { label: 'elst injection',     color: 'border-[rgba(255,255,255,0.12)] text-[#666]' },
            { label: 'matrix patch',       color: 'border-[rgba(255,255,255,0.12)] text-[#666]' },
          ].map(b => (
            <span key={b.label}
              className={`font-mono text-[11px] font-medium px-3 py-1 rounded border tracking-wide ${b.color}`}>
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cls(
            'border-[1.5px] border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            'bg-surface mb-6',
            isDrag
              ? 'border-accent bg-[rgba(232,255,71,0.03)]'
              : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,video/mp4,video/quicktime"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
          <div className="w-12 h-12 rounded-xl bg-surface2 border border-[rgba(255,255,255,0.12)] flex items-center justify-center mx-auto mb-4 text-2xl">
            🎬
          </div>
          <p className="font-syne font-bold text-base mb-2">Pilih atau seret video ke sini</p>
          <p className="font-mono text-[13px] text-[#666]">MP4 atau MOV · maks 2GB</p>
        </div>
      )}

      {/* File card */}
      {file && (
        <div className="flex items-center gap-3 bg-surface border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-4 mb-6">
          <div className="w-11 h-11 rounded-lg bg-surface2 border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-xl flex-shrink-0">
            🎞️
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-syne font-bold text-sm truncate mb-1">{file.name}</div>
            <div className="font-mono text-[11px] text-[#666]">
              {fmt(file.size)} · {file.name.split('.').pop().toUpperCase()} · {new Date(file.lastModified).toLocaleDateString('id-ID')}
            </div>
          </div>
          <button onClick={removeFile} className="text-[#666] hover:text-[#ff4f4f] transition-colors text-lg px-1">✕</button>
        </div>
      )}

      {/* Options */}
      <div className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-5 mb-6">
        <p className="font-mono text-[11px] text-[#666] tracking-widest uppercase mb-4">Patch Options</p>

        {[
          {
            key: 'doElst',
            label: 'Pass 1 — Edit List Injection',
            desc: 'Inject edts/elst atom jika tidak ada · fix sinkronisasi A/V',
          },
          {
            key: 'doMatrix',
            label: 'Pass 2 — Display Matrix Patch',
            desc: 'Set matrix_b = 1 di mvhd · hint untuk renderer',
          },
          {
            key: 'doOffset',
            label: 'Recalculate chunk offsets',
            desc: 'Auto-fix stco/co64 setelah injeksi atom baru',
          },
        ].map((o, i, arr) => (
          <div key={o.key}
            className={cls(
              'flex items-center justify-between py-3',
              i < arr.length - 1 ? 'border-b border-[rgba(255,255,255,0.07)]' : ''
            )}
          >
            <div>
              <p className="font-syne font-medium text-[13px] mb-1">{o.label}</p>
              <p className="font-mono text-[11px] text-[#666]">{o.desc}</p>
            </div>
            <Toggle
              checked={opts[o.key]}
              onChange={v => setOpts(prev => ({ ...prev, [o.key]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Patch button */}
      <button
        onClick={runPatch}
        disabled={!file || status === 'processing'}
        className={cls(
          'w-full py-4 rounded-xl font-syne font-extrabold text-[15px] tracking-tight',
          'flex items-center justify-center gap-2 mb-6 transition-all duration-200',
          file && status !== 'processing'
            ? 'bg-accent text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px'
            : 'bg-surface2 text-[#666] cursor-not-allowed'
        )}
      >
        {status === 'processing' ? (
          <>
            <span className="animate-spin">⟳</span> Memproses...
          </>
        ) : (
          <><span>⚡</span> Patch Video</>
        )}
      </button>

      {/* Log */}
      {logs.length > 0 && (
        <div className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-2">
            <div className={cls(
              'w-[7px] h-[7px] rounded-full',
              status === 'processing' ? 'bg-accent animate-pulse' :
              status === 'done'       ? 'bg-[#4fffb0]' : 'bg-[#ff4f4f]'
            )} />
            <span className="font-mono text-[11px] text-[#666] tracking-widest uppercase">
              {status === 'processing' ? 'processing' : status === 'done' ? 'done' : 'error'}
            </span>
          </div>
          <div className="p-4 max-h-52 overflow-y-auto space-y-0.5">
            {logs.map((l, i) => <LogLine key={i} {...l} />)}
          </div>
        </div>
      )}

      {/* Result */}
      {result && status === 'done' && (
        <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-5 mb-6">
          <p className="font-syne font-bold text-[14px] text-[#4fffb0] flex items-center gap-2 mb-4">
            <span>✓</span> Patch selesai
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Ukuran file',       val: result.size,                                    green: false },
              { label: 'Atom dimodifikasi', val: result.atomsModified,                           green: true  },
              { label: 'elst injected',     val: result.elstInjected ? 'Ya ✓' : 'Tidak perlu', green: result.elstInjected  },
              { label: 'matrix_b patched',  val: result.matrixPatched ? 'Ya ✓' : 'Tidak perlu', green: result.matrixPatched },
            ].map(s => (
              <div key={s.label} className="bg-surface2 rounded-lg px-3 py-2.5">
                <p className="font-mono text-[10px] text-[#666] tracking-wide uppercase mb-1">{s.label}</p>
                <p className={`font-mono font-bold text-[13px] ${s.green ? 'text-[#4fffb0]' : 'text-[#f0f0f0]'}`}>
                  {String(s.val)}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={download}
            className="w-full py-3 border-[1.5px] border-[#4fffb0] text-[#4fffb0] rounded-xl font-syne font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[rgba(79,255,176,0.08)] transition-colors"
          >
            ↓ Download hasil patch
          </button>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mt-8">
        {[
          { icon: '🔒', title: 'Privasi total',    desc: 'File tidak pernah meninggalkan browser kamu. Semua proses terjadi lokal.' },
          { icon: '⚡', title: 'Instan',            desc: 'Tidak ada upload, tidak ada antrian server. Proses selesai dalam detik.' },
          { icon: '🎯', title: 'Non-destructive',  desc: 'Hanya metadata container yang dimodifikasi. Frame video tidak disentuh.' },
          { icon: '📦', title: 'Zero install',     desc: 'Buka browser, langsung pakai. Tidak perlu install ekstensi atau app.' },
        ].map(b => (
          <div key={b.title} className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
            <div className="text-xl mb-2">{b.icon}</div>
            <p className="font-syne font-bold text-[13px] mb-1">{b.title}</p>
            <p className="font-mono text-[11px] text-[#666] leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.07)] flex justify-between flex-wrap gap-2">
        <span className="font-mono text-[11px] text-[#666]">NoBlur v1.0 — Powered By : Muhamad Fildza</span>
        <span className="font-mono text-[11px] text-[#666]">no server · no tracking</span>
      </div>
    </div>
  )
}
