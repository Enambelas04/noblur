'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { patchMP4 } from '@/lib/patcher'
import { buildConvertArgs, buildInterpArgs } from '@/lib/ffmpegArgs'
import { useHistory, timeLeft } from '@/hooks/useHistory'

const fmt = b => (b / 1024 / 1024).toFixed(2) + ' MB'
const cls = (...a) => a.filter(Boolean).join(' ')
const LS_KEY = 'noblur_agreed'

function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cls('relative w-10 h-[22px] rounded-full border transition-all duration-200 flex-shrink-0',
        checked ? 'bg-[rgba(232,255,71,0.15)] border-[#e8ff47]' : 'bg-[#1a1a1a] border-[rgba(255,255,255,0.12)]')}>
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
    <div className="bg-[#111] border border-[rgba(232,255,71,0.12)] rounded-2xl p-6 mb-5">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-syne font-bold text-[15px] mb-2">{title}</h3>
      <p className="font-mono text-[12px] text-[#555] leading-relaxed mb-5">{desc}</p>
      <div className="flex flex-col gap-3 mb-5">
        {checks.map((chk, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={ticked[i]}
              onChange={e => { const n=[...ticked]; n[i]=e.target.checked; setTicked(n) }}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#e8ff47] cursor-pointer" />
            <span className={`font-mono text-[12px] leading-relaxed ${ticked[i]?'text-[#f0f0f0]':'text-[#555]'}`}>{chk}</span>
          </label>
        ))}
      </div>
      <button disabled={!allOk} onClick={onAgree}
        className={cls('w-full py-3 rounded-xl font-syne font-bold text-[13px] transition-all duration-200',
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

function LogPanel({ logs, status }) {
  if (!logs.length) return null
  return (
    <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-2">
        <div className={cls('w-[7px] h-[7px] rounded-full',
          status==='run'?'bg-[#e8ff47] animate-pulse':status==='done'?'bg-[#4fffb0]':'bg-[#ff4f4f]')} />
        <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">
          {status==='run'?'processing':status==='done'?'done':'error'}
        </span>
      </div>
      <div className="p-3 max-h-40 overflow-y-auto space-y-0.5">
        {logs.map((l,i)=><LogLine key={i} {...l}/>)}
      </div>
    </div>
  )
}

function ProgressBar({ pct, label }) {
  return (
    <div className="mb-4">
      <div className="h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-1.5">
        <div className="h-full bg-[#e8ff47] rounded-full transition-all duration-300" style={{width:pct+'%'}} />
      </div>
      <p className="font-mono text-[11px] text-[#555]">{label} {pct}%</p>
    </div>
  )
}

function FFStatus({ state }) {
  const dot = state==='loading'?'bg-[#e8ff47] animate-pulse':state==='ready'?'bg-[#4fffb0]':'bg-[#ff4f4f]'
  const txt = state==='loading'?'Memuat FFmpeg.wasm core-mt (~30MB)...':state==='ready'?'FFmpeg.wasm siap ✓':'Gagal load FFmpeg'
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-lg mb-4 font-mono text-[11px] text-[#555]">
      <div className={cls('w-[7px] h-[7px] rounded-full flex-shrink-0', dot)} />{txt}
    </div>
  )
}

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
              const ttl  = timeLeft(e.createdAt, ttlHours)
              const time = new Date(e.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
              const date = new Date(e.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short'})
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

export default function Patcher() {
  const [tab, setTab] = useState('patch')
  const [agreed, setAgreed] = useState({ convert: false, interp: false })

  useEffect(() => {
    try { const s=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); setAgreed({convert:!!s.convert,interp:!!s.interp}) } catch {}
  }, [])

  const agree = feat => {
    const next={...agreed,[feat]:true}; setAgreed(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    if(feat==='convert') loadFF('convert')
    if(feat==='interp')  loadFF('interp')
  }
  const revoke = feat => {
    const next={...agreed,[feat]:false}; setAgreed(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const [files,  setFiles]  = useState({patch:null,convert:null,interp:null})
  const setFile  = (f,v)    => setFiles(p=>({...p,[f]:v}))
  const rmFile   = f        => setFile(f,null)

  const [logs,   setLogs]   = useState({patch:[],convert:[],interp:[]})
  const [status, setStatus] = useState({patch:'idle',convert:'idle',interp:'idle'})
  const addLog  = (f,msg,c='') => setLogs(p=>({...p,[f]:[...p[f],{msg,cls:c}]}))
  const clrLog  = f            => setLogs(p=>({...p,[f]:[]}))
  const setStat = (f,s)        => setStatus(p=>({...p,[f]:s}))

  const [prog, setProg] = useState({convert:0,interp:0})
  const setPct = (f,n)  => setProg(p=>({...p,[f]:n}))

  const [results, setResults] = useState({patch:null,convert:null,interp:null})
  const setResult = (f,v)     => setResults(p=>({...p,[f]:v}))

  const [ffState, setFFState] = useState({convert:'idle',interp:'idle'})
  const ffRef = useRef({convert:null,interp:null})

  const loadFF = useCallback(async feat => {
    setFFState(p=>({...p,[feat]:'loading'}))
    try {
      const {FFmpeg}    = await import('@ffmpeg/ffmpeg')
      const {toBlobURL} = await import('@ffmpeg/util')
      const ff = new FFmpeg()
      ff.on('log',({message:m})=>{ if(m.includes('frame=')||m.includes('time=')||m.includes('fps=')) addLog(feat,m,'inf') })
      ff.on('progress',({progress:p})=>setPct(feat,Math.round(p*100)))
      const base='https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd'
      await ff.load({
        coreURL:   await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),
        wasmURL:   await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm'),
        workerURL: await toBlobURL(base+'/ffmpeg-core.worker.js','text/javascript'),
      })
      ffRef.current[feat]=ff
      setFFState(p=>({...p,[feat]:'ready'}))
    } catch(e) {
      setFFState(p=>({...p,[feat]:'error'}))
      addLog(feat,'[error] '+e.message,'err')
    }
  }, [])

  useEffect(()=>{
    if(agreed.convert&&!ffRef.current.convert) loadFF('convert')
    if(agreed.interp&&!ffRef.current.interp)   loadFF('interp')
  },[agreed,loadFF])

  const {entries,ttlHours,add:histAdd,remove:histRemove,clear:histClear,changeTTL} = useHistory()

  const [opts,   setOpts]   = useState({elst:true,matrix:true,offset:true})
  const [cvOpts, setCvOpts] = useState({res:'1920:1080',fps:'60',br:50,codec:'libx264'})
  const [ipOpts, setIpOpts] = useState({fps:'60',mode:'mci',res:'',br:50})

  const download = r => { if(!r?.url) return; const a=document.createElement('a');a.href=r.url;a.download=r.name;a.click() }

  const runPatch = async () => {
    if(!files.patch) return
    clrLog('patch'); setResult('patch',null); setStat('patch','run')
    try {
      const buf=await files.patch.arrayBuffer()
      await new Promise(r=>setTimeout(r,0))
      const res=patchMP4(buf,{doElst:opts.elst,doMatrix:opts.matrix,doOffset:opts.offset})
      res.logs.forEach(l=>addLog('patch',l.msg,l.cls))
      const blob=new Blob([res.buffer],{type:files.patch.type})
      const url=URL.createObjectURL(blob)
      const name=files.patch.name.replace(/\.(mp4|mov)$/i,'_noblur.$1')
      setResult('patch',{size:fmt(blob.size),mods:res.atomsModified,elst:res.elstInjected,mat:res.matrixPatched,url,name})
      setStat('patch','done')
      histAdd({type:'patch',filename:files.patch.name,outputSize:fmt(blob.size),mods:res.atomsModified})
    } catch(e) { addLog('patch','[error] '+e.message,'err'); setStat('patch','error') }
  }

  const runConvert = async () => {
    const ff=ffRef.current.convert; if(!files.convert||!ff) return
    clrLog('convert'); setResult('convert',null); setStat('convert','run'); setPct('convert',0)
    const {res,fps,br,codec}=cvOpts
    const ext=files.convert.name.split('.').pop().toLowerCase()
    const inN='cv_in.'+ext
    const outN=files.convert.name.replace(/\.[^.]+$/,`_${res.replace(':','x')}_${fps}fps.mp4`)
    try {
      addLog('convert','[init] '+fmt(files.convert.size),'inf')
      addLog('convert',`[init] ${res.replace(':','x')} @ ${fps}fps · ${br}Mbps · ${codec}`,'inf')
      const {fetchFile}=await import('@ffmpeg/util')
      await ff.writeFile(inN,await fetchFile(files.convert))
      addLog('convert','[wasm] file dimuat ✓','ok')
      addLog('convert',`[opt] lanczos·letterbox·BT.709·CRF${parseInt(res.split(':')[1])>=1080?'18':'20'}`,'')
      addLog('convert','[opt] AAC 192k · loudnorm -14 LUFS · 44.1kHz','')
      addLog('convert','[ffmpeg] mulai encode...','')
      await ff.exec(buildConvertArgs(inN,outN,{res,fps,br,codec}))
      const raw=await ff.readFile(outN)
      const blob=new Blob([raw.buffer],{type:'video/mp4'})
      const url=URL.createObjectURL(blob)
      await ff.deleteFile(inN); await ff.deleteFile(outN)
      addLog('convert','[done] '+fmt(blob.size)+' ✓','ok')
      setStat('convert','done'); setPct('convert',100)
      setResult('convert',{size:fmt(blob.size),res:res.replace(':','x'),fps,codec,url,name:outN})
      histAdd({type:'convert',filename:files.convert.name,outputSize:fmt(blob.size),resolution:res.replace(':','x'),fps})
    } catch(e) { addLog('convert','[error] '+e.message,'err'); setStat('convert','error') }
  }

  const runInterp = async () => {
    const ff=ffRef.current.interp; if(!files.interp||!ff) return
    clrLog('interp'); setResult('interp',null); setStat('interp','run'); setPct('interp',0)
    const {fps,mode,res,br}=ipOpts
    const ext=files.interp.name.split('.').pop().toLowerCase()
    const inN='ip_in.'+ext
    const outN=files.interp.name.replace(/\.[^.]+$/,`_${fps}fps_interp.mp4`)
    try {
      addLog('interp','[init] '+fmt(files.interp.size),'inf')
      addLog('interp',`[init] target ${fps}fps · mode=${mode.toUpperCase()}`,'inf')
      const {fetchFile}=await import('@ffmpeg/util')
      await ff.writeFile(inN,await fetchFile(files.interp))
      addLog('interp','[wasm] file dimuat ✓','ok')
      if(mode==='mci') addLog('interp','[opt] MCI · aobmc · bidir · vsbmc=1 — terbaik, paling lambat','warn')
      else if(mode==='blend') addLog('interp','[opt] Blend — sedang','')
      else addLog('interp','[opt] Duplicate — tercepat','')
      addLog('interp','[ffmpeg] mulai interpolasi...','')
      await ff.exec(buildInterpArgs(inN,outN,{fps,mode,res,br}))
      const raw=await ff.readFile(outN)
      const blob=new Blob([raw.buffer],{type:'video/mp4'})
      const url=URL.createObjectURL(blob)
      await ff.deleteFile(inN); await ff.deleteFile(outN)
      addLog('interp','[done] '+fmt(blob.size)+' ✓','ok')
      setStat('interp','done'); setPct('interp',100)
      setResult('interp',{size:fmt(blob.size),fps,mode:mode.toUpperCase(),url,name:outN})
      histAdd({type:'interp',filename:files.interp.name,outputSize:fmt(blob.size),fps,mode:mode.toUpperCase()})
    } catch(e) { addLog('interp','[error] '+e.message,'err'); setStat('interp','error') }
  }

  const tabs=[
    {id:'patch',  label:'🔧 Patch',      locked:false},
    {id:'convert',label:'⚡ Convert',     locked:!agreed.convert},
    {id:'interp', label:'🎞️ Interpolasi', locked:!agreed.interp},
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-7">
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
          Video suite.<br /><span className="text-[#e8ff47]">Zero server.</span>
        </h1>
        <p className="font-mono font-light text-[13px] text-[#555] leading-relaxed max-w-md mb-4">
          Patch metadata · Convert 1080p 60fps · Interpolasi frame — semua di browser, privasi terjamin.
        </p>
        <div className="flex flex-wrap gap-2">
          {[['✓ Client-side','border-[rgba(79,255,176,.3)] text-[#4fffb0]'],['✓ No upload','border-[rgba(79,255,176,.3)] text-[#4fffb0]'],
            ['Free: Patch','border-[rgba(232,255,71,.3)] text-[#e8ff47]'],['Pro: Convert + Interp','border-[rgba(126,184,255,.3)] text-[#7eb8ff]']]
            .map(([l,c])=><span key={l} className={`font-mono text-[11px] px-2.5 py-1 rounded border ${c}`}>{l}</span>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 mb-6">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={cls('flex-1 py-2.5 px-2 rounded-lg font-syne text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5',
              tab===t.id?'bg-[#1a1a1a] text-[#f0f0f0] shadow':'text-[#555]')}>
            {t.label}
            {t.locked&&<span className="text-[10px] opacity-60">🔒</span>}
            {!t.locked&&t.id!=='patch'&&<span className="text-[10px] text-[#4fffb0]">✓</span>}
          </button>
        ))}
      </div>

      {/* ── PATCH ── */}
      {tab==='patch'&&(
        <div>
          {!files.patch?<Dropzone onFile={f=>setFile('patch',f)} accept=".mp4,.mov,video/mp4,video/quicktime" sub="MP4 · MOV · gratis · tanpa batas"/>
            :<FileCard file={files.patch} onRemove={()=>rmFile('patch')}/>}
          <div className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 mb-4">
            <p className="font-mono text-[10px] text-[#555] tracking-widest uppercase mb-3">Patch Options</p>
            {[{key:'elst',label:'Pass 1 — Edit List Injection',desc:'Inject edts/elst · fix sinkronisasi A/V'},
              {key:'matrix',label:'Pass 2 — Display Matrix Patch',desc:'Set matrix_b = 1 di mvhd'},
              {key:'offset',label:'Recalculate chunk offsets',desc:'Auto-fix stco/co64 setelah injeksi'}]
              .map((o,i,arr)=>(
                <div key={o.key} className={cls('flex items-center justify-between py-2.5',i<arr.length-1&&'border-b border-[rgba(255,255,255,0.07)]')}>
                  <div><p className="font-syne font-semibold text-[13px] mb-0.5">{o.label}</p><p className="font-mono text-[11px] text-[#555]">{o.desc}</p></div>
                  <Toggle checked={opts[o.key]} onChange={v=>setOpts(p=>({...p,[o.key]:v}))}/>
                </div>
              ))}
          </div>
          <button disabled={!files.patch||status.patch==='run'} onClick={runPatch}
            className={cls('w-full py-3.5 rounded-xl font-syne font-extrabold text-[14px] flex items-center justify-center gap-2 mb-4 transition-all duration-200',
              files.patch&&status.patch!=='run'?'bg-[#e8ff47] text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px':'bg-[#1a1a1a] text-[#555] cursor-not-allowed')}>
            {status.patch==='run'?<><span className="animate-spin">⟳</span> Memproses...</>:<>⚡ Patch Video</>}
          </button>
          <LogPanel logs={logs.patch} status={status.patch}/>
          {results.patch&&(
            <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-4 mb-4">
              <p className="font-syne font-bold text-[14px] text-[#4fffb0] flex items-center gap-2 mb-3">✓ Patch selesai</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat label="Ukuran" val={results.patch.size}/>
                <Stat label="Modifikasi" val={results.patch.mods} green/>
                <Stat label="elst injected" val={results.patch.elst?'Ya ✓':'Tidak perlu'} green={results.patch.elst}/>
                <Stat label="matrix_b" val={results.patch.mat?'Ya ✓':'Tidak perlu'} green={results.patch.mat}/>
              </div>
              <button onClick={()=>download(results.patch)}
                className="w-full py-2.5 border-[1.5px] border-[#4fffb0] text-[#4fffb0] rounded-xl font-syne font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[rgba(79,255,176,0.08)] transition-colors">
                ↓ Download hasil patch
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {[['🔒','Privasi total','File tidak pernah meninggalkan browser kamu.'],
              ['⚡','Instan','Tidak ada upload, proses selesai dalam detik.'],
              ['🎯','Non-destructive','Hanya metadata container yang dimodifikasi.'],
              ['📦','Zero install','Buka browser, langsung pakai.']]
              .map(([ic,t,d])=>(
                <div key={t} className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-3.5">
                  <div className="text-lg mb-1.5">{ic}</div>
                  <p className="font-syne font-bold text-[12px] mb-1">{t}</p>
                  <p className="font-mono text-[11px] text-[#555] leading-relaxed">{d}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── CONVERT ── */}
      {tab==='convert'&&(
        <div>
          {!agreed.convert?(
            <AgreementGate icon="⚡" title="Aktifkan Video Converter"
              desc="Re-encode video dengan FFmpeg.wasm — resize, fps, bitrate, colorspace BT.709, audio loudnorm -14 LUFS. Semua di browser, file tidak dikirim ke mana pun."
              checks={['Saya mengerti proses berjalan di browser saya sendiri','Saya mengerti file besar membutuhkan waktu lebih lama','Saya setuju menggunakan fitur ini untuk keperluan pribadi']}
              onAgree={()=>agree('convert')}/>
          ):(
            <div>
              <div className="flex items-center gap-2.5 bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.18)] rounded-xl px-4 py-2.5 mb-4">
                <span className="text-[#4fffb0]">✓</span>
                <div className="flex-1"><p className="font-syne font-bold text-[12px] text-[#4fffb0]">Converter Aktif</p><p className="font-mono text-[10px] text-[#555]">FFmpeg.wasm · lanczos · BT.709 · loudnorm</p></div>
                <button onClick={()=>revoke('convert')} className="font-mono text-[11px] text-[#555] hover:text-[#ff4f4f]">Revoke</button>
              </div>
              <FFStatus state={ffState.convert}/>
              {!files.convert?<Dropzone onFile={f=>setFile('convert',f)} accept="video/*" sub="MP4 · MOV · AVI · MKV · WEBM"/>
                :<FileCard file={files.convert} onRemove={()=>rmFile('convert')}/>}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {[{label:'Resolusi',key:'res',opts:[['1920:1080','1080p FHD'],['2560:1440','1440p QHD'],['3840:2160','4K UHD'],['1280:720','720p HD']]},
                  {label:'Frame Rate',key:'fps',opts:[['60','60 fps'],['30','30 fps'],['24','24 fps'],['120','120 fps']]},
                  {label:'Bitrate',key:'br',opts:[[50,'50 Mbps (TikTok)'],[25,'25 Mbps'],[100,'100 Mbps'],[10,'10 Mbps']]},
                  {label:'Codec',key:'codec',opts:[['libx264','H.264 (AVC)'],['libx265','H.265 (HEVC)']]}]
                  .map(s=>(
                    <div key={s.key} className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-3">
                      <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-2">{s.label}</p>
                      <select value={cvOpts[s.key]} onChange={e=>setCvOpts(p=>({...p,[s.key]:e.target.value}))}
                        className="w-full bg-transparent font-syne font-bold text-[13px] text-[#f0f0f0] outline-none cursor-pointer">
                        {s.opts.map(([v,l])=><option key={v} value={v} className="bg-[#111]">{l}</option>)}
                      </select>
                    </div>
                  ))}
              </div>
              <button disabled={!files.convert||ffState.convert!=='ready'||status.convert==='run'} onClick={runConvert}
                className={cls('w-full py-3.5 rounded-xl font-syne font-extrabold text-[14px] flex items-center justify-center gap-2 mb-4 transition-all duration-200',
                  files.convert&&ffState.convert==='ready'&&status.convert!=='run'?'bg-[#e8ff47] text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px':'bg-[#1a1a1a] text-[#555] cursor-not-allowed')}>
                {status.convert==='run'?<><span className="animate-spin">⟳</span> Converting... {prog.convert}%</>:<>⚡ Convert Video</>}
              </button>
              {status.convert==='run'&&<ProgressBar pct={prog.convert} label="Encoding"/>}
              <LogPanel logs={logs.convert} status={status.convert}/>
              {results.convert&&(
                <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-4 mb-4">
                  <p className="font-syne font-bold text-[14px] text-[#4fffb0] mb-3">✓ Konversi selesai</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Stat label="Output size" val={results.convert.size}/>
                    <Stat label="Resolusi" val={results.convert.res} green/>
                    <Stat label="FPS" val={results.convert.fps+' fps'} green/>
                    <Stat label="Codec" val={results.convert.codec}/>
                  </div>
                  <button onClick={()=>download(results.convert)}
                    className="w-full py-2.5 border-[1.5px] border-[#4fffb0] text-[#4fffb0] rounded-xl font-syne font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[rgba(79,255,176,0.08)] transition-colors">
                    ↓ Download hasil convert
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INTERPOLASI ── */}
      {tab==='interp'&&(
        <div>
          {!agreed.interp?(
            <AgreementGate icon="🎞️" title="Aktifkan Frame Interpolation"
              desc="Tingkatkan framerate ke 60fps dengan FFmpeg minterpolate MCI — motion compensated interpolation bidirectional untuk hasil paling halus."
              checks={['Saya mengerti interpolasi lebih lambat dari convert biasa','Saya disarankan pakai video maks 100MB untuk hasil optimal','Saya setuju menggunakan fitur ini untuk keperluan pribadi']}
              onAgree={()=>agree('interp')}/>
          ):(
            <div>
              <div className="flex items-center gap-2.5 bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.18)] rounded-xl px-4 py-2.5 mb-4">
                <span className="text-[#4fffb0]">✓</span>
                <div className="flex-1"><p className="font-syne font-bold text-[12px] text-[#4fffb0]">Interpolasi Aktif</p><p className="font-mono text-[10px] text-[#555]">FFmpeg minterpolate · MCI · bidir · vsbmc</p></div>
                <button onClick={()=>revoke('interp')} className="font-mono text-[11px] text-[#555] hover:text-[#ff4f4f]">Revoke</button>
              </div>
              <FFStatus state={ffState.interp}/>
              <div className="bg-[rgba(126,184,255,0.04)] border border-[rgba(126,184,255,0.15)] rounded-xl px-4 py-3 mb-4">
                <p className="font-mono text-[11px] text-[#555] leading-relaxed">
                  Algoritma <span className="text-[#7eb8ff]">MCI</span> menganalisis arah gerakan antar frame — mode <span className="text-[#7eb8ff]">bidir + vsbmc</span> menghasilkan interpolasi paling halus tapi <span className="text-[#7eb8ff]">proses lebih lambat</span>.
                </p>
              </div>
              {!files.interp?<Dropzone onFile={f=>setFile('interp',f)} accept=".mp4,.mov,video/mp4,video/quicktime" sub="MP4 · MOV · disarankan maks 100MB"/>
                :<FileCard file={files.interp} onRemove={()=>rmFile('interp')}/>}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {[{label:'Target FPS',key:'fps',opts:[['60','60 fps'],['120','120 fps'],['48','48 fps']]},
                  {label:'Mode',key:'mode',opts:[['mci','MCI — terbaik'],['blend','Blend — cepat'],['dup','Duplicate — tercepat']]},
                  {label:'Resolusi output',key:'res',opts:[['','Sama dengan input'],['1920:1080','1080p'],['1280:720','720p']]},
                  {label:'Bitrate',key:'br',opts:[[50,'50 Mbps'],[25,'25 Mbps'],[100,'100 Mbps']]}]
                  .map(s=>(
                    <div key={s.key} className="bg-[#111] border border-[rgba(255,255,255,0.07)] rounded-xl p-3">
                      <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mb-2">{s.label}</p>
                      <select value={ipOpts[s.key]} onChange={e=>setIpOpts(p=>({...p,[s.key]:e.target.value}))}
                        className="w-full bg-transparent font-syne font-bold text-[13px] text-[#f0f0f0] outline-none cursor-pointer">
                        {s.opts.map(([v,l])=><option key={v} value={v} className="bg-[#111]">{l}</option>)}
                      </select>
                    </div>
                  ))}
              </div>
              <button disabled={!files.interp||ffState.interp!=='ready'||status.interp==='run'} onClick={runInterp}
                className={cls('w-full py-3.5 rounded-xl font-syne font-extrabold text-[14px] flex items-center justify-center gap-2 mb-4 transition-all duration-200',
                  files.interp&&ffState.interp==='ready'&&status.interp!=='run'?'bg-[#e8ff47] text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px':'bg-[#1a1a1a] text-[#555] cursor-not-allowed')}>
                {status.interp==='run'?<><span className="animate-spin">⟳</span> Interpolating... {prog.interp}%</>:<>🎞️ Mulai Interpolasi</>}
              </button>
              {status.interp==='run'&&<ProgressBar pct={prog.interp} label="Interpolating"/>}
              <LogPanel logs={logs.interp} status={status.interp}/>
              {results.interp&&(
                <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-4 mb-4">
                  <p className="font-syne font-bold text-[14px] text-[#4fffb0] mb-3">✓ Interpolasi selesai</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Stat label="Output size" val={results.interp.size}/>
                    <Stat label="Target FPS" val={results.interp.fps+' fps'} green/>
                    <Stat label="Mode" val={results.interp.mode}/>
                    <Stat label="Status" val="✓ Done" green/>
                  </div>
                  <button onClick={()=>download(results.interp)}
                    className="w-full py-2.5 border-[1.5px] border-[#4fffb0] text-[#4fffb0] rounded-xl font-syne font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[rgba(79,255,176,0.08)] transition-colors">
                    ↓ Download hasil interpolasi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <HistorySection entries={entries} ttlHours={ttlHours} onRemove={histRemove} onClear={histClear} onChangeTTL={changeTTL}/>

      {/* Footer */}
      <div className="mt-10 pt-5 border-t border-[rgba(255,255,255,0.07)] flex justify-between flex-wrap gap-2">
        <span className="font-mono text-[11px] text-[#555]">NoBlur v2.0 — Powered By : Muhamad Fildza</span>
        <span className="font-mono text-[11px] text-[#555]">no server · no tracking</span>
      </div>
    </div>
  )
}
