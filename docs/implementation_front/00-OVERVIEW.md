# ARISA Backend — Frontend Implementation Guide

> **Dokumen ini adalah referensi teknis lengkap untuk integrasi frontend/mobile app dengan ARISA Cloud Backend.**  
> Setiap endpoint, parameter, response, dan error code didokumentasikan secara detail.

---

## Base URL

| Environment | Base URL |
|---|---|
| **Production (Railway)** | `https://<railway-domain>/api/v1` |
| **Local Development** | `http://localhost:3000/api/v1` |
| **Swagger Docs** | `http://localhost:3000/api/docs` |

> **Catatan:** Endpoint `GET /health` dan `GET /ready` berada di root (tanpa prefix `/api/v1`).

---

## Autentikasi

Backend menggunakan **dua jenis autentikasi**:

### 1. User Authentication (JWT — Supabase)

- **Header:** `Authorization: Bearer <supabase_access_token>`
- **Diperoleh dari:** Response endpoint `POST /auth/login`, `POST /auth/register`, atau `POST /auth/oauth/google`
- **Dipakai oleh:** Semua endpoint yang membutuhkan login user (mobile app)
- Token diverifikasi via Supabase Auth → lalu di-lookup ke tabel internal `users`

### 2. Device Authentication (Raspberry Pi)

- **Headers:**
  - `X-Device-Token: <device_raw_token>`
  - `X-Device-Serial: <device_serial_number>`
- **Diperoleh dari:** Response endpoint `POST /devices/register` (hanya dikembalikan SATU KALI)
- **Dipakai oleh:** Endpoint Sync dan Telemetry

---

## Format Response Standard

### ✅ Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-04-30T13:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

> `pagination` hanya ada jika endpoint mengembalikan data paginated.

### ❌ Error Response

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Technical error message (for debugging)",
    "userMessage": "Email atau password salah. Coba lagi.",
    "statusCode": 401
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-04-30T13:00:00.000Z",
    "path": "/api/v1/auth/login"
  }
}
```

---

## Daftar Modul

| # | Modul | Prefix | Auth | Deskripsi |
|---|---|---|---|---|
| 1 | [Auth](./01-AUTH.md) | `/auth` | Public + JWT | Register, Login, OAuth Google, Refresh Token, Logout |
| 2 | [Users](./02-USERS.md) | `/users` | JWT | Profile management |
| 3 | [Devices](./03-DEVICES.md) | `/devices` | Public + JWT + Device | Registrasi, Pairing, List, Detail, Heartbeat |
| 4 | [Data](./04-DATA.md) | `/data` | JWT | CRUD core data records |
| 5 | [AI Gateway](./05-AI-GATEWAY.md) | `/ai` | JWT | Chat, Stream, Analyze, Vision, History |
| 6 | [Sync](./06-SYNC.md) | `/sync` | Device | Push, Batch, Pull, Status, Acknowledge |
| 7 | [Telemetry](./07-TELEMETRY.md) | `/telemetry` | Device + JWT | Push & Read device telemetry |
| 8 | [Notifications](./08-NOTIFICATIONS.md) | `/notifications` | JWT | List, Mark Read, Mark All Read |
| 9 | [Admin](./09-ADMIN.md) | `/admin` | JWT + ADMIN role | Dashboard, Users, Devices, Logs |
| 10 | [Health](./10-HEALTH.md) | `/health`, `/ready` | Public | Liveness & Readiness probes |
| 11 | [Error Codes](./11-ERROR-CODES.md) | — | — | Semua error code dan artinya |

---

## Validasi Global

- **Whitelist:** Hanya field yang didefinisikan di DTO yang diterima. Field tambahan akan ditolak (`forbidNonWhitelisted: true`).
- **Transform:** Query params secara otomatis di-convert ke tipe yang tepat (number, boolean, dll).
- **Validation errors** dikembalikan dengan status `400` dan format array message yang di-join dengan `;`.
