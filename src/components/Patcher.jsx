'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { patchMP4 } from '@/lib/patcher'
import { buildConvertArgs, buildInterpArgs } from '@/lib/ffmpegArgs'
import { useHistory, timeLeft } from '@/hooks/useHistory'

const fmt = b => (b / 1024 / 1024).toFixed(2) + ' MB'
const cls = (...a) => a.filter(Boolean).join(' ')
const LS_KEY = 'noblur_agreed'

// ─── UI Components ────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={cls(
        'relative w-10 h-[22px] rounded-full border transition-all duration-200 flex-shrink-0',
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-[rgba(232,255,71,0.15)] border-[#e8ff47]' : 'bg-[#1a1a1a] border-[rgba(255,255,255,0.12)]'
      )}>
      <span className={cls('absolute top-[3px] w-4 h-4 rounded-full transition-all duration-200',
        checked ? 'left-[18px] bg-[#e8ff47]' : 'left-[2px] bg-[#555]')} />
    </button>
  )
}

function LogLine({ msg, cls: c }) {
  const colors = { ok:'text-[#4fffb0]', warn:'text-[#e8ff47]', err:'text-[#ff4f4f]', inf:'text-[#7eb8ff]', '':'text-[#555]' }
  return <div className={`font-mono text-[11px] leading-relaxed ${colors[c]||colors['']}`}>{msg}</div>
}

function Stat({ label, val, green }) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg px-3 py-2.5">
      <p className="font-mono text-[10px] text-[#555] tracking-wide uppercase mb-1">{label}</p>
      <p className={`font-mono font-bold text-[13px] ${green?'text-[#4fffb0]':'text-[#f0f0f0]'}`}>{String(val)}</p>
    </div>
  )
}

function AgreementGate({ icon, title, desc, checks, onAgree }) {
  const [ticked, setTicked] = useState([false, false, false])
  const allOk = ticked.every(Boolean)
  return (
    <div className="bg-[#111] border border-[rgba(232,255,71,0.12)] rounded-2xl p-5 mb-4">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-syne font-bold text-[14px] mb-1.5">{title}</h3>
      <p className="font-mono text-[11px] text-[#555] leading-relaxed mb-4">{desc}</p>
      <div className="flex flex-col gap-2.5 mb-4">
        {checks.map((chk, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={ticked[i]}
              onChange={e => { const n=[...ticked]; n[i]=e.target.checked; setTicked(n) }}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#e8ff47] cursor-pointer" />
            <span className={`font-mono text-[11px] leading-relaxed ${ticked[i]?'text-[#f0f0f0]':'text-[#555]'}`}>{chk}</span>
          </label>
        ))}
      </div>
      <button disabled={!allOk} onClick={onAgree}
        className={cls('w-full py-2.5 rounded-xl font-syne font-bold text-[13px] transition-all duration-200',
          allOk ? 'bg-[#e8ff47] text-[#0a0a0a] hover:bg-[#f0ff6a]' : 'bg-[#1a1a1a] text-[#555] cursor-not-allowed')}>
        Aktifkan
      </button>
    </div>
  )
}

function Dropzone({ onFile, accept, sub }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef(null)
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);onFile(e.dataTransfer.files[0])}}
      onClick={()=>ref.current?.click()}
      className={cls('border-[1.5px] border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 bg-[#111] mb-4',
        drag?'border-[#e8ff47] bg-[rgba(232,255,71,0.02)]':'border-[rgba(255,255,255,0.11)] hover:border-[rgba(255,255,255,0.22)]')}>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e=>onFile(e.target.files[0])} />
      <div className="text-2xl mb-2">🎬</div>
      <p className="font-syne font-bold text-[14px] mb-1">Pilih atau seret video ke sini</p>
      <p className="font-mono text-[12px] text-[#555]">{sub}</p>
    </div>
  )
}

function FileCard({ file, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-[#111] border border-[rgba(255,255,255,0.12)] rounded-xl px-4 py-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-lg flex-shrink-0">🎞️</div>
      <div className="flex-1 min-w-0">
        <div className="font-syne font-bold text-[13px] truncate mb-0.5">{file.name}</div>
        <div className="font-mono text-[11px] text-[#555]">{fmt(file.size)} · {file.name.split('.').pop().toUpperCase()}</div>
      </div>
      <button onClick={onRemove} className="text-[#555] hover:text-[#ff4f4f] transition-colors text-base px-1">✕</button>
    </div>
  )
}

function LogPanel({ logs, status, label }) {
  if (!logs.length) return null
  return (
    <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden mb-3">
      <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-2">
        <div className={cls('w-[6px] h-[6px] rounded-full',
          status==='run'?'bg-[#e8ff47] animate-pulse':status==='done'?'bg-[#4fffb0]':'bg-[#ff4f4f]')} />
        <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">{label} · {status==='run'?'processing':status==='done'?'done':'error'}</span>
      </div>
      <div className="p-3 max-h-32 overflow-y-auto space-y-0.5">
        {logs.map((l,i)=><LogLine key={i} {...l}/>)}
      </div>
    </div>
  )
}

function ProgressBar({ pct, label }) {
  return (
    <div className="mb-3">
      <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-1">
        <div className="h-full bg-[#e8ff47] rounded-full transition-all duration-300" style={{width:pct+'%'}} />
      </div>
      <p className="font-mono text-[10px] text-[#555]">{label} {pct}%</p>
    </div>
  )
}

function FFStatus({ state, label }) {
  const dot = state==='loading'?'bg-[#e8ff47] animate-pulse':state==='ready'?'bg-[#4fffb0]':'bg-[#555]'
  const txt = state==='loading'?'Memuat FFmpeg.wasm...':state==='ready'?'FFmpeg siap ✓':state==='error'?'Gagal load':'Belum dimuat'
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] text-[#555]">
      <div className={cls('w-[6px] h-[6px] rounded-full flex-shrink-0', dot)} />
      {label}: {txt}
    </div>
  )
}

// ─── Feature Card ─────────────────────────────────────────────────────
function FeatureCard({ icon, title, badge, enabled, onToggle, locked, children }) {
  return (
    <div className={cls(
      'border rounded-2xl transition-all duration-200 mb-3 overflow-hidden',
      enabled ? 'border-[rgba(232,255,71,0.25)] bg-[#111]' : 'border-[rgba(255,255,255,0.07)] bg-[#0e0e0e]'
    )}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-syne font-bold text-[13px]">{title}</span>
            {badge && <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-[rgba(232,255,71,0.3)] text-[#e8ff47]">{badge}</span>}
            {locked && <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-[rgba(255,255,255,0.1)] text-[#555]">Perlu aktivasi</span>}
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} disabled={locked} />
      </div>
      {/* Card content — hanya tampil jika enabled */}
      {enabled && !locked && (
        <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.05)] pt-3">
          {children}
        </div>
      )}
      {/* Locked state */}
      {locked && enabled && (
        <div className="px-4 pb-3 border-t border-[rgba(255,255,255,0.05)] pt-3">
          <p className="font-mono text-[11px] text-[#555]">Aktifkan fitur ini terlebih dahulu di bawah.</p>
        </div>
      )}
    </div>
  )
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <span className="font-mono text-[11px] text-[#555]">{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1 font-mono text-[11px] text-[#f0f0f0] outline-none cursor-pointer">
        {options.map(([v,l])=><option key={v} value={v} className="bg-[#111]">{l}</option>)}
      </select>
    </div>
  )
}

// ─── History Section ───────────────────────────────────────────────────
function HistorySection({ entries, ttlHours, onRemove, onClear, onChangeTTL }) {
  const typeIco = t => t==='patch'?'🔧':t==='convert'?'⚡':'🎞️'
  const typeClr = t => t==='patch'
    ?'bg-[rgba(232,255,71,0.1)] text-[#e8ff47] border border-[rgba(232,255,71,0.2)]'
    :t==='convert'
    ?'bg-[rgba(126,184,255,0.1)] text-[#7eb8ff] border border-[rgba(126,184,255,0.2)]'
    :'bg-[rgba(79,255,176,0.1)] text-[#4fffb0] border border-[rgba(79,255,176,0.2)]'
  return (
    <div className="mt-8 pt-7 border-t border-[rgba(255,255,255,0.07)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-syne font-bold text-[13px]">
          <div className="w-[6px] h-[6px] rounded-full bg-[#e8ff47]" /> Riwayat Proses
        </div>
        <div className="flex items-center gap-2">
          <select value={ttlHours} onChange={e=>onChangeTTL(Number(e.target.value))}
            className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[#555] outline-none cursor-pointer">
            {[1,3,6,12,24].map(h=><option key={h} value={h}>Hapus {h} jam</option>)}
          </select>
          <button onClick={onClear}
            className="font-mono text-[11px] text-[#555] hover:text-[#ff4f4f] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,79,79,0.3)] rounded-lg px-2.5 py-1.5 transition-all">
            Hapus semua
          </button>
        </div>
      </div>
      {!entries.length
        ? <div className="text-center py-6 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl font-mono text-[12px] text-[#555]">Belum ada riwayat proses.</div>
        : <div className="flex flex-col gap-2">
            {entries.map(e=>{
              const ttl=timeLeft(e.createdAt,ttlHours)
              const time=new Date(e.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
              const date=new Date(e.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short'})
              return (
                <div key={e.id} className="flex items-center gap-3 bg-[#111] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.12)] rounded-xl px-4 py-3 transition-colors">
                  <span className="text-[18px] flex-shrink-0">{typeIco(e.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-syne font-semibold text-[12px] truncate mb-1">{e.filename}</div>
                    <div className="flex flex-wrap gap-2 font-mono text-[10px] text-[#555]">
                      <span>📅 {date} {time}</span>
                      <span>💾 {e.outputSize}</span>
                      {e.resolution&&<span>📐 {e.resolution}</span>}
                      {e.fps&&<span>🎬 {e.fps}fps</span>}
                      {e.mods!==undefined&&<span>✏️ {e.mods} mod</span>}
                    </div>
                  </div>
                  <span className={`font-mono text-[9px] px-2 py-1 rounded font-medium flex-shrink-0 ${typeClr(e.type)}`}>{e.type}</span>
                  <span className={`font-mono text-[10px] flex-shrink-0 ${ttl.soon?'text-[#ff4f4f]':'text-[#555]'}`}>{ttl.text}</span>
                  <button onClick={()=>onRemove(e.id)} className="text-[#555] hover:text-[#ff4f4f] transition-colors text-[13px] px-1 flex-shrink-0">✕</button>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════
export default function Patcher() {

  // ── Agreement ─────────────────────────────────────────────────────────
  const [agreed, setAgreed] = useState({ convert: false, interp: false })
  useEffect(() => {
    try { const s=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); setAgreed({convert:!!s.convert,interp:!!s.interp}) } catch {}
  }, [])
  const agree = feat => {
    const next={...agreed,[feat]:true}; setAgreed(next)
    localStorage.setItem(LS_KEY,JSON.stringify(next))
    loadFF()
  }
  const revoke = feat => {
    const next={...agreed,[feat]:false}; setAgreed(next)
    localStorage.setItem(LS_KEY,JSON.stringify(next))
  }

  // ── Pipeline toggles ──────────────────────────────────────────────────
  // User pilih kombinasi fitur yang mau dijalankan sekaligus
  const [pipeline, setPipeline] = useState({ patch: true, convert: false, interp: false })
  const togglePipeline = feat => setPipeline(p => ({ ...p, [feat]: !p[feat] }))

  // ── File ──────────────────────────────────────────────────────────────
  const [file, setFile] = useState(null)

  // ── Options per fitur ─────────────────────────────────────────────────
  const [patchOpts, setPatchOpts] = useState({ elst: true, matrix: true, offset: true })
  const [cvOpts,    setCvOpts]    = useState({ res:'1080:1920', fps:'60', br:50, codec:'libx264' })
  const [ipOpts,    setIpOpts]    = useState({ fps:'60', mode:'mci', res:'', br:50 })

  // ── Logs & status per step ────────────────────────────────────────────
  const [stepLogs,   setStepLogs]   = useState({ patch:[], convert:[], interp:[] })
  const [stepStatus, setStepStatus] = useState({ patch:'idle', convert:'idle', interp:'idle' })
  const [stepProg,   setStepProg]   = useState({ convert:0, interp:0 })
  const addLog  = (f,msg,c='') => setStepLogs(p=>({...p,[f]:[...p[f],{msg,cls:c}]}))
  const clrLogs = ()           => setStepLogs({patch:[],convert:[],interp:[]})
  const setStat = (f,s)        => { if(s==='run') activeStepRef.current=f; setStepStatus(p=>({...p,[f]:s})) }
  const setPct  = (f,n)        => setStepProg(p=>({...p,[f]:n}))

  // ── Running state ─────────────────────────────────────────────────────
  const [running,  setRunning]  = useState(false)
  const activeStepRef = useRef('convert') // track active step for FFmpeg callbacks
  const [results,  setResults]  = useState(null)

  // ── FFmpeg ────────────────────────────────────────────────────────────
  const [ffState, setFFState] = useState('idle') // idle | loading | ready | error
  const ffRef = useRef(null)

  const loadFF = useCallback(async () => {
    if (ffRef.current || ffState === 'loading') return
    setFFState('loading')
    try {
      const { FFmpeg }    = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const ff = new FFmpeg()
      ff.on('log', ({ message: m }) => {
        if (m.includes('frame=') || m.includes('time=') || m.includes('fps='))
          setStepLogs(p => ({ ...p, [activeStepRef.current]: [...(p[activeStepRef.current]||[]), { msg: m, cls: 'inf' }] }))
      })
      ff.on('progress', ({ progress: p }) => {
        setPct(activeStepRef.current, Math.round(p * 100))
      })

      let loaded = false
      const tryLoad = async (base, mt) => {
        if (loaded) return
        try {
          if (mt) {
            await ff.load({
              coreURL:   await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),
              wasmURL:   await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm'),
              workerURL: await toBlobURL(base+'/ffmpeg-core.worker.js','text/javascript'),
            })
          } else {
            await ff.load({
              coreURL: await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),
              wasmURL: await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm'),
            })
          }
          loaded = true
        } catch(e) { console.warn('FFmpeg CDN failed:', base, e.message) }
      }

      await tryLoad('https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd', true)
      if (!loaded) await tryLoad('https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd', true)
      if (!loaded) await tryLoad('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd', false)
      if (!loaded) await tryLoad('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd', false)
      if (!loaded) throw new Error('Semua CDN gagal')

      ffRef.current = ff
      setFFState('ready')
    } catch(e) {
      setFFState('error')
    }
  }, [ffState])

  useEffect(() => {
    if ((agreed.convert || agreed.interp) && !ffRef.current) loadFF()
  }, [agreed, loadFF])

  // ── History ───────────────────────────────────────────────────────────
  const { entries, ttlHours, add: histAdd, remove: histRemove, clear: histClear, changeTTL } = useHistory()

  // ── Download ──────────────────────────────────────────────────────────
  const download = r => {
    if (!r?.url) return
    const a = document.createElement('a'); a.href=r.url; a.download=r.name; a.click()
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RUN PIPELINE — jalankan semua fitur yang dipilih secara berurutan
  // ═══════════════════════════════════════════════════════════════════════
  const runPipeline = async () => {
    if (!file || running) return
    setRunning(true)
    clrLogs()
    setResults(null)
    setStepStatus({ patch:'idle', convert:'idle', interp:'idle' })
    setStepProg({ convert:0, interp:0 })

    const out = {}
    let currentBuf = await file.arrayBuffer()
    let currentFile = file

    try {
      // ── STEP 1: PATCH ──────────────────────────────────────────────
      if (pipeline.patch) {
        setStat('patch', 'run')
        addLog('patch', '[patch] memulai...', 'inf')

        const res = patchMP4(currentBuf, {
          doElst:   patchOpts.elst,
          doMatrix: patchOpts.matrix,
          doOffset: patchOpts.offset,
        })
        res.logs.forEach(l => addLog('patch', l.msg, l.cls))

        // Output patch jadi input step berikutnya
        currentBuf = res.buffer
        const blob = new Blob([res.buffer], { type: file.type })
        // Buat File object baru untuk FFmpeg step berikutnya
        currentFile = new File([blob], file.name, { type: file.type })

        out.patch = {
          size: fmt(blob.size),
          mods: res.atomsModified,
          elst: res.elstInjected,
          mat:  res.matrixPatched,
          url:  URL.createObjectURL(blob),
          name: file.name.replace(/\.(mp4|mov)$/i, '_patched.$1'),
        }
        setStat('patch', 'done')
        addLog('patch', `[patch] selesai — ${res.atomsModified} modifikasi ✓`, 'ok')
        histAdd({ type:'patch', filename:file.name, outputSize:fmt(blob.size), mods:res.atomsModified })
      }

      // ── STEP 2: CONVERT ────────────────────────────────────────────
      if (pipeline.convert && agreed.convert) {
        if (!ffRef.current) throw new Error('FFmpeg belum siap')
        setStat('convert', 'run')
        addLog('convert', '[convert] memulai encode...', 'inf')
        addLog('convert', `[convert] ${cvOpts.res.replace(':','x')} @ ${cvOpts.fps}fps · ${cvOpts.br}Mbps`, 'inf')

        const ff = ffRef.current
        const { fetchFile } = await import('@ffmpeg/util')
        const ext  = currentFile.name.split('.').pop().toLowerCase()
        const inN  = 'cv_in.' + ext
        const outN = file.name.replace(/\.[^.]+$/, `_${cvOpts.res.replace(':','x')}_${cvOpts.fps}fps.mp4`)

        await ff.writeFile(inN, await fetchFile(currentFile))
        await ff.exec(buildConvertArgs(inN, outN, cvOpts))

        const raw  = await ff.readFile(outN)
        const blob = new Blob([raw.buffer], { type: 'video/mp4' })
        await ff.deleteFile(inN); await ff.deleteFile(outN)

        // Output convert jadi input step berikutnya
        currentFile = new File([blob], outN, { type: 'video/mp4' })

        out.convert = {
          size: fmt(blob.size),
          res:  cvOpts.res.replace(':','x'),
          fps:  cvOpts.fps,
          codec: cvOpts.codec,
          url:  URL.createObjectURL(blob),
          name: outN,
        }
        setStat('convert', 'done'); setPct('convert', 100)
        addLog('convert', `[convert] selesai — ${fmt(blob.size)} ✓`, 'ok')
        histAdd({ type:'convert', filename:file.name, outputSize:fmt(blob.size), resolution:cvOpts.res.replace(':','x'), fps:cvOpts.fps })
      }

      // ── STEP 3: INTERPOLASI ────────────────────────────────────────
      if (pipeline.interp && agreed.interp) {
        if (!ffRef.current) throw new Error('FFmpeg belum siap')
        setStat('interp', 'run')
        addLog('interp', '[interp] memulai interpolasi...', 'inf')
        addLog('interp', `[interp] target ${ipOpts.fps}fps · mode=${ipOpts.mode.toUpperCase()}`, 'inf')
        if (ipOpts.mode === 'mci') addLog('interp', '[interp] MCI paling lambat tapi paling halus', 'warn')

        const ff = ffRef.current
        const { fetchFile } = await import('@ffmpeg/util')
        const ext  = currentFile.name.split('.').pop().toLowerCase()
        const inN  = 'ip_in.' + ext
        const outN = file.name.replace(/\.[^.]+$/, `_${ipOpts.fps}fps_interp.mp4`)

        await ff.writeFile(inN, await fetchFile(currentFile))
        await ff.exec(buildInterpArgs(inN, outN, ipOpts))

        const raw  = await ff.readFile(outN)
        const blob = new Blob([raw.buffer], { type: 'video/mp4' })
        await ff.deleteFile(inN); await ff.deleteFile(outN)

        out.interp = {
          size: fmt(blob.size),
          fps:  ipOpts.fps,
          mode: ipOpts.mode.toUpperCase(),
          url:  URL.createObjectURL(blob),
          name: outN,
        }
        setStat('interp', 'done'); setPct('interp', 100)
        addLog('interp', `[interp] selesai — ${fmt(blob.size)} ✓`, 'ok')
        histAdd({ type:'interp', filename:file.name, outputSize:fmt(blob.size), fps:ipOpts.fps, mode:ipOpts.mode.toUpperCase() })
      }

      setResults(out)

    } catch(e) {
      const activeStep = stepStatus.interp==='run' ? 'interp' : stepStatus.convert==='run' ? 'convert' : 'patch'
      addLog(activeStep, '[error] ' + e.message, 'err')
      setStat(activeStep, 'error')
    }

    setRunning(false)
  }

  const anyEnabled  = Object.values(pipeline).some(Boolean)
  const needsFF     = (pipeline.convert && agreed.convert) || (pipeline.interp && agreed.interp)
  const ffReady     = !needsFF || ffState === 'ready'
  const canRun      = file && anyEnabled && ffReady && !running

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-[#e8ff47] rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9h12M9 3v12" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="9" cy="9" r="3" fill="#0a0a0a"/>
            </svg>
          </div>
          <span className="font-syne font-extrabold text-lg tracking-tight">NoBlur</span>
          <span className="font-mono text-[10px] text-[#555] px-2 py-0.5 border border-[rgba(255,255,255,0.1)] rounded">v2.0</span>
        </div>
        <h1 className="font-syne font-extrabold text-5xl leading-[1.05] tracking-[-2px] mb-3">
          Double Layered Video.<br /><span className="text-[#e8ff47]">Satu klik.</span>
        </h1>
        <p className="font-mono font-light text-[13px] text-[#555] leading-relaxed max-w-md mb-4">
          Pilih kombinasi fitur yang kamu mau — patch, convert, dan interpolasi bisa dijalankan sekaligus dalam satu pipeline.
        </p>
        <div className="flex flex-wrap gap-2">
          {[['✓ Client-side','border-[rgba(79,255,176,.3)] text-[#4fffb0]'],
            ['✓ No upload','border-[rgba(79,255,176,.3)] text-[#4fffb0]'],
            ['Pipeline mode','border-[rgba(232,255,71,.3)] text-[#e8ff47]'],
            ['FFmpeg.wasm','border-[rgba(126,184,255,.3)] text-[#7eb8ff]']]
            .map(([l,c])=><span key={l} className={`font-mono text-[11px] px-2.5 py-1 rounded border ${c}`}>{l}</span>)}
        </div>
      </div>

      {/* Drop zone / File card */}
      {!file
        ? <Dropzone onFile={f=>{ if(f) setFile(f) }} accept="video/*" sub="MP4 · MOV · AVI · MKV — semua format didukung" />
        : <FileCard file={file} onRemove={()=>{ setFile(null); setResults(null); clrLogs() }} />
      }

      {/* FFmpeg status — tampil jika ada fitur FFmpeg aktif */}
      {(agreed.convert || agreed.interp) && (pipeline.convert || pipeline.interp) && (
        <div className="flex items-center justify-between px-3 py-2 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-lg mb-4">
          <FFStatus state={ffState} label="FFmpeg.wasm" />
          {ffState === 'idle' && (
            <button onClick={loadFF} className="font-mono text-[10px] text-[#e8ff47] hover:underline">Load sekarang</button>
          )}
        </div>
      )}

      {/* ── PIPELINE CARDS ── */}
      <div className="mb-4">
        <p className="font-mono text-[10px] text-[#555] tracking-widest uppercase mb-3">Pilih fitur yang mau dijalankan</p>

        {/* PATCH */}
        <FeatureCard icon="🔧" title="Patch Metadata" badge="FREE" enabled={pipeline.patch} onToggle={()=>togglePipeline('patch')} locked={false}>
          <div className="space-y-0">
            {[{key:'elst',label:'Edit List Injection',desc:'Fix sinkronisasi A/V'},
              {key:'matrix',label:'Display Matrix Patch',desc:'Set matrix_b = 1'},
              {key:'offset',label:'Recalculate offsets',desc:'Fix stco/co64'}]
              .map((o,i,arr)=>(
                <div key={o.key} className={cls('flex items-center justify-between py-2', i<arr.length-1&&'border-b border-[rgba(255,255,255,0.05)]')}>
                  <div>
                    <p className="font-syne font-semibold text-[12px]">{o.label}</p>
                    <p className="font-mono text-[10px] text-[#555]">{o.desc}</p>
                  </div>
                  <Toggle checked={patchOpts[o.key]} onChange={v=>setPatchOpts(p=>({...p,[o.key]:v}))} />
                </div>
              ))}
          </div>
        </FeatureCard>

        {/* CONVERT */}
        <FeatureCard icon="⚡" title="Convert Video" badge="1080p 60fps" enabled={pipeline.convert} onToggle={()=>togglePipeline('convert')} locked={!agreed.convert}>
          {agreed.convert ? (
            <div>
              <SelectRow label="Resolusi" value={cvOpts.res} onChange={v=>setCvOpts(p=>({...p,res:v}))} options={[
                ['1080:1920','1080p Portrait (TikTok)'],['1920:1080','1080p Landscape'],
                ['1440:2560','1440p Portrait'],['2560:1440','1440p Landscape'],
                ['2160:3840','4K Portrait'],['3840:2160','4K Landscape'],
                ['720:1280','720p Portrait'],['1280:720','720p Landscape'],
              ]}/>
              <SelectRow label="Frame Rate" value={cvOpts.fps} onChange={v=>setCvOpts(p=>({...p,fps:v}))} options={[['60','60 fps'],['30','30 fps'],['24','24 fps'],['120','120 fps']]}/>
              <SelectRow label="Bitrate" value={cvOpts.br} onChange={v=>setCvOpts(p=>({...p,br:v}))} options={[[50,'50 Mbps (TikTok)'],[25,'25 Mbps'],[100,'100 Mbps'],[10,'10 Mbps']]}/>
              <SelectRow label="Codec" value={cvOpts.codec} onChange={v=>setCvOpts(p=>({...p,codec:v}))} options={[['libx264','H.264 (AVC)'],['libx265','H.265 (HEVC)']]}/>
            </div>
          ) : null}
        </FeatureCard>

        {/* INTERPOLASI */}
        <FeatureCard icon="🎞️" title="Interpolasi Frame" badge="60fps" enabled={pipeline.interp} onToggle={()=>togglePipeline('interp')} locked={!agreed.interp}>
          {agreed.interp ? (
            <div>
              <SelectRow label="Target FPS" value={ipOpts.fps} onChange={v=>setIpOpts(p=>({...p,fps:v}))} options={[['60','60 fps'],['120','120 fps'],['48','48 fps']]}/>
              <SelectRow label="Mode" value={ipOpts.mode} onChange={v=>setIpOpts(p=>({...p,mode:v}))} options={[['mci','MCI — terbaik'],['blend','Blend — cepat'],['dup','Duplicate']]}/>
              <SelectRow label="Resolusi output" value={ipOpts.res} onChange={v=>setIpOpts(p=>({...p,res:v}))} options={[['','Sama dengan input'],['1080:1920','1080p Portrait'],['1920:1080','1080p Landscape']]}/>
              <SelectRow label="Bitrate" value={ipOpts.br} onChange={v=>setIpOpts(p=>({...p,br:v}))} options={[[50,'50 Mbps'],[25,'25 Mbps'],[100,'100 Mbps']]}/>
            </div>
          ) : null}
        </FeatureCard>
      </div>

      {/* Pipeline indicator */}
      {anyEnabled && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl">
          <span className="font-mono text-[10px] text-[#555]">Pipeline:</span>
          {pipeline.patch  && <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[rgba(232,255,71,0.1)] text-[#e8ff47] border border-[rgba(232,255,71,0.2)]">Patch</span>}
          {pipeline.patch  && (pipeline.convert||pipeline.interp) && <span className="text-[#555] text-[10px]">→</span>}
          {pipeline.convert && agreed.convert && <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[rgba(126,184,255,0.1)] text-[#7eb8ff] border border-[rgba(126,184,255,0.2)]">Convert</span>}
          {pipeline.convert && agreed.convert && pipeline.interp && agreed.interp && <span className="text-[#555] text-[10px]">→</span>}
          {pipeline.interp  && agreed.interp  && <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[rgba(79,255,176,0.1)] text-[#4fffb0] border border-[rgba(79,255,176,0.2)]">Interpolasi</span>}
        </div>
      )}

      {/* Run button */}
      <button disabled={!canRun} onClick={runPipeline}
        className={cls('w-full py-4 rounded-xl font-syne font-extrabold text-[15px] flex items-center justify-center gap-2 mb-4 transition-all duration-200',
          canRun ? 'bg-[#e8ff47] text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px' : 'bg-[#1a1a1a] text-[#555] cursor-not-allowed')}>
        {running ? <><span className="animate-spin">⟳</span> Memproses pipeline...</> : <>⚡ Jalankan Pipeline</>}
      </button>

      {/* Progress bars */}
      {running && pipeline.convert && agreed.convert && stepStatus.convert !== 'idle' && (
        <ProgressBar pct={stepProg.convert} label="Convert" />
      )}
      {running && pipeline.interp && agreed.interp && stepStatus.interp !== 'idle' && (
        <ProgressBar pct={stepProg.interp} label="Interpolasi" />
      )}

      {/* Logs per step */}
      <LogPanel logs={stepLogs.patch}   status={stepStatus.patch}   label="Patch" />
      <LogPanel logs={stepLogs.convert} status={stepStatus.convert} label="Convert" />
      <LogPanel logs={stepLogs.interp}  status={stepStatus.interp}  label="Interpolasi" />

      {/* Results */}
      {results && (
        <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-4 mb-4">
          <p className="font-syne font-bold text-[14px] text-[#4fffb0] mb-3">✓ Pipeline selesai</p>
          <div className="flex flex-col gap-2">
            {results.patch && (
              <div className="bg-[#1a1a1a] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-[#e8ff47]">🔧 Patch</span>
                  <span className="font-mono text-[10px] text-[#555]">{results.patch.size} · {results.patch.mods} mod</span>
                </div>
                <button onClick={()=>download(results.patch)}
                  className="w-full py-2 border border-[rgba(232,255,71,0.3)] text-[#e8ff47] rounded-lg font-mono text-[11px] hover:bg-[rgba(232,255,71,0.05)] transition-colors">
                  ↓ Download hasil patch
                </button>
              </div>
            )}
            {results.convert && (
              <div className="bg-[#1a1a1a] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-[#7eb8ff]">⚡ Convert</span>
                  <span className="font-mono text-[10px] text-[#555]">{results.convert.size} · {results.convert.res} · {results.convert.fps}fps</span>
                </div>
                <button onClick={()=>download(results.convert)}
                  className="w-full py-2 border border-[rgba(126,184,255,0.3)] text-[#7eb8ff] rounded-lg font-mono text-[11px] hover:bg-[rgba(126,184,255,0.05)] transition-colors">
                  ↓ Download hasil convert
                </button>
              </div>
            )}
            {results.interp && (
              <div className="bg-[#1a1a1a] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[11px] text-[#4fffb0]">🎞️ Interpolasi</span>
                  <span className="font-mono text-[10px] text-[#555]">{results.interp.size} · {results.interp.fps}fps · {results.interp.mode}</span>
                </div>
                <button onClick={()=>download(results.interp)}
                  className="w-full py-2 border border-[rgba(79,255,176,0.3)] text-[#4fffb0] rounded-lg font-mono text-[11px] hover:bg-[rgba(79,255,176,0.05)] transition-colors">
                  ↓ Download hasil interpolasi
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aktivasi fitur (agreement gates) */}
      {(!agreed.convert || !agreed.interp) && (
        <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.07)]">
          <p className="font-mono text-[10px] text-[#555] tracking-widest uppercase mb-4">Aktivasi fitur lanjutan</p>
          {!agreed.convert && (
            <AgreementGate icon="⚡" title="Aktifkan Convert"
              desc="Re-encode video dengan FFmpeg.wasm — resize, fps, bitrate, BT.709, loudnorm -14 LUFS. Semua di browser."
              checks={['Saya mengerti proses berjalan di browser saya sendiri','Saya mengerti file besar membutuhkan waktu lebih lama','Saya setuju menggunakan untuk keperluan pribadi']}
              onAgree={()=>agree('convert')} />
          )}
          {!agreed.interp && (
            <AgreementGate icon="🎞️" title="Aktifkan Interpolasi"
              desc="Tingkatkan framerate ke 60fps dengan minterpolate MCI — bidirectional motion compensation. Disarankan video maks 100MB."
              checks={['Saya mengerti interpolasi lebih lambat dari convert biasa','Saya disarankan pakai video maks 100MB','Saya setuju menggunakan untuk keperluan pribadi']}
              onAgree={()=>agree('interp')} />
          )}
        </div>
      )}

      {/* Revoke buttons jika sudah agree */}
      {(agreed.convert || agreed.interp) && (
        <div className="flex gap-2 mt-2 mb-4">
          {agreed.convert && <button onClick={()=>revoke('convert')} className="font-mono text-[10px] text-[#555] hover:text-[#ff4f4f] border border-[rgba(255,255,255,0.07)] rounded px-2 py-1">Revoke Convert</button>}
          {agreed.interp  && <button onClick={()=>revoke('interp')}  className="font-mono text-[10px] text-[#555] hover:text-[#ff4f4f] border border-[rgba(255,255,255,0.07)] rounded px-2 py-1">Revoke Interpolasi</button>}
        </div>
      )}

      {/* History */}
      <HistorySection entries={entries} ttlHours={ttlHours} onRemove={histRemove} onClear={histClear} onChangeTTL={changeTTL} />

      {/* Footer */}
      <div className="mt-10 pt-5 border-t border-[rgba(255,255,255,0.07)] flex justify-between flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#555]">Created by</span>
          <a href="https://www.instagram.com/muhamadfildza" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[11px] text-[#e8ff47] hover:text-[#f0ff6a] transition-colors flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
            Muhamad Fildza
          </a>
        </div>
        <span className="font-mono text-[11px] text-[#555]">no server · no tracking</span>
      </div>
    </div>
  )
}
