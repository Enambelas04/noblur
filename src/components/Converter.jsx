'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const cls = (...args) => args.filter(Boolean).join(' ')
const fmt = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB'

function Select({ label, value, onChange, options }) {
  return (
    <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
      <p className="font-mono text-[10px] text-[#666] tracking-widest uppercase mb-2">{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent font-syne font-bold text-[13px] text-[#f0f0f0] outline-none cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
      </select>
    </div>
  )
}

export default function Converter() {
  const [file,       setFile]       = useState(null)
  const [isDrag,     setIsDrag]     = useState(false)
  const [status,     setStatus]     = useState('idle')
  const [logs,       setLogs]       = useState([])
  const [progress,   setProgress]   = useState(0)
  const [resultUrl,  setResultUrl]  = useState(null)
  const [resultName, setResultName] = useState('')
  const [resultSize, setResultSize] = useState('')
  const [ffmpegReady, setFfmpegReady] = useState(false)
  const [loading,    setLoading]    = useState(false)

  const [resolution, setResolution] = useState('1920:1080')
  const [fps,        setFps]        = useState('60')
  const [bitrate,    setBitrate]    = useState('25M')
  const [codec,      setCodec]      = useState('libx264')

  const ffmpegRef  = useRef(null)
  const fileInputRef = useRef(null)

  const addLog = (msg, cls = '') => setLogs(prev => [...prev, { msg, cls }])

  // Load FFmpeg.wasm
  useEffect(() => {
    let mounted = true
    async function loadFFmpeg() {
      setLoading(true)
      try {
        addLog('[init] memuat FFmpeg.wasm...', '')
        const { FFmpeg } = await import('@ffmpeg/ffmpeg')
        const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

        const ffmpeg = new FFmpeg()
        ffmpeg.on('log', ({ message }) => {
          if (message.includes('frame=') || message.includes('time=')) {
            addLog(message, 'info')
          }
        })
        ffmpeg.on('progress', ({ progress: p }) => {
          setProgress(Math.round(p * 100))
        })

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
        await ffmpeg.load({
          coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
          wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })

        if (mounted) {
          ffmpegRef.current = { ffmpeg, fetchFile }
          setFfmpegReady(true)
          addLog('[init] FFmpeg.wasm siap ✓', 'ok')
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          addLog(`[error] gagal load FFmpeg: ${err.message}`, 'err')
          setLoading(false)
        }
      }
    }
    loadFFmpeg()
    return () => { mounted = false }
  }, [])

  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      alert('Format tidak didukung. Gunakan MP4, MOV, AVI, MKV, atau WEBM.')
      return
    }
    setFile(f)
    setStatus('idle')
    setLogs([])
    setProgress(0)
    setResultUrl(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDrag(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const runConvert = async () => {
    if (!file || !ffmpegRef.current) return
    const { ffmpeg, fetchFile } = ffmpegRef.current

    setStatus('processing')
    setProgress(0)
    setLogs([])
    setResultUrl(null)

    try {
      const ext    = file.name.split('.').pop().toLowerCase()
      const inName = `input.${ext}`
      const outName = file.name.replace(/\.[^.]+$/, '_converted.mp4')

      addLog(`[start] membaca file: ${fmt(file.size)}`, 'info')
      await ffmpeg.writeFile(inName, await fetchFile(file))
      addLog('[ffmpeg] file dimuat ke WASM memory ✓', 'ok')

      // Build FFmpeg args
      const args = [
        '-i', inName,
        '-vf', `scale=${resolution},fps=${fps}`,
        '-c:v', codec,
        '-b:v', bitrate,
        '-preset', 'fast',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '192k',
        outName
      ]

      addLog(`[ffmpeg] encode ${resolution.replace(':', 'x')} @ ${fps}fps ${bitrate}ps...`, '')
      await ffmpeg.exec(args)

      addLog('[ffmpeg] encode selesai ✓', 'ok')

      const data = await ffmpeg.readFile(outName)
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      const url  = URL.createObjectURL(blob)

      setResultUrl(url)
      setResultName(outName)
      setResultSize(fmt(blob.size))
      setStatus('done')
      setProgress(100)
      addLog(`[done] output: ${fmt(blob.size)} ✓`, 'ok')

      // Cleanup WASM memory
      await ffmpeg.deleteFile(inName)
      await ffmpeg.deleteFile(outName)

    } catch (err) {
      addLog(`[error] ${err.message}`, 'err')
      setStatus('error')
    }
  }

  const download = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = resultName
    a.click()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] text-[#666] tracking-widest uppercase">Mode 2</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-[rgba(232,255,71,0.3)] text-accent">FFmpeg.wasm</span>
          {ffmpegReady && <span className="font-mono text-[11px] text-[#4fffb0]">● ready</span>}
          {loading    && <span className="font-mono text-[11px] text-[#666] animate-pulse">● loading...</span>}
        </div>
        <h2 className="font-syne font-extrabold text-3xl tracking-tight mb-2">
          Video <span className="text-accent">Converter</span>
        </h2>
        <p className="font-mono text-[13px] text-[#666]">
          Resize · Framerate · Bitrate — langsung di browser, tanpa server.
        </p>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cls(
            'border-[1.5px] border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 bg-surface mb-6',
            isDrag ? 'border-accent bg-[rgba(232,255,71,0.03)]' : 'border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.25)]'
          )}
        >
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          <div className="text-3xl mb-3">🎬</div>
          <p className="font-syne font-bold text-base mb-1">Pilih atau seret video</p>
          <p className="font-mono text-[12px] text-[#666]">MP4 · MOV · AVI · MKV · WEBM</p>
        </div>
      )}

      {/* File card */}
      {file && (
        <div className="flex items-center gap-3 bg-surface border border-[rgba(255,255,255,0.12)] rounded-xl px-5 py-4 mb-6">
          <div className="text-xl">🎞️</div>
          <div className="flex-1 min-w-0">
            <div className="font-syne font-bold text-sm truncate mb-1">{file.name}</div>
            <div className="font-mono text-[11px] text-[#666]">{fmt(file.size)} · {file.name.split('.').pop().toUpperCase()}</div>
          </div>
          <button onClick={() => { setFile(null); setStatus('idle'); setLogs([]); setResultUrl(null) }}
            className="text-[#666] hover:text-[#ff4f4f] transition-colors text-lg px-1">✕</button>
        </div>
      )}

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Select label="Resolusi" value={resolution} onChange={setResolution} options={[
          { value: '1920:1080', label: '1080p (FHD)' },
          { value: '2560:1440', label: '1440p (QHD)' },
          { value: '3840:2160', label: '4K (UHD)' },
          { value: '1280:720',  label: '720p (HD)' },
        ]} />
        <Select label="Frame Rate" value={fps} onChange={setFps} options={[
          { value: '60', label: '60 fps' },
          { value: '30', label: '30 fps' },
          { value: '24', label: '24 fps' },
          { value: '120', label: '120 fps' },
        ]} />
        <Select label="Bitrate" value={bitrate} onChange={setBitrate} options={[
          { value: '25M', label: '25 Mbps' },
          { value: '50M', label: '50 Mbps' },
          { value: '100M', label: '100 Mbps' },
          { value: '10M', label: '10 Mbps' },
        ]} />
        <Select label="Codec" value={codec} onChange={setCodec} options={[
          { value: 'libx264', label: 'H.264 (AVC)' },
          { value: 'libx265', label: 'H.265 (HEVC)' },
        ]} />
      </div>

      {/* Convert button */}
      <button
        onClick={runConvert}
        disabled={!file || !ffmpegReady || status === 'processing'}
        className={cls(
          'w-full py-4 rounded-xl font-syne font-extrabold text-[15px] tracking-tight',
          'flex items-center justify-center gap-2 mb-6 transition-all duration-200',
          file && ffmpegReady && status !== 'processing'
            ? 'bg-accent text-[#0a0a0a] hover:bg-[#f0ff6a] hover:-translate-y-px'
            : 'bg-surface2 text-[#666] cursor-not-allowed'
        )}
      >
        {status === 'processing' ? (
          <><span className="animate-spin">⟳</span> Converting... {progress}%</>
        ) : !ffmpegReady ? (
          <><span className="animate-pulse">⟳</span> Memuat FFmpeg...</>
        ) : (
          <><span>⚡</span> Convert Video</>
        )}
      </button>

      {/* Progress bar */}
      {status === 'processing' && (
        <div className="mb-6">
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Log */}
      {logs.length > 0 && (
        <div className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-2">
            <div className={cls(
              'w-[7px] h-[7px] rounded-full',
              status === 'processing' ? 'bg-accent animate-pulse' :
              status === 'done'       ? 'bg-[#4fffb0]' : 'bg-[#ff4f4f]'
            )} />
            <span className="font-mono text-[11px] text-[#666] tracking-widest uppercase">{status}</span>
          </div>
          <div className="p-4 max-h-40 overflow-y-auto space-y-0.5">
            {logs.map((l, i) => (
              <div key={i} className={cls(
                'font-mono text-[11px] leading-relaxed',
                l.cls === 'ok'   ? 'text-[#4fffb0]' :
                l.cls === 'err'  ? 'text-[#ff4f4f]' :
                l.cls === 'info' ? 'text-[#7eb8ff]' : 'text-[#666]'
              )}>{l.msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {resultUrl && status === 'done' && (
        <div className="bg-[rgba(79,255,176,0.04)] border border-[rgba(79,255,176,0.2)] rounded-xl p-5">
          <p className="font-syne font-bold text-[14px] text-[#4fffb0] mb-4">✓ Konversi selesai</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface2 rounded-lg px-3 py-2.5">
              <p className="font-mono text-[10px] text-[#666] uppercase mb-1">Output size</p>
              <p className="font-mono font-bold text-[13px]">{resultSize}</p>
            </div>
            <div className="bg-surface2 rounded-lg px-3 py-2.5">
              <p className="font-mono text-[10px] text-[#666] uppercase mb-1">Format</p>
              <p className="font-mono font-bold text-[13px] text-accent">{resolution.replace(':', 'x')} · {fps}fps</p>
            </div>
          </div>
          <button onClick={download}
            className="w-full py-3 border-[1.5px] border-[#4fffb0] text-[#4fffb0] rounded-xl font-syne font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-[rgba(79,255,176,0.08)] transition-colors">
            ↓ Download hasil convert
          </button>
        </div>
      )}

      {/* Warning */}
      <div className="mt-6 p-4 bg-surface border border-[rgba(255,255,255,0.07)] rounded-xl">
        <p className="font-mono text-[11px] text-[#666] leading-relaxed">
          ⚠️ FFmpeg.wasm berjalan di CPU browser — file besar mungkin butuh beberapa menit. 
          Untuk video &gt;500MB disarankan pakai browser desktop dengan RAM minimal 4GB.
        </p>
      </div>
    </div>
  )
}
