/**
 * NoBlur — FFmpeg argument builders
 * Semua strategi encode optimal untuk TikTok ada di sini.
 */

/**
 * buildConvertArgs
 * Strategi optimal untuk TikTok 1080p 60fps:
 * - scale lanczos + letterbox  → tidak stretch, tidak blur
 * - fps near-round             → frame drop/dup akurat
 * - colorspace BT.709 eksplisit → TikTok tidak re-interpret warna
 * - CRF 18 (>=1080p) / 20 (720p) → visually lossless
 * - bufsize 2x bitrate          → buffer cukup untuk scene kompleks
 * - loudnorm -14 LUFS           → standar loudness TikTok
 * - tag hvc1/avc1               → kompatibilitas Apple & TikTok
 */
export function buildConvertArgs(inName, outName, { res, fps, br, codec }) {
  const [w, h] = res.split(':')
  const isHEVC = codec === 'libx265'
  const crf    = parseInt(h) >= 1080 ? '18' : '20'

  // Deteksi orientasi video secara otomatis:
  // - Kalau portrait (misal TikTok 9:16), scale berdasarkan height agar tidak gepeng
  // - force_original_aspect_ratio=decrease → tidak pernah stretch
  // - pad dengan warna hitam jika ada sisa ruang
  const vf = [
    `scale=${w}:${h}:flags=lanczos:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
    `fps=fps=${fps}:round=near`,
    'colorspace=bt709:iall=bt601-6-625:fast=1',
    // Setpiece: pastikan metadata rotasi dihormati
    'setsar=1',
  ].join(',')

  return [
    '-i', inName,
    '-vf', vf,
    '-c:v', codec,
    '-crf', crf,
    '-b:v', `${br}M`, '-maxrate', `${br}M`, '-bufsize', `${Number(br) * 2}M`,
    '-preset', 'medium',
    '-profile:v', isHEVC ? 'main' : 'high',
    '-level',     isHEVC ? '4.1'  : '4.2',
    '-colorspace',      'bt709',
    '-color_primaries', 'bt709',
    '-color_trc',       'bt709',
    '-color_range',     'tv',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11',
    '-movflags', '+faststart',
    '-tag:v', isHEVC ? 'hvc1' : 'avc1',
    outName,
  ]
}

/**
 * buildInterpArgs
 * Strategi optimal untuk frame interpolation 60fps:
 * - MCI + mc_mode=aobmc → adaptive overlapped block MC
 * - me_mode=bidir       → bidirectional motion estimation
 * - vsbmc=1             → variable size block MC
 * - scale setelah interp → lebih akurat
 * - color + loudnorm sama seperti convert
 */
export function buildInterpArgs(inName, outName, { fps, mode, res, br }) {
  const interp = mode === 'mci'
    ? `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
    : mode === 'blend'
    ? `minterpolate=fps=${fps}:mi_mode=blend`
    : `minterpolate=fps=${fps}:mi_mode=dup`

  // Pisah width:height dari res string
  const [rw, rh] = res ? res.split(':') : [null, null]
  const scale = rw && rh
    ? [
        `scale=${rw}:${rh}:flags=lanczos:force_original_aspect_ratio=decrease`,
        `pad=${rw}:${rh}:(ow-iw)/2:(oh-ih)/2:color=black`,
        'setsar=1',
      ].join(',')
    : null

  const vf = [interp, scale, 'colorspace=bt709:iall=bt601-6-625:fast=1']
    .filter(Boolean)
    .join(',')

  return [
    '-i', inName,
    '-vf', vf,
    '-c:v', 'libx264',
    '-crf', '18',
    '-b:v', `${br}M`, '-maxrate', `${br}M`, '-bufsize', `${Number(br) * 2}M`,
    '-preset', 'medium',
    '-profile:v', 'high', '-level', '4.2',
    '-colorspace',      'bt709',
    '-color_primaries', 'bt709',
    '-color_trc',       'bt709',
    '-color_range',     'tv',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-af', 'loudnorm=I=-14:TP=-1:LRA=11',
    '-movflags', '+faststart',
    '-tag:v', 'avc1',
    outName,
  ]
}
