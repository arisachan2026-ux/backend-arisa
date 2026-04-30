# 👤 Modul Users — Profile Management

> **Prefix:** `/api/v1/users`  
> **Auth:** ✅ Bearer Token (semua endpoint)

---

## 1. GET `/users/me` — Get Current User Profile

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `Authorization` | ✅ | `Bearer eyJhbGciOiJIUzI1NiIs...` |

### Request Body

Tidak diperlukan.

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "petani@example.com",
    "name": "Budi Tani",
    "avatarUrl": "https://example.com/avatar.jpg",
    "role": "USER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-30T13:00:00.000Z",
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-30T13:00:00.000Z",
    "stats": {
      "devicesCount": 2,
      "dataCount": 45
    }
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `id` | `string (UUID)` | ID internal user |
| `email` | `string` | Email user (read-only) |
| `name` | `string \| null` | Nama display |
| `avatarUrl` | `string \| null` | URL foto profil |
| `role` | `enum` | `USER`, `ADMIN`, atau `SUPER_ADMIN` |
| `status` | `enum` | `ACTIVE`, `SUSPENDED`, atau `DELETED` |
| `lastLoginAt` | `string \| null` | Timestamp login terakhir (ISO 8601) |
| `createdAt` | `string` | Timestamp registrasi |
| `updatedAt` | `string` | Timestamp update terakhir |
| `stats.devicesCount` | `number` | Jumlah device yang dimiliki |
| `stats.dataCount` | `number` | Jumlah data record yang dimiliki |

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_TOKEN_MISSING` | Tidak ada header Authorization |
| `401` | `AUTH_TOKEN_INVALID` | Token expired atau invalid |
| `404` | `AUTH_USER_NOT_FOUND` | User tidak ditemukan di DB |

### Kriteria Berhasil ✅

- [x] Response berisi profil lengkap user yang sedang login
- [x] `stats.devicesCount` menunjukkan jumlah device aktif milik user
- [x] `stats.dataCount` menunjukkan jumlah data record milik user

---

## 2. PATCH `/users/me` — Update User Profile

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `Authorization` | ✅ | `Bearer eyJhbGciOiJIUzI1NiIs...` |

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `name` | `string` | ❌ | Max 100 karakter | `"Budi Tani Maju"` |
| `avatarUrl` | `string` | ❌ | Harus URL valid | `"https://example.com/new-avatar.jpg"` |

> **Catatan:** Hanya kirimkan field yang ingin diubah. Field yang tidak dikirim TIDAK akan berubah.

### Contoh Request

```json
{
  "name": "Budi Tani Maju",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "petani@example.com",
    "name": "Budi Tani Maju",
    "avatarUrl": "https://example.com/new-avatar.jpg",
    "role": "USER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-30T13:00:00.000Z",
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-30T14:00:00.000Z"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Lookup user berdasarkan JWT userId
2. Jika user tidak ada → `404 AUTH_USER_NOT_FOUND`
3. Update hanya field yang dikirimkan (partial update)
4. Return profil yang sudah ter-update

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_TOKEN_MISSING` | Token tidak ada |
| `401` | `AUTH_TOKEN_INVALID` | Token invalid |
| `404` | `AUTH_USER_NOT_FOUND` | User tidak ditemukan |
| `400` | `VALIDATION_ERROR` | `avatarUrl` bukan URL valid, `name` terlalu panjang |

### Kriteria Berhasil ✅

- [x] Field yang diubah tercermin di response
- [x] Field yang TIDAK dikirim tetap sama (tidak di-null-kan)
- [x] `updatedAt` ter-update ke waktu sekarang
- [x] `email` dan `role` TIDAK bisa diubah melalui endpoint ini
