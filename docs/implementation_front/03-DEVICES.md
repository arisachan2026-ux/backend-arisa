# 📱 Modul Devices — Device Registration, Pairing & Management

> **Prefix:** `/api/v1/devices`  
> **Auth:** Campuran — Public (Pi registration), JWT (mobile app), Device Token (Pi heartbeat)

---

## 1. POST `/devices/register` — Register Device Baru (Pi First Boot)

**Auth:** ❌ Public  
**HTTP Status:** `201 Created`  
**Dipanggil oleh:** Raspberry Pi saat pertama kali booting

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `deviceSerial` | `string` | ✅ | Max 100 char, harus unique | `"ARISA-PI-001"` |
| `deviceName` | `string` | ✅ | Max 200 char | `"Farm Sensor Alpha"` |
| `registrationSecret` | `string` | ✅ | Harus cocok dengan `DEVICE_REGISTRATION_SECRET` di env | `"super-secret-key"` |
| `firmwareVersion` | `string` | ❌ | — | `"1.0.0"` |

### Contoh Request

```json
{
  "deviceSerial": "ARISA-PI-001",
  "deviceName": "Sensor Sawah Utara",
  "registrationSecret": "super-secret-key",
  "firmwareVersion": "1.0.0"
}
```

### Success Response (201)

```json
{
  "success": true,
  "data": {
    "deviceId": "uuid-of-device",
    "deviceToken": "a1b2c3d4e5f6...96-hex-chars...z9y8x7w6",
    "deviceSerial": "ARISA-PI-001",
    "deviceName": "Sensor Sawah Utara"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

> ⚠️ **KRITIS:** `deviceToken` hanya dikembalikan **SATU KALI**. Pi HARUS menyimpan token ini secara aman. Token ini dipakai untuk semua autentikasi device selanjutnya (header `X-Device-Token`).

### Perilaku Internal

1. Verifikasi `registrationSecret` terhadap env `DEVICE_REGISTRATION_SECRET`
2. Cek apakah `deviceSerial` sudah terdaftar → jika ya: `409 DEVICE_SERIAL_EXISTS`
3. Generate token acak 48 byte (96 hex char) → hash dengan bcrypt → simpan hash
4. Buat record device dengan status `UNPAIRED`, `ACTIVE`
5. Return `deviceId` + `deviceToken` (raw, bukan hash)

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `DEVICE_REGISTRATION_SECRET_INVALID` | Registration secret salah |
| `409` | `DEVICE_SERIAL_EXISTS` | Serial sudah terdaftar |
| `400` | `VALIDATION_ERROR` | Body tidak valid |

### Kriteria Berhasil ✅

- [x] Device terbuat dengan `pairingStatus: UNPAIRED`, `status: ACTIVE`
- [x] `deviceToken` dikembalikan (96 hex char)
- [x] Token bisa dipakai di header `X-Device-Token` untuk endpoint device-auth

---

## 2. POST `/devices/pair/start` — Generate Pairing Code

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`  
**Dipanggil oleh:** Mobile app atau admin

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `deviceId` | `string` | ✅ | UUID device | `"uuid-of-device"` |

### Contoh Request

```json
{
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "pairingCode": "A7X9K2",
    "expiresAt": "2026-04-30T13:10:00.000Z",
    "deviceId": "uuid-of-device",
    "deviceName": "Sensor Sawah Utara",
    "qrData": "arisa://pair?code=A7X9K2&device=uuid-of-device"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `pairingCode` | `string` | Kode 6 karakter alfanumerik (uppercase) |
| `expiresAt` | `string` | Waktu kadaluarsa kode (ISO 8601), default 10 menit |
| `deviceId` | `string` | ID device |
| `deviceName` | `string` | Nama device |
| `qrData` | `string` | Data untuk QR code: `arisa://pair?code=XXX&device=YYY` |

### Perilaku Internal

1. Cari device berdasarkan `deviceId`
2. Jika device tidak ada → `404 DEVICE_NOT_FOUND`
3. Jika device tidak `ACTIVE` → `403 DEVICE_DISABLED`
4. Generate kode pairing 6 karakter (uppercase alfanumerik)
5. Set expiry = sekarang + `PAIRING_CODE_EXPIRY_MINUTES` (default 10 menit)
6. Update device: `pairingCode`, `pairingExpiry`, `pairingStatus: PAIRING`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DEVICE_NOT_FOUND` | Device tidak ditemukan |
| `403` | `DEVICE_DISABLED` | Device berstatus DISABLED atau DECOMMISSIONED |

### Kriteria Berhasil ✅

- [x] Kode pairing 6 karakter dikembalikan
- [x] `qrData` bisa di-render jadi QR Code oleh mobile app
- [x] Kode expire setelah 10 menit

---

## 3. POST `/devices/pair/confirm` — Konfirmasi Pairing

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`  
**Dipanggil oleh:** Mobile app setelah scan QR atau input kode manual

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `pairingCode` | `string` | ✅ | 6 karakter | `"A7X9K2"` |
| `deviceId` | `string` | ✅ | UUID device | `"uuid-of-device"` |

### Contoh Request

```json
{
  "pairingCode": "A7X9K2",
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Device paired successfully",
    "deviceId": "uuid-of-device",
    "deviceName": "Sensor Sawah Utara"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cari device termasuk owners aktif
2. Validasi `pairingCode` → jika salah: `403 DEVICE_PAIRING_CODE_INVALID`
3. Cek kadaluarsa → jika expired: `410 DEVICE_PAIRING_CODE_EXPIRED` (kode di-nullify)
4. Cek apakah user sudah paired → jika sudah: `409 DEVICE_ALREADY_PAIRED`
5. **Dalam transaction:**
   - Buat record `UserDevice` (user ↔ device link)
   - Owner pertama = `isPrimary: true`
   - Nullify `pairingCode`, set `pairingStatus: PAIRED`
6. Kode pairing single-use — langsung dihapus setelah dipakai

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DEVICE_NOT_FOUND` | Device tidak ditemukan |
| `403` | `DEVICE_PAIRING_CODE_INVALID` | Kode pairing salah |
| `410` | `DEVICE_PAIRING_CODE_EXPIRED` | Kode pairing sudah expired |
| `409` | `DEVICE_ALREADY_PAIRED` | User sudah paired ke device ini |

### Kriteria Berhasil ✅

- [x] User terhubung ke device sebagai owner
- [x] Device muncul di list `GET /devices`
- [x] Kode pairing tidak bisa dipakai lagi (single-use)

---

## 4. GET `/devices` — List Devices Milik User

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-of-device",
      "deviceName": "Sensor Sawah Utara",
      "deviceSerial": "ARISA-PI-001",
      "pairingStatus": "PAIRED",
      "status": "ACTIVE",
      "firmwareVersion": "1.0.0",
      "lastSeenAt": "2026-04-30T13:00:00.000Z",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "isPrimary": true,
      "pairedAt": "2026-04-05T08:00:00.000Z"
    }
  ],
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields per Device

| Field | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID device |
| `deviceName` | `string` | Nama device |
| `deviceSerial` | `string` | Serial number |
| `pairingStatus` | `enum` | `UNPAIRED`, `PAIRING`, `PAIRED`, `REVOKED` |
| `status` | `enum` | `ACTIVE`, `DISABLED`, `DECOMMISSIONED` |
| `firmwareVersion` | `string \| null` | Versi firmware |
| `lastSeenAt` | `string \| null` | Terakhir online (ISO 8601) |
| `createdAt` | `string` | Tanggal device terdaftar |
| `isPrimary` | `boolean` | Apakah user ini primary owner |
| `pairedAt` | `string` | Tanggal pairing |

### Perilaku Internal

- Hanya menampilkan device yang ownership-nya belum di-revoke (`revokedAt: null`)
- Diurutkan berdasarkan `pairedAt` (terbaru dulu)

### Kriteria Berhasil ✅

- [x] Hanya device milik user yang tampil
- [x] Device yang sudah di-revoke TIDAK tampil
- [x] `isPrimary` dan `pairedAt` ada di setiap item

---

## 5. GET `/devices/:id` — Get Device Detail

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID device |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-device",
    "deviceName": "Sensor Sawah Utara",
    "deviceSerial": "ARISA-PI-001",
    "pairingStatus": "PAIRED",
    "status": "ACTIVE",
    "firmwareVersion": "1.0.0",
    "appVersion": null,
    "lastSeenAt": "2026-04-30T13:00:00.000Z",
    "metadata": null,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-30T13:00:00.000Z",
    "owners": [
      {
        "userId": "uuid-of-user",
        "isPrimary": true,
        "pairedAt": "2026-04-05T08:00:00.000Z"
      }
    ],
    "stats": {
      "syncJobsCount": 120,
      "telemetryCount": 500
    }
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cari device + owners aktif + count sync jobs & telemetry
2. **Ownership check:** User harus ada di daftar owners → jika tidak: `403 DATA_OWNERSHIP_DENIED`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DEVICE_NOT_FOUND` | Device tidak ditemukan |
| `403` | `DATA_OWNERSHIP_DENIED` | User bukan owner device ini |

### Kriteria Berhasil ✅

- [x] Detail lengkap device beserta stats dan daftar owners
- [x] User non-owner mendapat error `403`

---

## 6. POST `/devices/:id/revoke` — Revoke (Unpair) Device

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID device |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Device revoked"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cari link `UserDevice` aktif antara user dan device
2. Set `revokedAt` ke waktu sekarang (soft-revoke)
3. Cek apakah masih ada owner lain yang aktif
4. Jika TIDAK ada owner lain → set `device.pairingStatus = REVOKED`
5. Jika masih ada owner lain → device tetap `PAIRED`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `404` | `DEVICE_NOT_FOUND` | Link ownership tidak ditemukan |

### Kriteria Berhasil ✅

- [x] Device tidak muncul lagi di `GET /devices` user ini
- [x] Jika device masih punya owner lain, tetap `PAIRED`
- [x] Jika device tidak punya owner, status berubah ke `REVOKED`

---

## 7. POST `/devices/:id/heartbeat` — Device Heartbeat

**Auth:** ✅ Device Token (`X-Device-Token` + `X-Device-Serial`)  
**HTTP Status:** `200 OK`  
**Dipanggil oleh:** Raspberry Pi secara periodik

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `X-Device-Token` | ✅ | `a1b2c3d4e5f6...96-hex-chars` |
| `X-Device-Serial` | ✅ | `ARISA-PI-001` |

### Path Parameters

| Param | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID device |

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `firmwareVersion` | `string` | ❌ | — | `"1.1.0"` |
| `networkStatus` | `string` | ❌ | — | `"online"` |

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "serverTime": "2026-04-30T13:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. DeviceAuthGuard verifikasi `X-Device-Token` + `X-Device-Serial`
2. Update `lastSeenAt` ke waktu sekarang
3. Jika `firmwareVersion` dikirim, update juga `firmwareVersion`

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `DEVICE_TOKEN_MISSING` | Header `X-Device-Token` tidak ada |
| `401` | `DEVICE_SERIAL_MISSING` | Header `X-Device-Serial` tidak ada |
| `401` | `DEVICE_TOKEN_INVALID` | Token tidak cocok |
| `403` | `DEVICE_DISABLED` | Device berstatus DISABLED |

### Kriteria Berhasil ✅

- [x] `acknowledged: true` dikembalikan
- [x] `lastSeenAt` ter-update di database
- [x] `serverTime` bisa dipakai Pi untuk time sync

---

## Enum Reference

### DevicePairingStatus

| Value | Deskripsi |
|---|---|
| `UNPAIRED` | Belum dipasangkan ke user manapun |
| `PAIRING` | Sedang dalam proses pairing (kode aktif) |
| `PAIRED` | Sudah terhubung ke setidaknya 1 user |
| `REVOKED` | Semua owner telah mencabut kepemilikan |

### DeviceStatus

| Value | Deskripsi |
|---|---|
| `ACTIVE` | Aktif dan bisa beroperasi |
| `DISABLED` | Dinonaktifkan oleh admin |
| `DECOMMISSIONED` | Sudah tidak digunakan |
