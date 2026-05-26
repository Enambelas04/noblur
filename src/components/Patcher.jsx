<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NoBlur — TikTok Video Suite</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>
<!-- SharedArrayBuffer diperlukan oleh core-mt untuk multi-threading -->
<!-- Aktifkan COOP/COEP di server, atau pakai coi-serviceworker di bawah -->
<script src="https://unpkg.com/coi-serviceworker@0.1.7/coi-serviceworker.min.js"></script>
<script src="https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0a; --surface: #111; --surface2: #1a1a1a;
  --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.12);
  --text: #f0f0f0; --muted: #555; --accent: #e8ff47;
  --green: #4fffb0; --red: #ff4f4f; --blue: #7eb8ff;
}
body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; }
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
}
.wrap { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; padding: 48px 24px 80px; }

/* Header */
.logo { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
.logo-mark { width: 30px; height: 30px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.logo-text { font-size: 17px; font-weight: 800; letter-spacing: -0.5px; }
h1 { font-size: clamp(32px, 6vw, 52px); font-weight: 800; line-height: 1.05; letter-spacing: -2px; margin-bottom: 12px; }
h1 span { color: var(--accent); }
.subtitle { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--muted); line-height: 1.7; max-width: 460px; margin-bottom: 20px; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 36px; }
.badge { font-family: 'DM Mono', monospace; font-size: 11px; padding: 3px 9px; border-radius: 4px; border: 1px solid var(--border2); color: var(--muted); }
.badge.green { border-color: rgba(79,255,176,0.3); color: var(--green); }
.badge.yellow { border-color: rgba(232,255,71,0.3); color: var(--accent); }
.badge.blue { border-color: rgba(126,184,255,0.3); color: var(--blue); }
.badge.locked { border-color: rgba(255,79,79,0.3); color: var(--red); }

/* Tabs */
.tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 4px; margin-bottom: 28px; }
.tab {
  flex: 1; padding: 10px 8px; border-radius: 8px; border: none; background: transparent;
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600;
  color: var(--muted); cursor: pointer; transition: all 0.2s; display: flex;
  align-items: center; justify-content: center; gap: 6px;
}
.tab.active { background: var(--surface2); color: var(--text); }
.tab.locked-tab { opacity: 0.5; cursor: not-allowed; }
.tab .lock-icon { font-size: 10px; }

/* Panels */
.panel { display: none; }
.panel.active { display: block; }

/* License / Validation */
.license-gate {
  background: var(--surface); border: 1px solid rgba(255,79,79,0.2);
  border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 24px;
}
.license-gate .gate-icon { font-size: 36px; margin-bottom: 12px; }
.license-gate h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.license-gate p { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); margin-bottom: 20px; line-height: 1.6; }
.license-input-row { display: flex; gap: 8px; }
.license-input {
  flex: 1; background: var(--surface2); border: 1px solid var(--border2);
  border-radius: 10px; padding: 11px 14px; font-family: 'DM Mono', monospace;
  font-size: 13px; color: var(--text); outline: none; letter-spacing: 1px;
  transition: border-color 0.2s;
}
.license-input:focus { border-color: var(--accent); }
.license-input.error { border-color: var(--red); }
.license-input.success { border-color: var(--green); }
.unlock-btn {
  padding: 11px 18px; background: var(--accent); color: #0a0a0a;
  border: none; border-radius: 10px; font-family: 'Syne', sans-serif;
  font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.unlock-btn:hover { background: #f0ff6a; }
.license-error { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--red); margin-top: 8px; text-align: left; }
.license-success { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--green); margin-top: 8px; text-align: left; }
.trial-info { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); margin-top: 12px; }
.trial-info span { color: var(--accent); }

/* User badge */
.user-badge {
  display: flex; align-items: center; gap: 10px; background: rgba(79,255,176,0.05);
  border: 1px solid rgba(79,255,176,0.2); border-radius: 10px; padding: 10px 14px; margin-bottom: 20px;
}
.user-badge .plan { font-family: 'DM Mono', monospace; font-size: 11px; }
.user-badge .plan-name { font-weight: 500; color: var(--green); }
.user-badge .plan-detail { color: var(--muted); font-size: 10px; }
.user-badge .logout { margin-left: auto; font-size: 11px; color: var(--muted); cursor: pointer; background: none; border: none; font-family: 'DM Mono', monospace; }
.user-badge .logout:hover { color: var(--red); }

/* Drop zone */
.dropzone {
  border: 1.5px dashed var(--border2); border-radius: 16px; padding: 40px 24px;
  text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface); margin-bottom: 16px;
}
.dropzone:hover, .dropzone.drag { border-color: var(--accent); background: rgba(232,255,71,0.02); }
.dropzone input { display: none; }
.drop-icon { font-size: 28px; margin-bottom: 10px; }
.drop-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.drop-sub { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); }

/* File card */
.file-card { display: none; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border2); border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; }
.file-card.show { display: flex; }
.file-thumb { width: 40px; height: 40px; background: var(--surface2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.file-meta-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
.file-meta-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
.file-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 4px; margin-left: auto; flex-shrink: 0; }
.file-remove:hover { color: var(--red); }

/* Settings grid */
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.setting-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
.setting-label { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.setting-label .pro-tag { font-size: 9px; padding: 1px 5px; background: rgba(232,255,71,0.1); color: var(--accent); border-radius: 3px; border: 1px solid rgba(232,255,71,0.2); }
.setting-select { width: 100%; background: transparent; border: none; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); outline: none; cursor: pointer; }
.setting-select option { background: #111; }
.setting-select:disabled { color: var(--muted); cursor: not-allowed; }

/* Toggle */
.opt-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
.opt-row:last-child { border-bottom: none; padding-bottom: 0; }
.opt-label { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
.opt-desc { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
.toggle { position: relative; width: 38px; height: 20px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-track { position: absolute; inset: 0; background: var(--surface2); border: 1px solid var(--border2); border-radius: 99px; cursor: pointer; transition: all 0.2s; }
.toggle-track::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: var(--muted); top: 2px; left: 2px; transition: all 0.2s; }
.toggle input:checked + .toggle-track { background: rgba(232,255,71,0.15); border-color: var(--accent); }
.toggle input:checked + .toggle-track::after { background: var(--accent); transform: translateX(18px); }
.toggle input:disabled + .toggle-track { opacity: 0.4; cursor: not-allowed; }

/* Options card */
.opts-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; }
.opts-title { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }

/* Primary button */
.primary-btn {
  width: 100%; padding: 14px; background: var(--accent); color: #0a0a0a;
  border: none; border-radius: 12px; font-family: 'Syne', sans-serif;
  font-size: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px;
}
.primary-btn:hover:not(:disabled) { background: #f0ff6a; transform: translateY(-1px); }
.primary-btn:disabled { background: var(--surface2); color: var(--muted); cursor: not-allowed; transform: none; }

/* Progress */
.progress-wrap { margin-bottom: 16px; }
.progress-bar-bg { height: 4px; background: var(--surface2); border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
.progress-bar-fill { height: 100%; background: var(--accent); border-radius: 99px; width: 0%; transition: width 0.3s; }
.progress-label { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }

/* Log */
.log-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 16px; display: none; }
.log-card.show { display: block; }
.log-header { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
.log-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.log-dot.pulse { animation: pulse 1s infinite; }
.log-dot.done { background: var(--green); animation: none; }
.log-dot.err { background: var(--red); animation: none; }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
.log-status { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
.log-body { padding: 14px; max-height: 180px; overflow-y: auto; }
.log-line { font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.8; color: var(--muted); }
.log-line.ok { color: var(--green); }
.log-line.err { color: var(--red); }
.log-line.info { color: var(--blue); }
.log-line.warn { color: var(--accent); }

/* Result card */
.result-card { background: rgba(79,255,176,0.04); border: 1px solid rgba(79,255,176,0.2); border-radius: 12px; padding: 18px; margin-bottom: 16px; display: none; }
.result-card.show { display: block; }
.result-title { font-size: 13px; font-weight: 700; color: var(--green); display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
.result-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.stat { background: var(--surface2); border-radius: 8px; padding: 10px 12px; }
.stat-label { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.stat-val { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; color: var(--text); }
.stat-val.green { color: var(--green); }
.download-btn { width: 100%; padding: 12px; border: 1.5px solid var(--green); color: var(--green); background: transparent; border-radius: 10px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
.download-btn:hover { background: rgba(79,255,176,0.08); }

/* FFmpeg status */
.ffmpeg-status { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
.ffmpeg-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
.ffmpeg-dot.loading { background: var(--accent); animation: pulse 1s infinite; }
.ffmpeg-dot.ready { background: var(--green); }
.ffmpeg-dot.error { background: var(--red); }

/* Info boxes */
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 28px; }
.info-box { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
.info-box-icon { font-size: 18px; margin-bottom: 6px; }
.info-box-title { font-size: 12px; font-weight: 700; margin-bottom: 3px; }
.info-box-desc { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); line-height: 1.6; }

/* Interpolation specific */
.interp-info { background: rgba(126,184,255,0.04); border: 1px solid rgba(126,184,255,0.15); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
.interp-info p { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); line-height: 1.7; }
.interp-info p span { color: var(--blue); }

/* Trial counter */
.trial-counter { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
.trial-counter .label { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); }
.trial-counter .count { font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; }
.trial-counter .count.warn { color: var(--red); }
.trial-counter .count.ok { color: var(--green); }

.checkbox-list { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; text-align: left; }
.check-item { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.check-item input[type="checkbox"] { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; accent-color: var(--accent); cursor: pointer; }
.check-item span { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); line-height: 1.5; }
.check-item:has(input:checked) span { color: var(--text); }
.unlock-btn:not(:disabled) { opacity: 1 !important; }

/* ── History ────────────────────────────────────────────────── */
.history-section { margin-top: 36px; }
.history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.history-title { font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.history-title .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.history-clear { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: color 0.2s; }
.history-clear:hover { color: var(--red); }
.history-empty { text-align: center; padding: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted); }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 16px; transition: border-color 0.2s;
}
.history-item:hover { border-color: var(--border2); }
.history-item-icon { font-size: 20px; flex-shrink: 0; }
.history-item-info { flex: 1; min-width: 0; }
.history-item-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
.history-item-meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 8px; }
.history-item-meta span { display: flex; align-items: center; gap: 3px; }
.history-item-type { font-family: 'DM Mono', monospace; font-size: 10px; padding: 2px 7px; border-radius: 4px; flex-shrink: 0; }
.history-item-type.patch  { background: rgba(232,255,71,0.1);  color: var(--accent); border: 1px solid rgba(232,255,71,0.2); }
.history-item-type.convert { background: rgba(126,184,255,0.1); color: var(--blue);   border: 1px solid rgba(126,184,255,0.2); }
.history-item-type.interp  { background: rgba(79,255,176,0.1);  color: var(--green);  border: 1px solid rgba(79,255,176,0.2); }
.history-ttl { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); flex-shrink: 0; }
.history-ttl.soon { color: var(--red); }
.history-settings { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.ttl-select { background: var(--surface2); border: 1px solid var(--border2); border-radius: 8px; padding: 6px 10px; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); outline: none; cursor: pointer; }

footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); flex-wrap: wrap; gap: 6px; }
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="logo">
    <div class="logo-mark">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12M8 2v12" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="8" cy="8" r="3" fill="#0a0a0a"/>
      </svg>
    </div>
    <span class="logo-text">NoBlur</span>
  </div>

  <h1>Video suite.<br><span>Zero server.</span></h1>
  <p class="subtitle">Patch metadata · Convert resolusi · Interpolasi 60fps — semua di browser kamu, tanpa upload ke server.</p>
  <div class="badges">
    <span class="badge green">✓ Client-side</span>
    <span class="badge green">✓ No upload</span>
    <span class="badge yellow">Free: Patch</span>
    <span class="badge blue">Pro: Convert + Interpolasi</span>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" onclick="switchTab('patch')">
      🔧 Patch
    </button>
    <button class="tab" id="tab-convert" onclick="switchTab('convert')">
      ⚡ Convert <span class="lock-icon" id="lock-convert">🔒</span>
    </button>
    <button class="tab" id="tab-interp" onclick="switchTab('interp')">
      🎞️ Interpolasi <span class="lock-icon" id="lock-interp">🔒</span>
    </button>
  </div>

  <!-- ═══════════════════════════════════════════════════
       PANEL 1: PATCH (FREE)
  ═══════════════════════════════════════════════════ -->
  <div class="panel active" id="panel-patch">

    <div class="dropzone" id="patch-dropzone">
      <input type="file" id="patch-file-input" accept=".mp4,.mov,video/mp4,video/quicktime">
      <div class="drop-icon">🎬</div>
      <div class="drop-title">Pilih atau seret video</div>
      <div class="drop-sub">MP4 · MOV · gratis · tanpa batas</div>
    </div>

    <div class="file-card" id="patch-file-card">
      <div class="file-thumb">🎞️</div>
      <div style="flex:1;min-width:0">
        <div class="file-meta-name" id="patch-file-name">—</div>
        <div class="file-meta-sub" id="patch-file-meta">—</div>
      </div>
      <button class="file-remove" onclick="removePatchFile()">✕</button>
    </div>

    <div class="opts-card">
      <div class="opts-title">Patch Options</div>
      <div class="opt-row">
        <div>
          <div class="opt-label">Pass 1 — Edit List Injection</div>
          <div class="opt-desc">Inject edts/elst · fix sinkronisasi A/V</div>
        </div>
        <label class="toggle"><input type="checkbox" id="opt-elst" checked><span class="toggle-track"></span></label>
      </div>
      <div class="opt-row">
        <div>
          <div class="opt-label">Pass 2 — Display Matrix Patch</div>
          <div class="opt-desc">Set matrix_b = 1 di mvhd</div>
        </div>
        <label class="toggle"><input type="checkbox" id="opt-matrix" checked><span class="toggle-track"></span></label>
      </div>
      <div class="opt-row">
        <div>
          <div class="opt-label">Recalculate chunk offsets</div>
          <div class="opt-desc">Auto-fix stco/co64 setelah injeksi</div>
        </div>
        <label class="toggle"><input type="checkbox" id="opt-offset" checked><span class="toggle-track"></span></label>
      </div>
    </div>

    <button class="primary-btn" id="patch-btn" disabled onclick="runPatch()">
      ⚡ Patch Video
    </button>

    <div class="log-card" id="patch-log">
      <div class="log-header">
        <div class="log-dot" id="patch-dot"></div>
        <span class="log-status" id="patch-status-text">idle</span>
      </div>
      <div class="log-body" id="patch-log-body"></div>
    </div>

    <div class="result-card" id="patch-result">
      <div class="result-title">✓ Patch selesai</div>
      <div class="result-stats">
        <div class="stat"><div class="stat-label">Ukuran</div><div class="stat-val" id="pr-size">—</div></div>
        <div class="stat"><div class="stat-label">Modifikasi</div><div class="stat-val green" id="pr-mods">—</div></div>
        <div class="stat"><div class="stat-label">elst</div><div class="stat-val green" id="pr-elst">—</div></div>
        <div class="stat"><div class="stat-label">matrix_b</div><div class="stat-val green" id="pr-matrix">—</div></div>
      </div>
      <button class="download-btn" id="patch-download-btn">↓ Download hasil patch</button>
    </div>

    <div class="info-grid">
      <div class="info-box"><div class="info-box-icon">🔒</div><div class="info-box-title">Privasi total</div><div class="info-box-desc">File tidak pernah meninggalkan browser kamu.</div></div>
      <div class="info-box"><div class="info-box-icon">⚡</div><div class="info-box-title">Instan</div><div class="info-box-desc">Tidak ada upload, proses selesai dalam detik.</div></div>
      <div class="info-box"><div class="info-box-icon">🎯</div><div class="info-box-title">Non-destructive</div><div class="info-box-desc">Hanya metadata container yang dimodifikasi.</div></div>
      <div class="info-box"><div class="info-box-icon">📦</div><div class="info-box-title">Zero install</div><div class="info-box-desc">Buka browser, langsung pakai.</div></div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════
       PANEL 2: CONVERT (PRO)
  ═══════════════════════════════════════════════════ -->
  <div class="panel" id="panel-convert">

    <div id="convert-gate">
      <div class="license-gate">
        <div class="gate-icon">⚡</div>
        <h3>Aktifkan Video Converter</h3>
        <p>FFmpeg.wasm berjalan langsung di browser kamu. File tidak pernah dikirim ke server manapun. Centang persetujuan di bawah untuk mengaktifkan fitur ini.</p>
        <div class="checkbox-list">
          <label class="check-item">
            <input type="checkbox" id="convert-check1" onchange="checkConvertReady()">
            <span>Saya mengerti proses berjalan di browser saya sendiri</span>
          </label>
          <label class="check-item">
            <input type="checkbox" id="convert-check2" onchange="checkConvertReady()">
            <span>Saya mengerti file besar mungkin butuh waktu lebih lama</span>
          </label>
          <label class="check-item">
            <input type="checkbox" id="convert-check3" onchange="checkConvertReady()">
            <span>Saya setuju menggunakan fitur ini untuk keperluan pribadi</span>
          </label>
        </div>
        <button class="unlock-btn" id="convert-agree-btn" disabled onclick="unlockFeature('convert')" style="width:100%;margin-top:16px;opacity:0.4">
          Aktifkan Converter
        </button>
      </div>
    </div>

    <div id="convert-content" style="display:none">
      <div class="user-badge">
        <span>✓</span>
        <div class="plan">
          <div class="plan-name" id="convert-plan-name">Pro Unlocked</div>
          <div class="plan-detail" id="convert-plan-detail">FFmpeg.wasm · Convert & Resize</div>
        </div>
        <button class="logout" onclick="lockFeature('convert')">Revoke</button>
      </div>

      <div class="trial-counter" id="convert-trial-counter" style="display:none">
        <span class="label">Trial tersisa</span>
        <span class="count ok" id="convert-trial-count">3 percobaan</span>
      </div>

      <div class="ffmpeg-status" id="convert-ffmpeg-status">
        <div class="ffmpeg-dot loading" id="convert-ffmpeg-dot"></div>
        <span id="convert-ffmpeg-text">Memuat FFmpeg.wasm...</span>
      </div>

      <div class="dropzone" id="convert-dropzone">
        <input type="file" id="convert-file-input" accept="video/*">
        <div class="drop-icon">🎬</div>
        <div class="drop-title">Pilih atau seret video</div>
        <div class="drop-sub">MP4 · MOV · AVI · MKV · WEBM</div>
      </div>

      <div class="file-card" id="convert-file-card">
        <div class="file-thumb">🎞️</div>
        <div style="flex:1;min-width:0">
          <div class="file-meta-name" id="convert-file-name">—</div>
          <div class="file-meta-sub" id="convert-file-meta">—</div>
        </div>
        <button class="file-remove" onclick="removeConvertFile()">✕</button>
      </div>

      <div class="settings-grid">
        <div class="setting-card">
          <div class="setting-label">Resolusi</div>
          <select class="setting-select" id="conv-res">
            <option value="1920:1080">1080p FHD</option>
            <option value="2560:1440">1440p QHD</option>
            <option value="3840:2160">4K UHD</option>
            <option value="1280:720">720p HD</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Frame Rate</div>
          <select class="setting-select" id="conv-fps">
            <option value="60">60 fps</option>
            <option value="30">30 fps</option>
            <option value="24">24 fps</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Bitrate</div>
          <select class="setting-select" id="conv-bitrate">
            <option value="25M">25 Mbps</option>
            <option value="50M">50 Mbps</option>
            <option value="10M">10 Mbps</option>
            <option value="100M">100 Mbps</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Codec</div>
          <select class="setting-select" id="conv-codec">
            <option value="libx264">H.264 (AVC)</option>
            <option value="libx265">H.265 (HEVC)</option>
          </select>
        </div>
      </div>

      <button class="primary-btn" id="convert-btn" disabled onclick="runConvert()">⚡ Convert Video</button>

      <div class="progress-wrap" id="convert-progress" style="display:none">
        <div class="progress-bar-bg"><div class="progress-bar-fill" id="convert-progress-fill"></div></div>
        <div class="progress-label" id="convert-progress-label">Memproses...</div>
      </div>

      <div class="log-card" id="convert-log">
        <div class="log-header">
          <div class="log-dot" id="convert-dot"></div>
          <span class="log-status" id="convert-status-text">idle</span>
        </div>
        <div class="log-body" id="convert-log-body"></div>
      </div>

      <div class="result-card" id="convert-result">
        <div class="result-title">✓ Konversi selesai</div>
        <div class="result-stats">
          <div class="stat"><div class="stat-label">Output size</div><div class="stat-val" id="cr-size">—</div></div>
          <div class="stat"><div class="stat-label">Resolusi</div><div class="stat-val green" id="cr-res">—</div></div>
          <div class="stat"><div class="stat-label">FPS</div><div class="stat-val green" id="cr-fps">—</div></div>
          <div class="stat"><div class="stat-label">Codec</div><div class="stat-val" id="cr-codec">—</div></div>
        </div>
        <button class="download-btn" id="convert-download-btn">↓ Download hasil convert</button>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════
       PANEL 3: INTERPOLASI (PRO)
  ═══════════════════════════════════════════════════ -->
  <div class="panel" id="panel-interp">

    <div id="interp-gate">
      <div class="license-gate">
        <div class="gate-icon">🎞️</div>
        <h3>Aktifkan Frame Interpolation</h3>
        <p>Tingkatkan framerate video dari 24/30fps ke 60fps menggunakan FFmpeg minterpolate langsung di browser. Centang persetujuan untuk mengaktifkan.</p>
        <div class="checkbox-list">
          <label class="check-item">
            <input type="checkbox" id="interp-check1" onchange="checkInterpReady()">
            <span>Saya mengerti interpolasi lebih lambat dari convert biasa</span>
          </label>
          <label class="check-item">
            <input type="checkbox" id="interp-check2" onchange="checkInterpReady()">
            <span>Saya disarankan pakai video maks 100MB untuk hasil optimal</span>
          </label>
          <label class="check-item">
            <input type="checkbox" id="interp-check3" onchange="checkInterpReady()">
            <span>Saya setuju menggunakan fitur ini untuk keperluan pribadi</span>
          </label>
        </div>
        <button class="unlock-btn" id="interp-agree-btn" disabled onclick="unlockFeature('interp')" style="width:100%;margin-top:16px;opacity:0.4">
          Aktifkan Interpolasi
        </button>
      </div>
    </div>

    <div id="interp-content" style="display:none">
      <div class="user-badge">
        <span>✓</span>
        <div class="plan">
          <div class="plan-name" id="interp-plan-name">Pro Unlocked</div>
          <div class="plan-detail">FFmpeg minterpolate · 60fps</div>
        </div>
        <button class="logout" onclick="lockFeature('interp')">Revoke</button>
      </div>

      <div class="trial-counter" id="interp-trial-counter" style="display:none">
        <span class="label">Trial tersisa</span>
        <span class="count ok" id="interp-trial-count">2 percobaan</span>
      </div>

      <div class="interp-info">
        <p>Algoritma <span>minterpolate</span> menganalisis gerakan antar frame dan menghasilkan frame baru di antara keduanya. Cocok untuk video cinematic yang ingin terlihat lebih halus. <span>Proses lebih lama dari convert biasa.</span></p>
      </div>

      <div class="ffmpeg-status" id="interp-ffmpeg-status">
        <div class="ffmpeg-dot loading" id="interp-ffmpeg-dot"></div>
        <span id="interp-ffmpeg-text">Memuat FFmpeg.wasm...</span>
      </div>

      <div class="dropzone" id="interp-dropzone">
        <input type="file" id="interp-file-input" accept="video/mp4,video/quicktime,.mp4,.mov">
        <div class="drop-icon">🎬</div>
        <div class="drop-title">Pilih video untuk interpolasi</div>
        <div class="drop-sub">MP4 · MOV · disarankan maks 100MB</div>
      </div>

      <div class="file-card" id="interp-file-card">
        <div class="file-thumb">🎞️</div>
        <div style="flex:1;min-width:0">
          <div class="file-meta-name" id="interp-file-name">—</div>
          <div class="file-meta-sub" id="interp-file-meta">—</div>
        </div>
        <button class="file-remove" onclick="removeInterpFile()">✕</button>
      </div>

      <div class="settings-grid">
        <div class="setting-card">
          <div class="setting-label">Target FPS</div>
          <select class="setting-select" id="interp-fps">
            <option value="60">60 fps</option>
            <option value="120">120 fps</option>
            <option value="48">48 fps</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Mode</div>
          <select class="setting-select" id="interp-mode">
            <option value="mci">MCI (terbaik)</option>
            <option value="blend">Blend</option>
            <option value="dup">Duplicate</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Resolusi output</div>
          <select class="setting-select" id="interp-res">
            <option value="">Sama dengan input</option>
            <option value="1920:1080">1080p</option>
            <option value="1280:720">720p</option>
          </select>
        </div>
        <div class="setting-card">
          <div class="setting-label">Bitrate</div>
          <select class="setting-select" id="interp-bitrate">
            <option value="25M">25 Mbps</option>
            <option value="50M">50 Mbps</option>
            <option value="10M">10 Mbps</option>
          </select>
        </div>
      </div>

      <button class="primary-btn" id="interp-btn" disabled onclick="runInterp()">🎞️ Mulai Interpolasi</button>

      <div class="progress-wrap" id="interp-progress" style="display:none">
        <div class="progress-bar-bg"><div class="progress-bar-fill" id="interp-progress-fill"></div></div>
        <div class="progress-label" id="interp-progress-label">Memproses...</div>
      </div>

      <div class="log-card" id="interp-log">
        <div class="log-header">
          <div class="log-dot" id="interp-dot"></div>
          <span class="log-status" id="interp-status-text">idle</span>
        </div>
        <div class="log-body" id="interp-log-body"></div>
      </div>

      <div class="result-card" id="interp-result">
        <div class="result-title">✓ Interpolasi selesai</div>
        <div class="result-stats">
          <div class="stat"><div class="stat-label">Output size</div><div class="stat-val" id="ir-size">—</div></div>
          <div class="stat"><div class="stat-label">Target FPS</div><div class="stat-val green" id="ir-fps">—</div></div>
          <div class="stat"><div class="stat-label">Mode</div><div class="stat-val" id="ir-mode">—</div></div>
          <div class="stat"><div class="stat-label">Status</div><div class="stat-val green">✓ Done</div></div>
        </div>
        <button class="download-btn" id="interp-download-btn">↓ Download hasil interpolasi</button>
      </div>
    </div>
  </div>


  <!-- ═══════════════════════════════════════════════════
       HISTORY SECTION
  ═══════════════════════════════════════════════════ -->
  <div class="history-section">
    <div class="history-header">
      <div class="history-title">
        <div class="dot"></div>
        Riwayat Proses
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <select class="ttl-select" id="ttl-select" onchange="updateTTL()">
          <option value="1">Hapus setelah 1 jam</option>
          <option value="3" selected>Hapus setelah 3 jam</option>
          <option value="6">Hapus setelah 6 jam</option>
          <option value="12">Hapus setelah 12 jam</option>
          <option value="24">Hapus setelah 24 jam</option>
        </select>
        <button class="history-clear" onclick="clearHistory()">Hapus semua</button>
      </div>
    </div>
    <div id="history-list"></div>
  </div>

  <footer>
    <span>NoBlur v2.0 — client-side video suite</span>
    <span>no server · no tracking · FFmpeg.wasm</span>
  </footer>
</div>

<script>
// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
const VALID_KEYS = ['NOBLUR-PRO1-2024-ABCD', 'NOBLUR-PRO2-2024-EFGH', 'NOBLUR-DEMO-TEST-0000']
const STORAGE_KEY = 'noblur_license'
const TRIAL_KEY   = 'noblur_trials'

// Load dari localStorage
let license = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
let trials  = JSON.parse(localStorage.getItem(TRIAL_KEY)   || '{"convert":3,"interp":2}')

// FFmpeg instances
let ffmpegConvert = null
let ffmpegInterp  = null

// File state
let patchFile   = null
let convertFile = null
let interpFile  = null

// Blob URLs
let patchBlob   = null
let convertBlob = null
let interpBlob  = null

// ═══════════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById('panel-' + tab).classList.add('active')
  event.currentTarget.classList.add('active')
}

// ═══════════════════════════════════════════════════════════════
//  LICENSE / VALIDATION
// ═══════════════════════════════════════════════════════════════
function formatKey(inputId) {
  const input = document.getElementById(inputId)
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const parts = []
  for (let i = 0; i < val.length && i < 20; i += 5) {
    parts.push(val.slice(i, i + 5))
  }
  input.value = parts.join('-')
}

function saveLicense() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(license))
}
function saveTrials() {
  localStorage.setItem(TRIAL_KEY, JSON.stringify(trials))
}

function unlockFeature(feature) {
  const key = document.getElementById(feature + '-key').value.trim()
  const msgEl = document.getElementById(feature + '-key-msg')

  if (!VALID_KEYS.includes(key)) {
    msgEl.className = 'license-error'
    msgEl.textContent = '✕ Key tidak valid. Periksa kembali atau gunakan trial.'
    document.getElementById(feature + '-key').classList.add('error')
    return
  }

  license[feature] = { key, type: 'pro', unlockedAt: Date.now() }
  saveLicense()

  msgEl.className = 'license-success'
  msgEl.textContent = '✓ Key valid! Mengaktifkan fitur...'
  document.getElementById(feature + '-key').classList.add('success')

  setTimeout(() => showFeatureContent(feature, 'pro'), 800)
}

function useTrial(feature) {
  if (trials[feature] <= 0) {
    alert('Trial habis. Masukkan license key untuk akses penuh.')
    return
  }
  trials[feature]--
  saveTrials()
  license[feature] = { type: 'trial' }
  showFeatureContent(feature, 'trial')
}

function showFeatureContent(feature, type) {
  document.getElementById(feature + '-gate').style.display = 'none'
  document.getElementById(feature + '-content').style.display = 'block'

  const planName = document.getElementById(feature + '-plan-name')
  const trialCounter = document.getElementById(feature + '-trial-counter')
  const trialCount   = document.getElementById(feature + '-trial-count')
  const trialLeft    = document.getElementById(feature + '-trial-left')

  if (type === 'trial') {
    planName.textContent = 'Trial Mode'
    planName.style.color = 'var(--accent)'
    trialCounter.style.display = 'flex'
    const left = trials[feature]
    trialCount.textContent = left + ' percobaan'
    trialCount.className = 'count ' + (left <= 1 ? 'warn' : 'ok')
    if (trialLeft) trialLeft.textContent = left
  }

  // Update lock icon on tab
  document.getElementById('lock-' + feature).textContent = '✓'
  document.getElementById('lock-' + feature).style.color = 'var(--green)'

  // Load FFmpeg for this feature
  if (feature === 'convert' && !ffmpegConvert) loadFFmpeg('convert')
  if (feature === 'interp'  && !ffmpegInterp)  loadFFmpeg('interp')
}

function lockFeature(feature) {
  delete license[feature]
  saveLicense()
  document.getElementById(feature + '-gate').style.display = 'block'
  document.getElementById(feature + '-content').style.display = 'none'
  document.getElementById('lock-' + feature).textContent = '🔒'
  document.getElementById('lock-' + feature).style.color = ''
}

// Auto-restore license on load
window.addEventListener('load', () => {
  if (license.convert) showFeatureContent('convert', license.convert.type)
  if (license.interp)  showFeatureContent('interp',  license.interp.type)
  // Update trial left display
  document.getElementById('convert-trial-left').textContent = trials.convert
  document.getElementById('interp-trial-left').textContent  = trials.interp
})

// ═══════════════════════════════════════════════════════════════
//  FFMPEG LOADER
// ═══════════════════════════════════════════════════════════════
async function loadFFmpeg(feature) {
  const dotEl  = document.getElementById(feature + '-ffmpeg-dot')
  const textEl = document.getElementById(feature + '-ffmpeg-text')

  try {
    dotEl.className  = 'ffmpeg-dot loading'
    textEl.textContent = 'Memuat FFmpeg.wasm...'

    const { FFmpeg }    = FFmpegWASM
    const { toBlobURL } = FFmpegUtil

    const ff = new FFmpeg()
    ff.on('log', ({ message }) => {
      if (feature === 'convert' && convertFile) addConvertLog(message, 'info')
      if (feature === 'interp'  && interpFile)  addInterpLog(message, 'info')
    })
    ff.on('progress', ({ progress: p }) => {
      const pct = Math.round(p * 100)
      if (feature === 'convert') updateProgress('convert', pct)
      if (feature === 'interp')  updateProgress('interp', pct)
    })

    // core-mt = multi-thread, include minterpolate & semua filter FFmpeg
    const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd'
    await ff.load({
      coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,        'text/javascript'),
      wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`,      'application/wasm'),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    })

    if (feature === 'convert') {
      ffmpegConvert = ff
      if (convertFile) document.getElementById('convert-btn').disabled = false
    } else {
      ffmpegInterp = ff
      if (interpFile) document.getElementById('interp-btn').disabled = false
    }

    dotEl.className    = 'ffmpeg-dot ready'
    textEl.textContent = 'FFmpeg.wasm siap ✓'

  } catch (err) {
    dotEl.className    = 'ffmpeg-dot error'
    textEl.textContent = 'Gagal load FFmpeg: ' + err.message
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const fmtMB = b => (b / 1024 / 1024).toFixed(2) + ' MB'

function updateProgress(feature, pct) {
  const fill  = document.getElementById(feature + '-progress-fill')
  const label = document.getElementById(feature + '-progress-label')
  if (fill)  fill.style.width = pct + '%'
  if (label) label.textContent = 'Memproses... ' + pct + '%'
}

function addLog(bodyId, msg, cls = '') {
  const body = document.getElementById(bodyId)
  if (!body) return
  const div = document.createElement('div')
  div.className = 'log-line ' + cls
  div.textContent = msg
  body.appendChild(div)
  body.scrollTop = body.scrollHeight
}
const addPatchLog   = (m, c) => addLog('patch-log-body',   m, c)
const addConvertLog = (m, c) => addLog('convert-log-body', m, c)
const addInterpLog  = (m, c) => addLog('interp-log-body',  m, c)

function setLogState(feature, state) {
  const dot = document.getElementById(feature + '-dot')
  const txt = document.getElementById(feature + '-status-text')
  document.getElementById(feature + '-log').classList.add('show')
  if (state === 'processing') { dot.className = 'log-dot pulse'; txt.textContent = 'processing' }
  if (state === 'done')       { dot.className = 'log-dot done';  txt.textContent = 'done' }
  if (state === 'error')      { dot.className = 'log-dot err';   txt.textContent = 'error' }
}

// ═══════════════════════════════════════════════════════════════
//  PATCH — FILE HANDLING
// ═══════════════════════════════════════════════════════════════
function setupDropzone(dropId, inputId, onFile) {
  const drop  = document.getElementById(dropId)
  const input = document.getElementById(inputId)
  drop.addEventListener('click', () => input.click())
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag') })
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'))
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); onFile(e.dataTransfer.files[0]) })
  input.addEventListener('change', e => onFile(e.target.files[0]))
}

function showFileCard(cardId, nameId, metaId, file) {
  document.getElementById(cardId).classList.add('show')
  document.getElementById(nameId).textContent = file.name
  document.getElementById(metaId).textContent = fmtMB(file.size) + ' · ' + file.name.split('.').pop().toUpperCase()
}

setupDropzone('patch-dropzone', 'patch-file-input', f => {
  if (!f) return
  patchFile = f
  showFileCard('patch-file-card', 'patch-file-name', 'patch-file-meta', f)
  document.getElementById('patch-dropzone').style.display = 'none'
  document.getElementById('patch-btn').disabled = false
  document.getElementById('patch-log').classList.remove('show')
  document.getElementById('patch-result').classList.remove('show')
})

setupDropzone('convert-dropzone', 'convert-file-input', f => {
  if (!f) return
  convertFile = f
  showFileCard('convert-file-card', 'convert-file-name', 'convert-file-meta', f)
  document.getElementById('convert-dropzone').style.display = 'none'
  if (ffmpegConvert) document.getElementById('convert-btn').disabled = false
})

setupDropzone('interp-dropzone', 'interp-file-input', f => {
  if (!f) return
  interpFile = f
  showFileCard('interp-file-card', 'interp-file-name', 'interp-file-meta', f)
  document.getElementById('interp-dropzone').style.display = 'none'
  if (ffmpegInterp) document.getElementById('interp-btn').disabled = false
})

function removePatchFile() {
  patchFile = null; patchBlob = null
  document.getElementById('patch-file-card').classList.remove('show')
  document.getElementById('patch-dropzone').style.display = ''
  document.getElementById('patch-btn').disabled = true
  document.getElementById('patch-result').classList.remove('show')
}
function removeConvertFile() {
  convertFile = null; convertBlob = null
  document.getElementById('convert-file-card').classList.remove('show')
  document.getElementById('convert-dropzone').style.display = ''
  document.getElementById('convert-btn').disabled = true
  document.getElementById('convert-result').classList.remove('show')
}
function removeInterpFile() {
  interpFile = null; interpBlob = null
  document.getElementById('interp-file-card').classList.remove('show')
  document.getElementById('interp-dropzone').style.display = ''
  document.getElementById('interp-btn').disabled = true
  document.getElementById('interp-result').classList.remove('show')
}

// ═══════════════════════════════════════════════════════════════
//  PATCH CORE
// ═══════════════════════════════════════════════════════════════
function parseAtoms(data, start, end) {
  const atoms = [], view = new DataView(data.buffer, data.byteOffset)
  let pos = start
  while (pos < end - 8) {
    const size = view.getUint32(pos, false)
    if (size < 8 || pos + size > end + 8) break
    const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
    if (/^[a-zA-Z0-9©\-_]{4}$/.test(type)) atoms.push({ type, offset: pos, size })
    pos += size
  }
  return atoms
}

function buildEdtsAtom(duration) {
  const buf = new ArrayBuffer(36), v = new DataView(buf), u = new Uint8Array(buf)
  v.setUint32(0, 36, false); u[4]=0x65;u[5]=0x64;u[6]=0x74;u[7]=0x73
  v.setUint32(8, 28, false); u[12]=0x65;u[13]=0x6c;u[14]=0x73;u[15]=0x74
  v.setUint32(16, 0, false); v.setUint32(20, 1, false)
  v.setUint32(24, duration >>> 0, false); v.setInt32(28, 0, false)
  v.setInt16(32, 1, false); v.setInt16(34, 0, false)
  return buf
}

function insertBytes(data, offset, insert) {
  const out = new Uint8Array(data.length + insert.length)
  out.set(data.subarray(0, offset), 0); out.set(insert, offset); out.set(data.subarray(offset), offset + insert.length)
  return out
}

function updateAncestorSizes(data, insertOffset, addedBytes) {
  const view = new DataView(data.buffer, data.byteOffset)
  let pos = 0
  while (pos < data.length - 8) {
    const size = view.getUint32(pos, false); if (size < 8) break
    const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
    if (insertOffset > pos && insertOffset <= pos + size) {
      view.setUint32(pos, size + addedBytes, false)
      if (['moov','trak'].includes(type)) {
        let cp = pos + 8
        while (cp < pos + size) {
          const cs = view.getUint32(cp, false); if (cs < 8) break
          if (insertOffset > cp && insertOffset <= cp + cs) view.setUint32(cp, cs + addedBytes, false)
          cp += cs
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
      const size = view.getUint32(pos, false); if (size < 8 || pos + size > end + 8) break
      const type = String.fromCharCode(data[pos+4], data[pos+5], data[pos+6], data[pos+7])
      if (type === 'stco') {
        const count = view.getUint32(pos + 12, false)
        for (let i = 0; i < count; i++) { const p = pos+16+i*4; const o = view.getUint32(p, false); if (o >= insertOffset) view.setUint32(p, o + addedBytes, false) }
      } else if (type === 'co64') {
        const count = view.getUint32(pos + 12, false)
        for (let i = 0; i < count; i++) { const p = pos+16+i*8; const hi = view.getUint32(p, false); const lo = view.getUint32(p+4, false); const o = hi*0x100000000+lo; if (o >= insertOffset) { const n = o+addedBytes; view.setUint32(p, Math.floor(n/0x100000000), false); view.setUint32(p+4, n>>>0, false) } }
      } else if (['moov','trak','mdia','minf','stbl'].includes(type)) { scan(pos+8, pos+size) }
      pos += size
    }
  }
  scan(0, data.length)
}

async function runPatch() {
  if (!patchFile) return
  const btn = document.getElementById('patch-btn')
  btn.disabled = true
  document.getElementById('patch-log-body').innerHTML = ''
  document.getElementById('patch-result').classList.remove('show')
  setLogState('patch', 'processing')

  try {
    const buf  = await patchFile.arrayBuffer()
    const opts = {
      doElst:   document.getElementById('opt-elst').checked,
      doMatrix: document.getElementById('opt-matrix').checked,
      doOffset: document.getElementById('opt-offset').checked,
    }

    addPatchLog('[init] membaca file: ' + fmtMB(buf.byteLength), 'info')
    await new Promise(r => setTimeout(r, 0))

    let data = new Uint8Array(buf.slice(0))
    let mods = 0, elstInjected = false, matrixPatched = false

    const topAtoms = parseAtoms(data, 0, data.length)
    topAtoms.forEach(a => addPatchLog('  → ' + a.type + '  offset=' + a.offset, 'info'))

    const moovAtom = topAtoms.find(a => a.type === 'moov')
    if (!moovAtom) throw new Error('Atom moov tidak ditemukan')
    addPatchLog('[moov] ditemukan di offset ' + moovAtom.offset, 'ok')

    const moovChildren = parseAtoms(data, moovAtom.offset + 8, moovAtom.offset + moovAtom.size)

    // Pass 2: matrix patch
    if (opts.doMatrix) {
      const mvhd = moovChildren.find(a => a.type === 'mvhd')
      if (mvhd) {
        const version = data[mvhd.offset + 8]
        const matrixOff = mvhd.offset + 8 + 4 + (version === 1 ? 28 : 16)
        const bOff = matrixOff + 4
        const view = new DataView(data.buffer, data.byteOffset)
        const cur = view.getInt32(bOff, false)
        addPatchLog('[pass2] mvhd matrix_b = ' + cur, '')
        if (cur === 0) { view.setInt32(bOff, 1, false); matrixPatched = true; mods++; addPatchLog('  matrix_b: 0 → 1 ✓', 'ok') }
        else addPatchLog('  matrix_b sudah = ' + cur + ', skip', 'warn')
      }
    }

    // Pass 1: elst injection
    if (opts.doElst) {
      const trakAtoms = moovChildren.filter(a => a.type === 'trak')
      addPatchLog('[pass1] ' + trakAtoms.length + ' track ditemukan', '')
      const toInject = []
      for (let ti = 0; ti < trakAtoms.length; ti++) {
        const trak = trakAtoms[ti]
        const trakChildren = parseAtoms(data, trak.offset + 8, trak.offset + trak.size)
        if (trakChildren.find(c => c.type === 'edts')) { addPatchLog('  trak[' + ti + '] sudah punya edts, skip', 'warn'); continue }
        const tkhd = trakChildren.find(c => c.type === 'tkhd')
        if (!tkhd) continue
        const tkhdVersion = data[tkhd.offset + 8]
        const v2 = new DataView(data.buffer, data.byteOffset)
        const dur = tkhdVersion === 1 ? v2.getUint32(tkhd.offset + 28, false) * 0x100000000 + v2.getUint32(tkhd.offset + 32, false) : v2.getUint32(tkhd.offset + 24, false)
        toInject.push({ ti, insertAt: trak.offset + 8, dur32: dur > 0xFFFFFFFF ? 0xFFFFFFFF : dur })
      }
      for (let i = toInject.length - 1; i >= 0; i--) {
        const { ti, insertAt, dur32 } = toInject[i]
        const edtsBuf = buildEdtsAtom(dur32)
        data = insertBytes(data, insertAt, new Uint8Array(edtsBuf))
        elstInjected = true; mods++
        if (opts.doOffset) { updateAncestorSizes(data, insertAt, edtsBuf.byteLength); recalcChunkOffsets(data, insertAt, edtsBuf.byteLength) }
        addPatchLog('  trak[' + ti + '] edts/elst injected ✓', 'ok')
      }
    }

    addPatchLog('[done] ' + mods + ' modifikasi selesai ✓', 'ok')
    setLogState('patch', 'done')

    const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.length)], { type: patchFile.type })
    const url  = URL.createObjectURL(blob)
    patchBlob  = { url, name: patchFile.name.replace(/\.(mp4|mov)$/i, '_noblur.$1') }

    document.getElementById('pr-size').textContent   = fmtMB(blob.size)
    document.getElementById('pr-mods').textContent   = mods
    document.getElementById('pr-elst').textContent   = elstInjected ? 'Ya ✓' : 'Tidak perlu'
    document.getElementById('pr-matrix').textContent = matrixPatched ? 'Ya ✓' : 'Tidak perlu'
    document.getElementById('patch-result').classList.add('show')

    // Simpan ke history
    addHistory({ type: 'patch', filename: patchFile.name, outputSize: fmtMB(blob.size), mods })

    document.getElementById('patch-download-btn').onclick = () => {
      const a = document.createElement('a'); a.href = url; a.download = patchBlob.name; a.click()
    }
  } catch (err) {
    addPatchLog('[error] ' + err.message, 'err')
    setLogState('patch', 'error')
  }
  btn.disabled = false
}

// ═══════════════════════════════════════════════════════════════
//  CONVERT CORE — dioptimalkan untuk 1080p 60fps TikTok
// ═══════════════════════════════════════════════════════════════

/**
 * buildOptimalArgs: bangun argumen FFmpeg optimal untuk TikTok
 * - scale lanczos + letterbox agar tidak stretch
 * - fps filter near-round
 * - colorspace BT.709 eksplisit
 * - CRF 18 untuk 1080p+ (visually lossless)
 * - audio loudnorm -14 LUFS (standar TikTok)
 * - tag hvc1/avc1 untuk kompatibilitas Apple/TikTok
 */
function buildOptimalArgs(inName, outName, { res, fps, codec, bitrate }) {
  const [w, h] = res.split(':')
  const isHEVC = codec === 'libx265'
  const crf    = parseInt(h) >= 1080 ? '18' : '20'

  const vf = [
    // Scale dengan lanczos, pertahankan aspect ratio, pad sisanya hitam
    `scale=${w}:${h}:flags=lanczos:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
    // FPS dengan near-round interpolation
    `fps=fps=${fps}:round=near`,
    // Konversi colorspace ke BT.709
    'colorspace=bt709:iall=bt601-6-625:fast=1'
  ].join(',')

  return [
    '-i', inName,
    // Video encode
    '-vf', vf,
    '-c:v', codec,
    '-crf', crf,
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-bufsize', String(parseInt(bitrate) * 2) + 'M',
    '-preset', 'medium',
    '-profile:v', isHEVC ? 'main' : 'high',
    '-level',     isHEVC ? '4.1' : '4.2',
    // Color metadata — wajib agar TikTok tidak salah interpret
    '-colorspace',      'bt709',
    '-color_primaries', 'bt709',
    '-color_trc',       'bt709',
    '-color_range',     'tv',
    '-pix_fmt',         'yuv420p',
    // Audio normalize ke -14 LUFS (standar TikTok)
    '-c:a',  'aac',
    '-b:a',  '192k',
    '-ar',   '44100',
    '-af',   'loudnorm=I=-14:TP=-1:LRA=11',
    // Container
    '-movflags', '+faststart',
    '-tag:v', isHEVC ? 'hvc1' : 'avc1',
    outName
  ]
}

async function runConvert() {
  if (!convertFile || !ffmpegConvert) return
  const btn = document.getElementById('convert-btn')
  btn.disabled = true
  document.getElementById('convert-log-body').innerHTML = ''
  document.getElementById('convert-result').classList.remove('show')
  document.getElementById('convert-progress').style.display = 'block'
  setLogState('convert', 'processing')
  updateProgress('convert', 0)

  const res     = document.getElementById('conv-res').value
  const fps     = document.getElementById('conv-fps').value
  const bitrate = document.getElementById('conv-bitrate').value
  const codec   = document.getElementById('conv-codec').value
  const ext     = convertFile.name.split('.').pop().toLowerCase()
  const inName  = 'input.' + ext
  const outName = convertFile.name.replace(/\.[^.]+$/, '_' + res.replace(':','x') + '_' + fps + 'fps.mp4')

  try {
    addConvertLog('[init] file: ' + fmtMB(convertFile.size), 'info')
    addConvertLog('[init] target: ' + res.replace(':','x') + ' @ ' + fps + 'fps · ' + bitrate + ' · ' + codec, 'info')

    const { fetchFile } = FFmpegUtil
    await ffmpegConvert.writeFile(inName, await fetchFile(convertFile))
    addConvertLog('[ffmpeg] file dimuat ke WASM ✓', 'ok')
    addConvertLog('[opt] scale: lanczos · letterbox · BT.709 · CRF ' + (parseInt(res.split(':')[1]) >= 1080 ? '18' : '20'), '')
    addConvertLog('[opt] audio: AAC 192k · loudnorm -14 LUFS · 44.1kHz', '')
    addConvertLog('[ffmpeg] mulai encode...', '')

    const args = buildOptimalArgs(inName, outName, { res, fps, codec, bitrate })
    await ffmpegConvert.exec(args)

    const data = await ffmpegConvert.readFile(outName)
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const url  = URL.createObjectURL(blob)

    await ffmpegConvert.deleteFile(inName)
    await ffmpegConvert.deleteFile(outName)

    addConvertLog('[done] output: ' + fmtMB(blob.size) + ' ✓', 'ok')
    setLogState('convert', 'done')
    updateProgress('convert', 100)

    document.getElementById('cr-size').textContent  = fmtMB(blob.size)
    document.getElementById('cr-res').textContent   = res.replace(':', 'x')
    document.getElementById('cr-fps').textContent   = fps + ' fps'
    document.getElementById('cr-codec').textContent = codec
    document.getElementById('convert-result').classList.add('show')

    addHistory({ type: 'convert', filename: convertFile.name, outputSize: fmtMB(blob.size), resolution: res.replace(':', 'x'), fps })

    document.getElementById('convert-download-btn').onclick = () => {
      const a = document.createElement('a'); a.href = url; a.download = outName; a.click()
    }
  } catch (err) {
    addConvertLog('[error] ' + err.message, 'err')
    setLogState('convert', 'error')
  }

  btn.disabled = false
  document.getElementById('convert-progress').style.display = 'none'
}

// ═══════════════════════════════════════════════════════════════
//  INTERPOLASI CORE — minterpolate optimal untuk 60fps
// ═══════════════════════════════════════════════════════════════

/**
 * buildInterpArgs: bangun argumen FFmpeg untuk frame interpolation
 * - minterpolate dengan MCI (motion compensated interpolation) terbaik
 * - me_mode: bidir (bidirectional) untuk gerakan lebih akurat
 * - vsbmc=1: variable size block motion compensation
 * - scale output + color correction setelah interpolasi
 * - audio sama seperti convert: AAC loudnorm
 */
function buildInterpArgs(inName, outName, { fps, mode, res, bitrate }) {
  // Filter interpolasi dengan parameter optimal
  const interpFilter = mode === 'mci'
    ? `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
    : mode === 'blend'
    ? `minterpolate=fps=${fps}:mi_mode=blend`
    : `minterpolate=fps=${fps}:mi_mode=dup`

  // Scale output jika dipilih
  const scaleFilter = res
    ? `scale=${res}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${res.replace(':',':(ow-iw)/2:')}:(oh-ih)/2`
    : null

  // Color normalization setelah interpolasi
  const colorFilter = 'colorspace=bt709:iall=bt601-6-625:fast=1'

  const vf = [interpFilter, scaleFilter, colorFilter].filter(Boolean).join(',')

  return [
    '-i', inName,
    '-vf', vf,
    '-c:v', 'libx264',
    '-crf', '18',
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-bufsize', String(parseInt(bitrate) * 2) + 'M',
    '-preset', 'medium',
    '-profile:v', 'high',
    '-level', '4.2',
    '-colorspace',      'bt709',
    '-color_primaries', 'bt709',
    '-color_trc',       'bt709',
    '-color_range',     'tv',
    '-pix_fmt',         'yuv420p',
    '-c:a',  'aac',
    '-b:a',  '192k',
    '-ar',   '44100',
    '-af',   'loudnorm=I=-14:TP=-1:LRA=11',
    '-movflags', '+faststart',
    '-tag:v', 'avc1',
    outName
  ]
}

async function runInterp() {
  if (!interpFile || !ffmpegInterp) return
  const btn = document.getElementById('interp-btn')
  btn.disabled = true
  document.getElementById('interp-log-body').innerHTML = ''
  document.getElementById('interp-result').classList.remove('show')
  document.getElementById('interp-progress').style.display = 'block'
  setLogState('interp', 'processing')
  updateProgress('interp', 0)

  const fps     = document.getElementById('interp-fps').value
  const mode    = document.getElementById('interp-mode').value
  const res     = document.getElementById('interp-res').value
  const bitrate = document.getElementById('interp-bitrate').value
  const ext     = interpFile.name.split('.').pop().toLowerCase()
  const inName  = 'interp_input.' + ext
  const outName = interpFile.name.replace(/\.[^.]+$/, '_' + fps + 'fps_interp.mp4')

  try {
    addInterpLog('[init] file: ' + fmtMB(interpFile.size), 'info')
    addInterpLog('[init] target: ' + fps + 'fps · mode: ' + mode.toUpperCase(), 'info')

    const { fetchFile } = FFmpegUtil
    await ffmpegInterp.writeFile(inName, await fetchFile(interpFile))
    addInterpLog('[ffmpeg] file dimuat ✓', 'ok')

    if (mode === 'mci') {
      addInterpLog('[opt] MCI: motion compensated · bidir · vsbmc=1', '')
      addInterpLog('[opt] mode ini paling akurat tapi paling lambat', 'warn')
    } else if (mode === 'blend') {
      addInterpLog('[opt] Blend: frame blending · lebih cepat dari MCI', '')
    } else {
      addInterpLog('[opt] Duplicate: duplikat frame · tercepat', '')
    }
    addInterpLog('[ffmpeg] mulai interpolasi... (sabar, ini proses berat)', '')

    const args = buildInterpArgs(inName, outName, { fps, mode, res, bitrate })
    await ffmpegInterp.exec(args)

    const data = await ffmpegInterp.readFile(outName)
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const url  = URL.createObjectURL(blob)

    await ffmpegInterp.deleteFile(inName)
    await ffmpegInterp.deleteFile(outName)

    addInterpLog('[done] output: ' + fmtMB(blob.size) + ' ✓', 'ok')
    setLogState('interp', 'done')
    updateProgress('interp', 100)

    document.getElementById('ir-size').textContent = fmtMB(blob.size)
    document.getElementById('ir-fps').textContent  = fps + ' fps'
    document.getElementById('ir-mode').textContent = mode.toUpperCase()
    document.getElementById('interp-result').classList.add('show')

    addHistory({ type: 'interp', filename: interpFile.name, outputSize: fmtMB(blob.size), fps, mode: mode.toUpperCase() })

    document.getElementById('interp-download-btn').onclick = () => {
      const a = document.createElement('a'); a.href = url; a.download = outName; a.click()
    }
  } catch (err) {
    addInterpLog('[error] ' + err.message, 'err')
    setLogState('interp', 'error')
  }

  btn.disabled = false
  document.getElementById('interp-progress').style.display = 'none'
}

// ═══════════════════════════════════════════════════════════════
//  HISTORY — IndexedDB lokal + auto-expire
// ═══════════════════════════════════════════════════════════════
const DB_NAME    = 'noblur_db'
const DB_VERSION = 1
const STORE_NAME = 'history'
let db = null
let TTL_HOURS = 3  // default

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = e => { db = e.target.result; resolve(db) }
    req.onerror   = e => reject(e.target.error)
  })
}

async function addHistory(entry) {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.add({ ...entry, createdAt: Date.now() })
    req.onsuccess = () => { renderHistory(); resolve() }
    req.onerror   = e => reject(e.target.error)
  })
}

async function getAllHistory() {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.getAll()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function deleteHistory(id) {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.delete(id)
    req.onsuccess = () => { renderHistory(); resolve() }
    req.onerror   = e => reject(e.target.error)
  })
}

async function clearHistory() {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.clear()
    req.onsuccess = () => { renderHistory(); resolve() }
    req.onerror   = e => reject(e.target.error)
  })
}

// Auto-expire: hapus entry yang sudah melewati TTL
async function pruneExpired() {
  if (!db) await openDB()
  const all    = await getAllHistory()
  const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000
  const expired = all.filter(e => e.createdAt < cutoff)
  if (expired.length === 0) return

  const tx    = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  expired.forEach(e => store.delete(e.id))
  tx.oncomplete = () => renderHistory()
}

function updateTTL() {
  TTL_HOURS = parseInt(document.getElementById('ttl-select').value)
  pruneExpired()
}

function formatTimeLeft(createdAt) {
  const expireAt  = createdAt + TTL_HOURS * 60 * 60 * 1000
  const remaining = expireAt - Date.now()
  if (remaining <= 0) return { text: 'kedaluwarsa', soon: true }
  const hrs  = Math.floor(remaining / 3600000)
  const mins = Math.floor((remaining % 3600000) / 60000)
  const soon = remaining < 30 * 60 * 1000  // < 30 menit = merah
  if (hrs > 0) return { text: `hapus dalam ${hrs}j ${mins}m`, soon }
  return { text: `hapus dalam ${mins}m`, soon }
}

function typeIcon(type) {
  if (type === 'patch')   return '🔧'
  if (type === 'convert') return '⚡'
  if (type === 'interp')  return '🎞️'
  return '📄'
}

async function renderHistory() {
  await pruneExpired()
  const all  = await getAllHistory()
  const list = document.getElementById('history-list')
  if (!list) return

  if (all.length === 0) {
    list.innerHTML = '<div class="history-empty">Belum ada riwayat proses.</div>'
    return
  }

  // Sort terbaru dulu
  all.sort((a, b) => b.createdAt - a.createdAt)

  list.innerHTML = ''
  const container = document.createElement('div')
  container.className = 'history-list'

  all.forEach(entry => {
    const ttl  = formatTimeLeft(entry.createdAt)
    const date = new Date(entry.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const dateStr = new Date(entry.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

    const item = document.createElement('div')
    item.className = 'history-item'
    item.innerHTML = `
      <div class="history-item-icon">${typeIcon(entry.type)}</div>
      <div class="history-item-info">
        <div class="history-item-name">${entry.filename}</div>
        <div class="history-item-meta">
          <span>📅 ${dateStr} ${date}</span>
          <span>💾 ${entry.outputSize}</span>
          ${entry.resolution ? `<span>📐 ${entry.resolution}</span>` : ''}
          ${entry.fps        ? `<span>🎬 ${entry.fps}fps</span>`      : ''}
          ${entry.mods !== undefined ? `<span>✏️ ${entry.mods} mod</span>` : ''}
        </div>
      </div>
      <span class="history-item-type ${entry.type}">${entry.type}</span>
      <span class="history-ttl ${ttl.soon ? 'soon' : ''}">${ttl.text}</span>
      <button onclick="deleteHistory(${entry.id})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px;flex-shrink:0" title="Hapus">✕</button>
    `
    container.appendChild(item)
  })

  list.appendChild(container)
}

// Jalankan pruning + render tiap 1 menit
async function initHistory() {
  await openDB()
  await renderHistory()
  setInterval(async () => {
    await pruneExpired()
    renderHistory()
  }, 60 * 1000)
}

initHistory()

</script>
</body>
</html>
