# 🔔 Modul Notifications — In-App Notifications

> **Prefix:** `/api/v1/notifications`  
> **Auth:** ✅ Bearer Token (semua endpoint)

---

## 1. GET `/notifications` — List Notifikasi User

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Query Parameters

| Param | Type | Wajib | Default | Deskripsi |
|---|---|---|---|---|
| `page` | `number` | ❌ | `1` | Halaman |
| `limit` | `number` | ❌ | `20` | Item per halaman (max 100) |

### Contoh Request

```
GET /api/v1/notifications?page=1&limit=10
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "unreadCount": 3,
    "data": [
      {
        "id": "uuid-notif-1",
        "userId": "uuid-of-user",
        "type": "info",
        "title": "Device Baru Terhubung",
        "body": "Sensor Sawah Utara berhasil dipasangkan ke akun Anda.",
        "status": "UNREAD",
        "metadata": { "deviceId": "uuid-of-device" },
        "readAt": null,
        "createdAt": "2026-04-30T13:00:00.000Z"
      },
      {
        "id": "uuid-notif-2",
        "userId": "uuid-of-user",
        "type": "warning",
        "title": "Suhu Tinggi Terdeteksi",
        "body": "Sensor Sawah Utara mendeteksi suhu tanah di atas 40°C.",
        "status": "READ",
        "metadata": { "deviceId": "uuid-of-device", "temp": 42.5 },
        "readAt": "2026-04-30T14:00:00.000Z",
        "createdAt": "2026-04-30T12:30:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `unreadCount` | `number` | Jumlah notifikasi yang belum dibaca |
| `data` | `array` | List notifikasi |

### Notification Fields

| Field | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID notifikasi |
| `userId` | `string (UUID)` | ID user pemilik |
| `type` | `string` | Tipe notifikasi: `"info"`, `"warning"`, `"error"`, `"success"` |
| `title` | `string` | Judul notifikasi |
| `body` | `string` | Isi notifikasi |
| `status` | `enum` | `UNREAD`, `READ`, atau `ARCHIVED` |
| `metadata` | `object \| null` | Data tambahan (deviceId, nilai sensor, dll) |
| `readAt` | `string \| null` | Waktu dibaca (ISO 8601) |
| `createdAt` | `string` | Waktu dibuat |

### Kriteria Berhasil ✅

- [x] Hanya notifikasi milik user yang login
- [x] `unreadCount` menunjukkan jumlah belum dibaca
- [x] Terurut dari terbaru

---

## 2. PATCH `/notifications/:id/read` — Tandai Notifikasi Dibaca

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID notifikasi |

### Request Body

Tidak diperlukan.

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid-notif-1",
    "userId": "uuid-of-user",
    "type": "info",
    "title": "Device Baru Terhubung",
    "body": "Sensor Sawah Utara berhasil dipasangkan.",
    "status": "READ",
    "metadata": null,
    "readAt": "2026-04-30T14:00:00.000Z",
    "createdAt": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cari notifikasi berdasarkan ID
2. Ownership check: `notification.userId === current user`
3. Update `status → READ`, `readAt → now()`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `NOTIFICATION_NOT_FOUND` | Notifikasi tidak ditemukan atau bukan milik user |

### Kriteria Berhasil ✅

- [x] `status` berubah ke `READ`
- [x] `readAt` terisi timestamp
- [x] `unreadCount` berkurang di list berikutnya

---

## 3. POST `/notifications/read-all` — Tandai Semua Dibaca

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Request Body

Tidak diperlukan.

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "updated": 3
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Update semua notifikasi user yang `status = UNREAD`
2. Set `status → READ`, `readAt → now()`
3. Return jumlah yang di-update

### Kriteria Berhasil ✅

- [x] Semua notifikasi UNREAD berubah ke READ
- [x] `updated` menunjukkan jumlah yang berubah
- [x] Selanjutnya `unreadCount` = 0

---

## Notification Status Enum

| Value | Deskripsi |
|---|---|
| `UNREAD` | Belum dibaca |
| `READ` | Sudah dibaca |
| `ARCHIVED` | Diarsipkan (untuk future use) |

---

## Tips untuk Frontend

### Badge Count

Gunakan `unreadCount` dari response `GET /notifications` untuk menampilkan badge angka di ikon notifikasi.

### Polling vs Real-time

Saat ini notifikasi berbasis **polling**. Gunakan polling setiap 30-60 detik:

```javascript
// Polling setiap 30 detik
setInterval(async () => {
  const res = await fetch('/api/v1/notifications?limit=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  updateBadge(data.data.unreadCount);
}, 30000);
```
