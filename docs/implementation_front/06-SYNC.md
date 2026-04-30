# 🔄 Modul Sync — Data Synchronization (Edge ↔ Cloud)

> **Prefix:** `/api/v1/sync`  
> **Auth:** ✅ Device Token (`X-Device-Token` + `X-Device-Serial`) — semua endpoint  
> **Dipanggil oleh:** Raspberry Pi

---

## 1. POST `/sync/push` — Push Single Sync Item

**Auth:** ✅ Device Token  
**HTTP Status:** `202 Accepted`  
**Idempotent:** ✅ Ya — duplicate `requestId` tidak menyebabkan duplikasi data

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `X-Device-Token` | ✅ | `a1b2c3d4e5f6...96-hex-chars` |
| `X-Device-Serial` | ✅ | `ARISA-PI-001` |

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `requestId` | `string` | ✅ | Unique per request (idempotency key) | `"sync-001-1714500000"` |
| `userId` | `string (UUID)` | ✅ | UUID user yang memiliki data | `"uuid-of-user"` |
| `eventType` | `string` | ✅ | Tipe data | `"scan_result"`, `"sensor_reading"`, `"manual_input"` |
| `timestamp` | `string` | ✅ | ISO 8601 | `"2026-04-30T13:00:00.000Z"` |
| `version` | `number` | ❌ | Min 1, default 1 | `1` |
| `source` | `string` | ❌ | Default `"edge"` | `"edge"` |
| `payload` | `object` | ✅ | Data JSON | `{ "ph": 6.5, "temp": 28 }` |

### Contoh Request

```json
{
  "requestId": "sync-001-1714500000",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "sensor_reading",
  "timestamp": "2026-04-30T13:00:00.000Z",
  "version": 1,
  "payload": {
    "temperature": 28.5,
    "humidity": 75,
    "soilMoisture": 45,
    "lightLevel": 8500
  }
}
```

### Success Response (202)

```json
{
  "success": true,
  "data": {
    "jobId": "uuid-of-sync-job",
    "requestId": "sync-001-1714500000",
    "status": "SYNCED",
    "duplicate": false
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response jika Duplicate (202)

```json
{
  "success": true,
  "data": {
    "jobId": "uuid-of-existing-job",
    "requestId": "sync-001-1714500000",
    "status": "SYNCED",
    "duplicate": true
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cek apakah `requestId` sudah ada → jika ya, return job yang sudah ada (`duplicate: true`)
2. Validasi device ownership: device harus milik `userId` → jika tidak: `400 SYNC_OWNERSHIP_MISMATCH`
3. Buat `SyncJob` dengan status `PENDING`
4. Proses langsung (inline, tanpa queue):
   - Cek konflik: apakah ada `CoreData` dengan `eventId` = `requestId`
   - **Jika ada konflik:** Last-Write-Wins (LWW) berdasarkan `version`
     - Jika cloud version >= incoming version → skip (cloud menang)
     - Jika incoming version > cloud version → update (Pi menang)
   - **Jika tidak ada konflik:** buat `CoreData` record baru
5. Update `SyncJob.status` ke `SYNCED`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `400` | `SYNC_OWNERSHIP_MISMATCH` | Device bukan milik userId yang dikirim |
| `401` | `DEVICE_TOKEN_MISSING` | Header token tidak ada |
| `401` | `DEVICE_TOKEN_INVALID` | Token tidak cocok |

### Kriteria Berhasil ✅

- [x] Data tersimpan di tabel `core_data`
- [x] `SyncJob` tercatat dengan status `SYNCED`
- [x] Duplicate push aman (idempotent)
- [x] Conflict resolution berjalan (LWW by version)

---

## 2. POST `/sync/batch` — Push Batch Items (Max 100)

**Auth:** ✅ Device Token  
**HTTP Status:** `202 Accepted`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `items` | `SyncPushDto[]` | ✅ | Max 100 items | Array of push items |

### Contoh Request

```json
{
  "items": [
    {
      "requestId": "batch-001",
      "userId": "uuid-of-user",
      "eventType": "sensor_reading",
      "timestamp": "2026-04-30T13:00:00.000Z",
      "payload": { "temperature": 28.5 }
    },
    {
      "requestId": "batch-002",
      "userId": "uuid-of-user",
      "eventType": "sensor_reading",
      "timestamp": "2026-04-30T13:05:00.000Z",
      "payload": { "temperature": 29.1 }
    }
  ]
}
```

### Success Response (202)

```json
{
  "success": true,
  "data": {
    "accepted": 2,
    "skipped": 0,
    "failed": 0,
    "results": [
      { "requestId": "batch-001", "jobId": "uuid-1", "status": "ACCEPTED" },
      { "requestId": "batch-002", "jobId": "uuid-2", "status": "ACCEPTED" }
    ]
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Result Status per Item

| Status | Deskripsi |
|---|---|
| `ACCEPTED` | Item baru, berhasil diproses |
| `SKIPPED` | Duplicate `requestId`, diabaikan |
| `FAILED` | Error saat memproses item |

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `400` | `SYNC_BATCH_TOO_LARGE` | Lebih dari 100 items |

### Kriteria Berhasil ✅

- [x] Semua item valid diproses
- [x] Item yang gagal tidak menghentikan item lain (partial success)
- [x] Duplicate items di-skip

---

## 3. GET `/sync/status/:jobId` — Cek Status Sync Job

**Auth:** ✅ Device Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `jobId` | `string (UUID)` | ID sync job |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-job",
    "requestId": "sync-001-1714500000",
    "status": "SYNCED",
    "payloadType": "sensor_reading",
    "retryCount": 0,
    "errorMessage": null,
    "processedAt": "2026-04-30T13:00:01.000Z",
    "createdAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### SyncJobStatus Enum

| Value | Deskripsi |
|---|---|
| `PENDING` | Menunggu diproses |
| `QUEUED` | Masuk antrian (BullMQ, jika Redis ada) |
| `PROCESSING` | Sedang diproses |
| `SYNCED` | Berhasil disinkronkan |
| `FAILED` | Gagal (lihat `errorMessage`) |
| `CONFLICT` | Ada konflik versi |

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `SYNC_JOB_NOT_FOUND` | Job tidak ditemukan |

---

## 4. POST `/sync/ack` — Acknowledge Synced Items

**Auth:** ✅ Device Token  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `jobIds` | `string[]` | ✅ | Array of UUID | `["uuid-1", "uuid-2"]` |

### Contoh Request

```json
{
  "jobIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ]
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "acknowledged": 2
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Kriteria Berhasil ✅

- [x] `acknowledged` menunjukkan jumlah job yang berhasil di-ack
- [x] Hanya job dengan status `SYNCED` yang bisa di-ack

---

## 5. GET `/sync/pull` — Pull Updates dari Cloud ke Device

**Auth:** ✅ Device Token  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `since` | `string` | ✅ | — | ISO 8601 timestamp (ambil data setelah waktu ini) |
| `limit` | `number` | ❌ | `50` | Max items (max 100) |

### Contoh Request

```
GET /api/v1/sync/pull?since=2026-04-30T12:00:00.000Z&limit=50
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "dataType": "scan_result",
        "dataJson": { "plant": "padi", "disease": "blast" },
        "version": 2,
        "source": "app",
        "updatedAt": "2026-04-30T13:00:00.000Z"
      }
    ],
    "cursor": "2026-04-30T13:00:00.000Z",
    "count": 1
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `items` | `array` | Data records yang berubah sejak `since` |
| `cursor` | `string` | Timestamp terakhir — gunakan sebagai `since` pada pull berikutnya |
| `count` | `number` | Jumlah items dalam response |

### Perilaku Internal

- Filter `updatedAt > since` dan `userId` = primary owner device
- Diurutkan `updatedAt ASC` (terlama dulu, untuk pagination cursor)
- Data dari SEMUA source (app, edge, cloud) dikembalikan

### Kriteria Berhasil ✅

- [x] Hanya data milik owner device yang dikembalikan (B4 security fix)
- [x] `cursor` bisa dipakai untuk pull berikutnya (cursor-based pagination)
- [x] Limit max 100 item per request
