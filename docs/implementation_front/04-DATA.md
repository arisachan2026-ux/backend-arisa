# 📊 Modul Data — Core Data CRUD

> **Prefix:** `/api/v1/data`  
> **Auth:** ✅ Bearer Token (semua endpoint)  
> **Ownership:** User hanya bisa mengakses data miliknya sendiri.

---

## 1. POST `/data` — Create Data Record

**Auth:** ✅ Bearer Token  
**HTTP Status:** `201 Created`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `dataType` | `string` | ✅ | — | `"scan_result"`, `"sensor_reading"`, `"manual_input"` |
| `dataJson` | `object` | ✅ | Harus object JSON valid | `{ "ph": 6.5, "nitrogen": 45 }` |
| `deviceId` | `string (UUID)` | ❌ | UUID valid | `"uuid-of-device"` |

### Contoh Request

```json
{
  "dataType": "scan_result",
  "dataJson": {
    "plant": "padi",
    "disease": "blast",
    "severity": "medium",
    "confidence": 0.87
  },
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Success Response (201)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-record",
    "userId": "uuid-of-user",
    "deviceId": "uuid-of-device",
    "dataType": "scan_result",
    "dataJson": { "plant": "padi", "disease": "blast", "severity": "medium", "confidence": 0.87 },
    "version": 1,
    "source": "app",
    "eventId": null,
    "createdAt": "2026-04-30T13:00:00.000Z",
    "updatedAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

- `userId` otomatis diisi dari JWT (user yang login)
- `source` otomatis diisi `"app"` (data dari mobile app)
- `version` dimulai dari `1`
- `eventId` = `null` (hanya terisi untuk data yang datang dari Sync)

### Kriteria Berhasil ✅

- [x] Record terbuat dengan `source: "app"` dan `version: 1`
- [x] `userId` ter-assign otomatis dari token
- [x] Record bisa diakses via `GET /data/:id`

---

## 2. GET `/data` — List Data Records (Paginated)

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Jumlah item per halaman (max 100) |
| `dataType` | `string` | ❌ | — | Filter berdasarkan tipe data |

### Contoh Request

```
GET /api/v1/data?page=1&limit=10&dataType=scan_result
```

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "dataType": "scan_result",
      "dataJson": { "plant": "padi", "disease": "blast" },
      "version": 1,
      "source": "app",
      "eventId": null,
      "createdAt": "2026-04-30T13:00:00.000Z",
      "updatedAt": "2026-04-30T13:00:00.000Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  }
}
```

### Perilaku Internal

- Hanya data milik user yang login yang dikembalikan (filter `userId`)
- Diurutkan `createdAt DESC` (terbaru dulu)
- Limit max 100 item per halaman

### Kriteria Berhasil ✅

- [x] Hanya data milik user yang tampil
- [x] Filter `dataType` berfungsi
- [x] Pagination info benar

---

## 3. GET `/data/:id` — Get Single Data Record

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID data record |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-record",
    "userId": "uuid-of-user",
    "deviceId": "uuid-of-device",
    "dataType": "scan_result",
    "dataJson": { "plant": "padi", "disease": "blast" },
    "version": 1,
    "source": "app",
    "eventId": null,
    "createdAt": "2026-04-30T13:00:00.000Z",
    "updatedAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DATA_NOT_FOUND` | Record tidak ditemukan |
| `403` | `DATA_OWNERSHIP_DENIED` | Record bukan milik user yang login |

### Kriteria Berhasil ✅

- [x] Data lengkap dikembalikan
- [x] User tidak bisa akses data milik user lain

---

## 4. PATCH `/data/:id` — Update Data Record

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID data record |

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `dataJson` | `object` | ❌ | Harus object JSON | `{ "severity": "high" }` |
| `dataType` | `string` | ❌ | — | `"sensor_reading"` |

### Contoh Request

```json
{
  "dataJson": {
    "plant": "padi",
    "disease": "blast",
    "severity": "high",
    "confidence": 0.92
  }
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-record",
    "userId": "uuid-of-user",
    "deviceId": "uuid-of-device",
    "dataType": "scan_result",
    "dataJson": { "plant": "padi", "disease": "blast", "severity": "high", "confidence": 0.92 },
    "version": 2,
    "source": "app",
    "eventId": null,
    "createdAt": "2026-04-30T13:00:00.000Z",
    "updatedAt": "2026-04-30T14:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

- **Ownership check:** hanya owner yang bisa update
- `version` otomatis di-increment (+1) setiap kali update
- Hanya field yang dikirim yang berubah

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DATA_NOT_FOUND` | Record tidak ditemukan |
| `403` | `DATA_OWNERSHIP_DENIED` | Bukan pemilik record |

### Kriteria Berhasil ✅

- [x] `version` bertambah dari sebelumnya
- [x] `updatedAt` berubah
- [x] Data yang tidak dikirim tetap utuh

---

## 5. DELETE `/data/:id` — Delete Data Record

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID data record |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Record deleted"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

- **Ownership check** dilakukan sebelum delete
- Hard delete (record dihapus permanen dari database)

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DATA_NOT_FOUND` | Record tidak ditemukan |
| `403` | `DATA_OWNERSHIP_DENIED` | Bukan pemilik record |

### Kriteria Berhasil ✅

- [x] Record terhapus dari database
- [x] `GET /data/:id` mengembalikan `404` setelah delete

---

## Enum Reference — Data Source

| Value | Deskripsi |
|---|---|
| `app` | Data dibuat dari mobile app (via `POST /data`) |
| `edge` | Data datang dari Raspberry Pi (via Sync engine) |
| `cloud` | Data dibuat oleh proses cloud |
