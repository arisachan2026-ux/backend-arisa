# ARISA Cloud Backend

Cloud backend untuk ARISA — sistem pertanian cerdas berbasis IoT yang menghubungkan Raspberry Pi di lapangan dengan aplikasi petani.

Backend ini jadi pusat dari semuanya: identitas user, pairing perangkat, sinkronisasi data edge-to-cloud, AI analysis, dan monitoring. Dibangun pakai NestJS sebagai modular monolith karena di tahap ini microservices itu overkill — tapi strukturnya sudah dipisah per domain supaya gampang di-extract kalau nanti butuh.

## Kenapa Arsitektur Ini

```
  HP Petani ──── JWT ────┐
                         │
                    ARISA Cloud (NestJS)
                         │
  Raspberry Pi ── Token ─┘
                         │
              ┌──────────┴──────────┐
              │  PostgreSQL (Supabase) │
              │  Redis (opsional)      │
              │  OpenRouter AI         │
              └────────────────────────┘
```

Ada tiga kondisi yang harus ditangani:

1. **Online-Online** — App dan Pi sama-sama terhubung ke cloud. Data langsung masuk.
2. **Offline-Online** — User nggak ada internet, tapi Pi tetap kerja. Data ditampung lokal, sync ke cloud begitu koneksi balik.
3. **Offline-Offline** — Semua mati. Pi pakai credential cache yang sudah pernah di-bootstrap. Sync nanti.

Prinsip utamanya: **cloud = sumber kebenaran final.** Pi itu cuma buffer. Tidak boleh ada identitas baru yang lahir tanpa persetujuan cloud.

## Tech Stack

- **NestJS 11** — Framework, TypeScript, dependency injection
- **Prisma 7** — ORM dengan pg driver adapter dan connection pooling
- **PostgreSQL** — Via Supabase (managed), pakai PgBouncer pooler
- **Redis** — Rate limiting dan cache. Opsional — kalau nggak ada, fallback ke in-memory
- **Supabase Auth** — JWT, OAuth Google, session management
- **OpenRouter** — AI gateway ke Gemini Flash (default) dan Claude Haiku (fallback)
- **Docker** — Multi-stage build, non-root user

## Cara Jalankan

```bash
npm install
cp .env.example .env     # isi credentials Supabase + DATABASE_URL
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Swagger ada di `http://localhost:3000/api/docs`.

Kalau mau PostgreSQL + Redis lokal tanpa install manual:
```bash
docker compose up -d
```

## Struktur Modul

Backend ini punya 11 modul yang masing-masing punya controller, service, dan DTO sendiri.

| Modul | Fungsi | Auth |
|-------|--------|------|
| Auth | Register, login, OAuth Google, refresh, logout, revoke-all | Public + JWT |
| User | Profil, update, delete account (soft) | JWT |
| Device | Register device, pairing (QR code), list, revoke, heartbeat | Registration secret / JWT / Device token |
| Sync | Push, batch, ack, pull, **session-summary** | Device token |
| Data | CRUD data inti dengan ownership enforcement | JWT |
| Telemetry | Push telemetry hardware Pi, riwayat | Device token / JWT |
| Notification | List (paginasi + unread count), mark read | JWT |
| AI Gateway | Chat, streaming (SSE), analyze (structured JSON), riwayat | JWT |
| Admin | Dashboard, kelola user/device/roles, logs, session summaries | JWT + RBAC |
| Audit | Logging otomatis untuk aksi sensitif | Internal |
| Health | `GET /health` (liveness), `GET /ready` (readiness probe) | Public |

## Gimana Sync Bekerja

Ini bagian paling kritis. Alur normalnya:

```
Pi dapat data sensor
  → POST /sync/push { requestId, payload }
  → Cloud simpan sebagai SyncJob (PENDING)
  → Proses inline → tulis ke core_data → status SYNCED
  → Pi polling GET /sync/status/:jobId
  → Pi POST /sync/ack → hapus data lokal
```

Kalau Pi offline, data ditampung di SQLite lokal. Begitu internet balik:

```
Pi kumpulkan semua pending records
  → POST /sync/batch { items[] } (max 100 per batch)
  → Cloud deduplikasi pakai requestId (UNIQUE constraint)
  → Duplicate = skip, baru = proses
```

Conflict resolution pakai **Last Write Wins** berdasarkan version number. Kalau cloud punya version lebih tinggi, data cloud yang menang.

## Session Summaries (IoT → AI Context)

Ini fitur yang menghubungkan edge AI di Pi dengan cloud AI:

```
Pi jalankan edge AI → buat ringkasan sesi (suhu, kelembapan, alert, rekomendasi)
  → POST /sync/session-summary
  → Cloud simpan di tabel session_summaries
  → User chat AI → AI Gateway ambil 5 sesi terakhir
  → Injeksi ke system prompt → AI jawab dengan konteks pertanian yang relevan
```

Tanpa endpoint ini, AI chat cuma jawab generik. Dengan session summary, AI bisa bilang "suhu lahan Anda 35°C dalam 2 jam terakhir, pertimbangkan irigasi tambahan."

## AI Gateway

Bukan cuma proxy ke OpenRouter. Ada beberapa mekanisme penting:

- **Rate limiting** — Per user, per menit dan per jam. Pakai Redis kalau ada, in-memory kalau nggak.
- **Model fallback** — Kalau Gemini Flash gagal, otomatis retry pakai Claude Haiku (non-streaming only).
- **Streaming (SSE)** — `POST /ai/chat-stream` kirim token satu-satu via Server-Sent Events.
- **Structured analysis** — `POST /ai/analyze` return JSON terstruktur. Ada response healing kalau JSON-nya rusak.
- **IoT context injection** — 5 session summary terakhir otomatis masuk ke system prompt.
- **Web search** — Pakai OpenRouter server tool `openrouter:web_search`.

## Keamanan

Tiga layer autentikasi:

1. **User (JWT)** — Supabase Auth, Bearer token di header Authorization
2. **Device (Token)** — Header `X-Device-Token` + `X-Device-Serial`, token di-hash pakai bcrypt
3. **RBAC** — Role USER, ADMIN, SUPER_ADMIN via `@Roles()` decorator

Semua response error konsisten:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "userMessage": "Email atau password salah",
    "statusCode": 401
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

`userMessage` itu dalam Bahasa Indonesia — karena end user-nya petani.

## Environment Variables

Yang wajib diisi:

| Variable | Keterangan |
|----------|------------|
| `DATABASE_URL` | Connection string PostgreSQL (pakai pooler port 6543) |
| `DIRECT_URL` | Direct connection untuk migration (port 5432) |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypass RLS) |
| `SUPABASE_JWT_SECRET` | Untuk verifikasi JWT |
| `OPENROUTER_API_KEY` | API key OpenRouter |
| `DEVICE_REGISTRATION_SECRET` | Secret untuk registrasi device (min 20 karakter) |

Yang opsional (ada default):

| Variable | Default | Keterangan |
|----------|---------|------------|
| `REDIS_HOST` | `localhost` | Kalau nggak ada Redis, rate limit pakai in-memory |
| `CORS_ORIGINS` | `''` | Comma-separated domain untuk production |
| `THROTTLE_TTL` | `60` | Window rate limit (detik) |
| `THROTTLE_LIMIT` | `100` | Max request per window |
| `OPENROUTER_DEFAULT_MODEL` | `google/gemini-2.5-flash` | Model AI utama |
| `OPENROUTER_FALLBACK_MODEL` | `anthropic/claude-haiku-4.5` | Fallback kalau model utama gagal |
| `OPENROUTER_MAX_TOKENS` | `8192` | Hard cap token output |

Semua ada di `.env.example`.

## Deploy

### Railway (Rekomendasi)

1. Connect repo
2. Set semua environment variables
3. Railway auto-detect NestJS → `npm run build` → `node dist/main`
4. `postinstall` di package.json otomatis run `prisma generate`
5. Jalankan `npx prisma migrate deploy` via Railway shell untuk setup database

### Docker

```bash
docker build -t arisa-backend .
docker run -p 3000:3000 --env-file .env arisa-backend
```

Dockerfile pakai multi-stage build dan jalan sebagai non-root user `arisa`.

## Dokumentasi Lengkap

Folder `docs/` berisi dokumentasi arsitektur internal:

- `SYSTEM-OVERVIEW.md` — Gambaran besar, 3 mode operasi
- `ARCHITECTURE.md` — Module map, layer architecture, data flow
- `DATABASE-SCHEMA.md` — Prisma models, relasi, indexes
- `SYNC-ENGINE.md` — Idempotency, retry strategy, conflict resolution
- `AUTH-SECURITY.md` — JWT flow, device token, RBAC
- `EDGE-RASPBERRY-PI.md` — Panduan lengkap setup Pi (Python, SQLite, sync client)
- `BUILD-PHASES.md` — Checklist development fase 0-4

Folder `docs/implementation_front/` berisi blueprint integrasi untuk tim frontend — 12 dokumen yang cover setiap endpoint dengan contoh request/response, error codes, dan catatan khusus.

## Scripts

```bash
npm run start:dev       # Development mode (auto-reload)
npm run build           # Compile TypeScript
npm run start:prod      # Jalankan production build
npm run lint            # Cek linting
npm test                # Jalankan tests
npx prisma studio       # GUI database
npx prisma migrate dev  # Buat migration baru
```

## Status

Sistem ini sudah berjalan dan terdokumentasi. Semua endpoint sudah diimplementasi, Swagger docs lengkap. Yang belum:

- [ ] Unit test coverage (saat ini cuma e2e boilerplate)
- [ ] Auto-notification triggers (event-driven)
- [ ] BullMQ untuk async sync processing (saat ini synchronous)
- [ ] Push notification (FCM)
- [ ] WebSocket untuk real-time device status

## Konteks untuk Pengembangan Selanjutnya

Kalau kamu AI assistant atau developer baru yang baca ini, beberapa hal penting:

1. **Prisma pakai driver adapter** (`@prisma/adapter-pg`) dengan `pg` Pool langsung — bukan Prisma default connection. Lihat `prisma.service.ts`.
2. **Redis itu opsional.** `RedisService` punya fallback — kalau connection gagal, sistem tetap jalan tanpa cache.
3. **AI Gateway bukan cuma proxy.** Ada rate limiting, IoT context injection, model fallback, dan response healing. Baca `ai-gateway.service.ts` sebelum modify.
4. **Sync saat ini synchronous** (line 52 di `sync.service.ts`). Rencana awalnya pakai BullMQ, tapi karena Redis opsional, untuk sekarang proses inline. BullMQ bisa ditambahkan tanpa breaking change.
5. **Device auth pakai 2 header:** `X-Device-Token` (raw token, di-compare via bcrypt) dan `X-Device-Serial` (lookup device). Lihat `device-auth.guard.ts`.
6. **Error response punya `userMessage`** dalam Bahasa Indonesia — source of truth ada di `error-messages.ts`.
7. **Session summaries** adalah jembatan antara edge AI dan cloud AI. Tanpa ini, `buildIotContext()` di AI service nggak punya data untuk diinjeksi.

---

Private — UNLICENSED
