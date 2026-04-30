# 🛡️ Modul Admin — Dashboard & Management

> **Prefix:** `/api/v1/admin`  
> **Auth:** ✅ Bearer Token + Role `ADMIN` atau `SUPER_ADMIN`  
> **Akses:** HANYA user dengan role admin yang bisa mengakses modul ini.

---

## 1. GET `/admin/dashboard` — Admin Dashboard Stats

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "active": 142
    },
    "devices": {
      "total": 45,
      "paired": 38
    },
    "sync": {
      "total": 12500,
      "pending": 3,
      "failed": 12
    },
    "data": {
      "total": 8750
    },
    "generatedAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `users.total` | `number` | Total user terdaftar |
| `users.active` | `number` | User dengan status ACTIVE |
| `devices.total` | `number` | Total device terdaftar |
| `devices.paired` | `number` | Device yang sudah paired |
| `sync.total` | `number` | Total sync jobs |
| `sync.pending` | `number` | Sync jobs menunggu diproses |
| `sync.failed` | `number` | Sync jobs yang gagal |
| `data.total` | `number` | Total core data records |
| `generatedAt` | `string` | Waktu data di-generate |

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `403` | `AUTH_FORBIDDEN` | User bukan ADMIN atau SUPER_ADMIN |
| `401` | `AUTH_TOKEN_MISSING` | Token tidak ada |

### Kriteria Berhasil ✅

- [x] Semua counter akurat
- [x] Non-admin mendapat `403`

---

## 2. GET `/admin/users` — List Semua User

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Item per halaman (max 100) |

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "petani@example.com",
      "name": "Budi Tani",
      "role": "USER",
      "status": "ACTIVE",
      "lastLoginAt": "2026-04-30T13:00:00.000Z",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "_count": {
        "devices": 2,
        "coreData": 45
      }
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
  }
}
```

### Kriteria Berhasil ✅

- [x] Semua user ditampilkan (bukan hanya milik admin)
- [x] `_count` menunjukkan jumlah device dan data per user

---

## 3. GET `/admin/devices` — List Semua Device

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Item per halaman (max 100) |

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "deviceName": "Sensor Sawah Utara",
      "deviceSerial": "ARISA-PI-001",
      "pairingStatus": "PAIRED",
      "status": "ACTIVE",
      "firmwareVersion": "1.0.0",
      "lastSeenAt": "2026-04-30T13:00:00.000Z",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
  }
}
```

---

## 4. GET `/admin/sync-jobs` — List Sync Jobs

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Item per halaman (max 100) |
| `status` | `string` | ❌ | — | Filter: `PENDING`, `SYNCED`, `FAILED`, dll |

### Contoh Request

```
GET /api/v1/admin/sync-jobs?status=FAILED&page=1&limit=10
```

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "requestId": "sync-001",
      "deviceId": "uuid-device",
      "userId": "uuid-user",
      "payloadType": "sensor_reading",
      "payloadRaw": { "temperature": 28.5 },
      "status": "FAILED",
      "retryCount": 3,
      "maxRetries": 5,
      "errorMessage": "Database connection timeout",
      "processedAt": null,
      "createdAt": "2026-04-30T13:00:00.000Z",
      "updatedAt": "2026-04-30T13:05:00.000Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": { "page": 1, "limit": 10, "total": 12, "totalPages": 2 }
  }
}
```

---

## 5. GET `/admin/logs` — Query Audit Logs

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `action` | `string` | ❌ | — | Filter berdasarkan action, mis: `"ADMIN_DEVICE_DISABLED"` |
| `actorType` | `string` | ❌ | — | Filter: `"USER"`, `"DEVICE"`, `"SYSTEM"` |
| `actorId` | `string` | ❌ | — | Filter berdasarkan actor ID |
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Item per halaman (max 100) |

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actorType": "USER",
      "actorId": "uuid-admin",
      "action": "ADMIN_DEVICE_DISABLED",
      "targetType": "Device",
      "targetId": "uuid-device",
      "metadata": null,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-04-30T13:00:00.000Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25 }
  }
}
```

---

## 6. POST `/admin/devices/:id/disable` — Disable Device

**Auth:** ✅ Bearer Token + ADMIN role  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID device yang akan di-disable |

### Request Body

Tidak diperlukan.

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Device disabled",
    "deviceId": "uuid-of-device"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Update `device.status → DISABLED`
2. Buat audit log: `action: ADMIN_DEVICE_DISABLED`
3. Device yang disabled TIDAK bisa:
   - Mengirim heartbeat
   - Push sync data
   - Push telemetry
   - Di-pairing ke user baru

### Kriteria Berhasil ✅

- [x] Device status berubah ke `DISABLED`
- [x] Audit log tercatat
- [x] Device tidak bisa melakukan operasi apapun

---

## Role Reference

| Role | Akses |
|---|---|
| `USER` | Akses standar (auth, devices, data, AI, notifications) |
| `ADMIN` | Semua akses USER + akses modul Admin |
| `SUPER_ADMIN` | Sama dengan ADMIN (untuk future use — admin escalation) |
