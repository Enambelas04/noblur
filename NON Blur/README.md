# NoBlur — Next.js + Docker

## Struktur folder

```
noblur-next/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── app/
    │   ├── globals.css   ← style global
    │   ├── layout.js     ← root layout + metadata
    │   └── page.js       ← halaman utama
    ├── components/
    │   └── Patcher.jsx   ← UI lengkap
    └── lib/
        └── patcher.js    ← logic binary MP4
```

## Cara jalankan (development)

```bash
# 1. Masuk ke folder
cd noblur-next

# 2. Build & jalankan container
docker compose up

# 3. Buka browser
# http://localhost:3000
```

## Kalau tambah package baru

```bash
docker compose exec noblur npm install nama-package
```

## Build production

```bash
docker build -t noblur .
docker run -p 3000:3000 -e NODE_ENV=production noblur
```

## Deploy ke Vercel (alternatif tanpa Docker)

```bash
npm i -g vercel
vercel
```
