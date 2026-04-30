# 💚 Modul Health — System Health & Readiness

> **Endpoint:** Root level (tanpa prefix `/api/v1`)  
> **Auth:** ❌ Public (semua endpoint)

---

## 1. GET `/health` — Liveness Probe

**Auth:** ❌ Public  
**HTTP Status:** `200 OK`

### Success Response (200)

> ⚠️ Endpoint ini TIDAK menggunakan response wrapper standar. Response dikembalikan **apa adanya** (raw).

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-04-30T13:00:00.000Z"
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `status` | `string` | Selalu `"ok"` jika server berjalan |
| `uptime` | `number` | Waktu server berjalan dalam detik |
| `timestamp` | `string` | Waktu saat ini (ISO 8601) |

### Kegunaan

- **Kubernetes/Railway liveness probe:** Cek apakah server masih hidup
- Tidak mengecek dependency (database, Redis, dll)
- Selalu return `200` selama process Node.js berjalan

### Kriteria Berhasil ✅

- [x] Return `200` dengan `status: "ok"`
- [x] Response time < 10ms (tanpa dependency check)

---

## 2. GET `/ready` — Readiness Probe

**Auth:** ❌ Public  
**HTTP Status:** `200 OK` atau `503 Service Unavailable`

### Success Response (200) — Semua OK

> ⚠️ Endpoint ini TIDAK menggunakan response wrapper standar. Response dikembalikan **apa adanya** (raw).

```json
{
  "status": "ok",
  "checks": {
    "database": {
      "status": "ok",
      "responseTimeMs": 5
    },
    "redis": {
      "status": "ok",
      "responseTimeMs": 2
    },
    "supabase": {
      "status": "ok"
    }
  },
  "timestamp": "2026-04-30T13:00:00.000Z"
}
```

### Response Degraded (200) — Redis Down tapi DB OK

```json
{
  "status": "degraded",
  "checks": {
    "database": {
      "status": "ok",
      "responseTimeMs": 8
    },
    "redis": {
      "status": "error",
      "error": "Connection refused"
    },
    "supabase": {
      "status": "ok"
    }
  },
  "timestamp": "2026-04-30T13:00:00.000Z"
}
```

### Error Response (503) — Database Down

```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection timeout"
    },
    "redis": {
      "status": "ok",
      "responseTimeMs": 2
    },
    "supabase": {
      "status": "ok"
    }
  },
  "timestamp": "2026-04-30T13:00:00.000Z"
}
```

### Status Values

| Status | Deskripsi | HTTP Code |
|---|---|---|
| `ok` | Semua dependency sehat | `200` |
| `degraded` | Database OK tapi service lain bermasalah | `200` |
| `unhealthy` | Database down — server tidak siap menerima traffic | `503` |

### Dependency Checks

| Dependency | Critical? | Deskripsi |
|---|---|---|
| `database` | ✅ Ya | PostgreSQL via Prisma — satu-satunya hard dependency |
| `redis` | ❌ Tidak | Redis untuk rate limiting — fallback ke in-memory |
| `supabase` | ❌ Tidak | Supabase Auth client |

### Kegunaan

- **Kubernetes/Railway readiness probe:** Cek apakah server siap menerima request
- Jika database down, Railway tidak akan mengarahkan traffic ke instance ini
- Redis down = `degraded` (masih operasional, rate limiting fallback ke in-memory)

### Kriteria Berhasil ✅

- [x] `status: "ok"` jika semua dependency sehat
- [x] `status: "degraded"` jika non-critical dependency down
- [x] `status: "unhealthy"` (503) jika database down
- [x] Response time per dependency tercatat

---

## Konfigurasi di Railway

Untuk Railway deployment, set health check URL:

```
Health Check Path: /health
```

Untuk readiness (jika tersedia):

```
Readiness Check Path: /ready
```
