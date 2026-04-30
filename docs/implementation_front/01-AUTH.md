# 🔐 Modul Auth — Authentication & Session Management

> **Prefix:** `/api/v1/auth`  
> **Auth:** Sebagian besar endpoint bersifat **Public** (tidak perlu token).

---

## 1. POST `/auth/register` — Register User Baru

**Auth:** ❌ Public  
**HTTP Status:** `201 Created`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `email` | `string` | ✅ | Format email valid | `"user@example.com"` |
| `password` | `string` | ✅ | Min 8 karakter, Max 72 | `"SecurePass123!"` |
| `name` | `string` | ❌ | Max 100 karakter | `"John Doe"` |

### Contoh Request

```json
{
  "email": "petani@example.com",
  "password": "MySecure123!",
  "name": "Budi Tani"
}
```

### Success Response (201)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "petani@example.com",
      "name": "Budi Tani",
      "avatarUrl": null,
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-04-30T13:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "v1.MjAyNi0wNC0zMFQx..."
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Cek apakah email sudah terdaftar di DB internal → jika sudah: `409 AUTH_EMAIL_EXISTS`
2. Buat user di Supabase Auth via `signUp()`
3. Jika Supabase mengembalikan error "already registered" → `409 AUTH_EMAIL_EXISTS`
4. Buat record user internal di tabel `users`
5. Jika Supabase tidak mengembalikan session (email confirmation aktif), backend akan **auto-confirm** user dan sign-in ulang untuk mendapatkan token
6. Return user data + tokens

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `409` | `AUTH_EMAIL_EXISTS` | Email sudah terdaftar |
| `400` | `VALIDATION_ERROR` | Body tidak valid (email format salah, password terlalu pendek, dll) |
| `500` | `SYSTEM_INTERNAL_ERROR` | Gagal membuat user di Supabase |

### Kriteria Berhasil ✅

- [x] Response berisi `user`, `accessToken`, dan `refreshToken`
- [x] `accessToken` bisa dipakai di header `Authorization: Bearer <token>` untuk endpoint lain
- [x] User muncul di tabel `users` dengan role `USER` dan status `ACTIVE`

---

## 2. POST `/auth/login` — Login dengan Email/Password

**Auth:** ❌ Public  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `email` | `string` | ✅ | Format email valid | `"user@example.com"` |
| `password` | `string` | ✅ | Min 1 karakter (validasi dilakukan oleh Supabase) | `"SecurePass123!"` |

### Contoh Request

```json
{
  "email": "petani@example.com",
  "password": "MySecure123!"
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "petani@example.com",
      "name": "Budi Tani",
      "avatarUrl": null,
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-04-30T13:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "v1.MjAyNi0wNC0zMFQx..."
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Login via Supabase Auth `signInWithPassword()`
2. Jika gagal → `401 AUTH_INVALID_CREDENTIALS`
3. Cari user internal berdasarkan `supabaseId`
4. Jika user tidak ada di DB internal (edge case) → auto-create record internal
5. Update `lastLoginAt` ke waktu sekarang
6. Return user + tokens

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_INVALID_CREDENTIALS` | Email atau password salah |
| `400` | `VALIDATION_ERROR` | Body tidak valid |

### Kriteria Berhasil ✅

- [x] Response berisi `user`, `accessToken`, dan `refreshToken`
- [x] `user.lastLoginAt` ter-update di database
- [x] Token valid untuk digunakan di endpoint protected

---

## 3. POST `/auth/oauth/google` — Login/Register via Google OAuth

**Auth:** ❌ Public  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `idToken` | `string` | ✅ | Google ID token dari client-side OAuth | `"eyJhbGciOi..."` |

### Contoh Request

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "petani@gmail.com",
      "name": "Budi Tani",
      "avatarUrl": "https://lh3.googleusercontent.com/...",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-04-30T13:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "v1.MjAyNi0wNC0zMFQx..."
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Kirim `idToken` ke Supabase Auth via `signInWithIdToken({ provider: 'google', token })`
2. Jika token invalid → `401 AUTH_INVALID_CREDENTIALS`
3. **Upsert** user internal:
   - Jika user baru: buat record dengan data dari Google (name, avatar, email)
   - Jika user sudah ada: update `lastLoginAt`, `name`, `avatarUrl` dari Google
4. Return user + tokens

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_INVALID_CREDENTIALS` | Google ID token invalid atau expired |
| `400` | `VALIDATION_ERROR` | Body tidak valid |

### Kriteria Berhasil ✅

- [x] User baru otomatis terbuat jika belum ada
- [x] Data Google (name, avatar) ter-sinkron ke profile
- [x] Token valid untuk endpoint protected

---

## 4. POST `/auth/refresh` — Refresh Access Token

**Auth:** ❌ Public  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `refreshToken` | `string` | ✅ | Supabase refresh token | `"v1.MjAyNi0w..."` |

### Contoh Request

```json
{
  "refreshToken": "v1.MjAyNi0wNC0zMFQxMzowMDowMC4w..."
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs... (new)",
    "refreshToken": "v1.MjAyNi0wNC0zMFQx... (new)"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Kirim `refreshToken` ke Supabase Auth via `refreshSession()`
2. Jika gagal → `401 AUTH_REFRESH_TOKEN_INVALID`
3. Return **pasangan token baru** (access + refresh)

> ⚠️ **PENTING:** Setelah refresh, `refreshToken` yang lama TIDAK VALID lagi. Selalu simpan dan gunakan token terbaru.

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_REFRESH_TOKEN_INVALID` | Refresh token invalid atau expired |

### Kriteria Berhasil ✅

- [x] Response berisi `accessToken` dan `refreshToken` baru
- [x] Token lama tidak bisa dipakai lagi
- [x] Token baru valid untuk endpoint protected

---

## 5. POST `/auth/logout` — Logout (Invalidate Session)

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `Authorization` | ✅ | `Bearer eyJhbGciOiJIUzI1NiIs...` |

### Request Body

Tidak diperlukan (body kosong).

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Buat Supabase client baru dengan token user
2. Panggil `signOut({ scope: 'local' })` — invalidate session saat ini
3. Best-effort: jika gagal, tetap return success (logout tidak boleh gagal)

### Kriteria Berhasil ✅

- [x] Response `200` dengan message "Logged out successfully"
- [x] Token yang dipakai TIDAK bisa dipakai lagi setelah logout

---

## 6. POST `/auth/revoke-all` — Revoke Semua Session

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Headers

| Header | Wajib | Contoh |
|---|---|---|
| `Authorization` | ✅ | `Bearer eyJhbGciOiJIUzI1NiIs...` |

### Request Body

Tidak diperlukan (body kosong).

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "All sessions revoked"
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

1. Lookup user internal berdasarkan JWT userId
2. Panggil Supabase Admin REST API untuk delete semua auth factors
3. Best-effort: jika gagal, tetap return success

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `401` | `AUTH_USER_NOT_FOUND` | User tidak ditemukan |

### Kriteria Berhasil ✅

- [x] SEMUA session/token untuk user ini di-invalidate
- [x] User harus login ulang dari semua device

---

## Flow Diagram — Auth

```
┌─────────────┐     POST /auth/register     ┌────────────────┐
│  Mobile App  │ ─────────────────────────▶  │  ARISA Backend  │
│              │     { email, password }      │                 │
│              │ ◀───────────────────────── │  → Supabase Auth │
│              │     { user, tokens }        │  → DB Internal   │
│              │                             └────────────────┘
│              │     POST /auth/login
│              │ ─────────────────────────▶  Login flow ───▶ tokens
│              │
│              │     POST /auth/oauth/google
│              │ ─────────────────────────▶  OAuth flow ──▶ tokens
│              │
│              │     POST /auth/refresh
│              │ ─────────────────────────▶  Refresh ─────▶ new tokens
│              │
│              │     POST /auth/logout        (with Bearer token)
│              │ ─────────────────────────▶  Invalidate session
└─────────────┘
```
