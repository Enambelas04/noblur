'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Script from 'next/script'
// Jika Anda punya fungsi patchMP4 terpisah di lib, bisa di-uncomment:
// import { patchMP4 } from '@/lib/patcher'

// ── tiny helpers ──────────────────────────────────────────────────────
const fmt = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB'
const cls  = (...args) => args.filter(Boolean).join(' ')

// ── Toggle component ──────────────────────────────────────────────────
function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="opt-row">
      <div>
        <div className="opt-label">{label}</div>
        <div className="opt-desc">{desc}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="toggle-track"></span>
      </label>
    </div>
  )
}

// ── Main Patcher Component ────────────────────────────────────────────
export default function Patcher() {
  // --- States ---
  const [activeTab, setActiveTab] = useState('patch')
  
  // File states
  const [patchFile, setPatchFile] = useState(null)
  
  // Patch Options State
  const [patchOpts, setPatchOpts] = useState({
    elst: true,
    matrix: true,
    offset: true
  })

  // UI States untuk Patch
  const [isPatching, setIsPatching] = useState(false)
  const [patchLogs, setPatchLogs] = useState([])
  const [patchResult, setPatchResult] = useState(null)

  const patchInputRef = useRef(null)

  // --- Handlers ---
  const handleFileDrop = useCallback((e, type) => {
    e.preventDefault()
    const file = e.dataTransfer?.files[0] || e.target?.files[0]
    if (!file) return

    if (type === 'patch') {
      setPatchFile(file)
      setPatchResult(null)
      setPatchLogs([])
    }
    // Tambahkan handle untuk 'convert' dan 'interp' nanti
  }, [])

  const removePatchFile = () => {
    setPatchFile(null)
    setPatchResult(null)
    setPatchLogs([])
  }

  const runPatch = async () => {
    if (!patchFile) return
    setIsPatching(true)
    setPatchLogs(prev => [...prev, { msg: `[init] membaca file: ${fmt(patchFile.size)}`, type: 'info' }])

    try {
      // PERHATIAN: 
      // Pindahkan logika "parseAtoms", "buildEdtsAtom", "insertBytes", 
      // "updateAncestorSizes", "recalcChunkOffsets" Anda ke file utility 
      // terpisah (misal: src/lib/patcher.js) lalu panggil di sini, ATAU
      // tuliskan logikanya di sini.
      
      // Contoh simulasi proses patch:
      setTimeout(() => {
        setPatchLogs(prev => [...prev, { msg: '[moov] ditemukan di offset 1024', type: 'ok' }])
        
        // Simulasi hasil akhir
        setPatchResult({
          size: fmt(patchFile.size), // Ukuran simulasi
          mods: 2,
          elst: patchOpts.elst ? 'Ya ✓' : 'Tidak',
          matrix: patchOpts.matrix ? 'Ya ✓' : 'Tidak',
          url: URL.createObjectURL(patchFile), // Buat Blob dari hasil uint8array Anda nantinya
          name: patchFile.name.replace(/\.(mp4|mov)$/i, '_noblur.$1')
        })
        setIsPatching(false)
        setPatchLogs(prev => [...prev, { msg: '[done] modifikasi selesai ✓', type: 'ok' }])
      }, 1500)

    } catch (error) {
      setPatchLogs(prev => [...prev, { msg: `[error] ${error.message}`, type: 'err' }])
      setIsPatching(false)
    }
  }

  return (
    <>
      {/* Script Eksternal Next.js */}
      <Script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js" strategy="lazyOnload" />
      <Script src="https://unpkg.com/coi-serviceworker@0.1.7/coi-serviceworker.min.js" strategy="lazyOnload" />
      <Script src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js" strategy="lazyOnload" />

      <div className="wrap">
        {/* Header */}
        <div className="logo">
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2v12" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="8" cy="8" r="3" fill="#0a0a0a" />
            </svg>
          </div>
          <span className="logo-text">NoBlur</span>
        </div>

        <h1>Video suite.<br /><span>Zero server.</span></h1>
        <p className="subtitle">Patch metadata · Convert resolusi · Interpolasi 60fps — semua di browser kamu, tanpa upload ke server.</p>
        
        <div className="badges">
          <span className="badge green">✓ Client-side</span>
          <span className="badge green">✓ No upload</span>
          <span className="badge yellow">Free: Patch</span>
          <span className="badge blue">Pro: Convert + Interpolasi</span>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button 
            className={cls('tab', activeTab === 'patch' && 'active')} 
            onClick={() => setActiveTab('patch')}
          >
            🔧 Patch
          </button>
          <button 
            className={cls('tab', activeTab === 'convert' && 'active')} 
            onClick={() => setActiveTab('convert')}
          >
            ⚡ Convert <span className="lock-icon">🔒</span>
          </button>
          <button 
            className={cls('tab', activeTab === 'interp' && 'active')} 
            onClick={() => setActiveTab('interp')}
          >
            🎞️ Interpolasi <span className="lock-icon">🔒</span>
          </button>
        </div>

        {/* Panel 1: PATCH */}
        {activeTab === 'patch' && (
          <div className="panel active">
            
            {/* Dropzone */}
            {!patchFile ? (
              <div 
                className="dropzone" 
                onClick={() => patchInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFileDrop(e, 'patch')}
              >
                <input 
                  type="file" 
                  ref={patchInputRef} 
                  style={{ display: 'none' }} 
                  accept=".mp4,.mov,video/mp4,video/quicktime" 
                  onChange={(e) => handleFileDrop(e, 'patch')}
                />
                <div className="drop-icon">🎬</div>
                <div className="drop-title">Pilih atau seret video</div>
                <div className="drop-sub">MP4 · MOV · gratis · tanpa batas</div>
              </div>
            ) : (
              <div className="file-card show">
                <div className="file-thumb">🎞️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="file-meta-name">{patchFile.name}</div>
                  <div className="file-meta-sub">{fmt(patchFile.size)} · {patchFile.name.split('.').pop().toUpperCase()}</div>
                </div>
                <button className="file-remove" onClick={removePatchFile}>✕</button>
              </div>
            )}

            {/* Options */}
            <div className="opts-card">
              <div className="opts-title">Patch Options</div>
              <Toggle 
                label="Pass 1 — Edit List Injection" 
                desc="Inject edts/elst · fix sinkronisasi A/V"
                checked={patchOpts.elst} 
                onChange={(e) => setPatchOpts({...patchOpts, elst: e.target.checked})} 
              />
              <Toggle 
                label="Pass 2 — Display Matrix Patch" 
                desc="Set matrix_b = 1 di mvhd"
                checked={patchOpts.matrix} 
                onChange={(e) => setPatchOpts({...patchOpts, matrix: e.target.checked})} 
              />
              <Toggle 
                label="Recalculate chunk offsets" 
                desc="Auto-fix stco/co64 setelah injeksi"
                checked={patchOpts.offset} 
                onChange={(e) => setPatchOpts({...patchOpts, offset: e.target.checked})} 
              />
            </div>

            <button 
              className="primary-btn" 
              disabled={!patchFile || isPatching} 
              onClick={runPatch}
            >
              ⚡ {isPatching ? 'Memproses...' : 'Patch Video'}
            </button>

            {/* Logs */}
            {patchLogs.length > 0 && (
              <div className="log-card show">
                <div className="log-header">
                  <div className={cls('log-dot', isPatching ? 'pulse' : 'done')}></div>
                  <span className="log-status">{isPatching ? 'processing' : 'done'}</span>
                </div>
                <div className="log-body">
                  {patchLogs.map((log, i) => (
                    <div key={i} className={`log-line ${log.type}`}>{log.msg}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {patchResult && (
              <div className="result-card show">
                <div className="result-title">✓ Patch selesai</div>
                <div className="result-stats">
                  <div className="stat"><div className="stat-label">Ukuran</div><div className="stat-val">{patchResult.size}</div></div>
                  <div className="stat"><div className="stat-label">Modifikasi</div><div className="stat-val green">{patchResult.mods}</div></div>
                  <div className="stat"><div className="stat-label">elst</div><div className="stat-val green">{patchResult.elst}</div></div>
                  <div className="stat"><div className="stat-label">matrix_b</div><div className="stat-val green">{patchResult.matrix}</div></div>
                </div>
                <a 
                  className="download-btn" 
                  href={patchResult.url} 
                  download={patchResult.name}
                  style={{ textDecoration: 'none' }}
                >
                  ↓ Download hasil patch
                </a>
              </div>
            )}
          </div>
        )}

        {/* Panel 2 & 3 Placeholder: CONVERT & INTERPOLASI */}
        {activeTab === 'convert' && (
          <div className="panel active">
             <div className="license-gate">
               <div className="gate-icon">⚡</div>
               <h3>Fitur Convert</h3>
               <p>Migrasikan logika convert dari vanilla JS Anda ke bagian ini menggunakan state seperti pada contoh tab Patch.</p>
             </div>
          </div>
        )}

        {activeTab === 'interp' && (
          <div className="panel active">
             <div className="license-gate">
               <div className="gate-icon">🎞️</div>
               <h3>Fitur Interpolasi</h3>
               <p>Migrasikan logika interpolasi dari vanilla JS Anda ke bagian ini.</p>
             </div>
          </div>
        )}

      </div>
    </>
  )
}
