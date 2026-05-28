import './globals.css'

export const metadata = {
  title: 'NoBlur — TikTok Video Patcher',
  description: 'Patch MP4/MOV container metadata langsung di browser. Tanpa upload, tanpa server.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
