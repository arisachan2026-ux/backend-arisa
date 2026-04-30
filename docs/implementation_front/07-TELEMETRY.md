# 📡 Modul Telemetry — Device Telemetry Data

> **Prefix:** `/api/v1/telemetry`  
> **Auth:** Campuran — Device Token (push) dan JWT (read history)

---

## 1. POST `/telemetry` — Push Telemetry dari Device

**Auth:** ✅ Device Token (`X-Device-Token` + `X-Device-Serial`)  
**HTTP Status:** `201 Created`  
**Dipanggil oleh:** Raspberry Pi secara periodik

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `X-Device-Token` | ✅ | `a1b2c3d4e5f6...96-hex-chars` |
| `X-Device-Serial` | ✅ | `ARISA-PI-001` |

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `cpuTemp` | `number` | ❌ | — | `45.2` (°C) |
| `cpuUsage` | `number` | ❌ | — | `23.5` (%) |
| `ramUsage` | `number` | ❌ | — | `68.0` (%) |
| `diskUsage` | `number` | ❌ | — | `42.3` (%) |
| `uptime` | `number` | ❌ | — | `3600` (detik) |
| `networkStatus` | `string` | ❌ | — | `"connected"` |
| `batteryStatus` | `string` | ❌ | — | `"charging"` |
| `metadata` | `object` | ❌ | JSON object | `{ "signalStrength": -45 }` |

> **Catatan:** Semua field opsional. Kirim hanya field yang tersedia dari sensor.

### Contoh Request

```json
{
  "cpuTemp": 45.2,
  "cpuUsage": 23.5,
  "ramUsage": 68.0,
  "diskUsage": 42.3,
  "uptime": 86400,
  "networkStatus": "connected",
  "metadata": {
    "wifiSSID": "Farm-Network",
    "signalStrength": -42
  }
}
```

### Success Response (201)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-telemetry-record",
    "createdAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. DeviceAuthGuard verifikasi device token + serial
2. Buat record telemetry baru (append-only — tidak pernah di-update)
3. `deviceId` otomatis diisi dari guard

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `DEVICE_TOKEN_MISSING` | Header `X-Device-Token` tidak ada |
| `401` | `DEVICE_SERIAL_MISSING` | Header `X-Device-Serial` tidak ada |
| `401` | `DEVICE_TOKEN_INVALID` | Token tidak cocok |
| `403` | `DEVICE_DISABLED` | Device berstatus DISABLED |

### Kriteria Berhasil ✅

- [x] Record telemetry terbuat di database
- [x] `id` dan `createdAt` dikembalikan
- [x] Data bersifat append-only (tidak di-update/delete)

---

## 2. GET `/telemetry/device/:deviceId` — Get Telemetry History

**Auth:** ✅ Bearer Token (JWT)  
**HTTP Status:** `200 OK`  
**Dipanggil oleh:** Mobile app

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `Authorization` | ✅ | `Bearer eyJhbGciOiJIUzI1NiIs...` |

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `deviceId` | `string (UUID)` | ID device |

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `limit` | `number` | ❌ | `50` | Jumlah record (max 200) |

### Contoh Request

```
GET /api/v1/telemetry/device/uuid-of-device?limit=20
```

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "cpuTemp": 45.2,
      "cpuUsage": 23.5,
      "ramUsage": 68.0,
      "diskUsage": 42.3,
      "uptime": 86400,
      "networkStatus": "connected",
      "createdAt": "2026-04-30T13:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "cpuTemp": 44.8,
      "cpuUsage": 21.0,
      "ramUsage": 65.5,
      "diskUsage": 42.3,
      "uptime": 82800,
      "networkStatus": "connected",
      "createdAt": "2026-04-30T12:55:00.000Z"
    }
  ],
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. **Ownership check:** User harus memiliki device tersebut (via tabel `user_devices`)
2. Jika bukan owner → `403 DATA_OWNERSHIP_DENIED`
3. Query terurut `createdAt DESC` (terbaru dulu)
4. Limit max 200 record

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `403` | `DATA_OWNERSHIP_DENIED` | User bukan owner device |
| `401` | `AUTH_TOKEN_MISSING` | Token tidak ada |

### Kriteria Berhasil ✅

- [x] Hanya data device milik user yang bisa diakses
- [x] Data terbaru di atas
- [x] Cocok untuk rendering chart/grafik di mobile app

---

## Tips untuk Frontend

### Rendering Telemetry Dashboard

Data telemetry cocok untuk divisualisasikan sebagai:

| Field | Visualisasi | Satuan |
|---|---|---|
| `cpuTemp` | Line chart / Gauge | °C |
| `cpuUsage` | Line chart / Progress bar | % |
| `ramUsage` | Line chart / Progress bar | % |
| `diskUsage` | Progress bar / Pie chart | % |
| `uptime` | Text (konversi ke hari/jam) | detik |
| `networkStatus` | Badge / Indicator | text |

### Polling Strategy

- Poll `GET /telemetry/device/:id?limit=1` setiap 30-60 detik untuk status real-time
- Gunakan `limit=50` untuk chart historis
