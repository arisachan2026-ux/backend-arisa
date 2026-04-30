# ⚠️ Error Codes — Referensi Lengkap

> Semua error code yang mungkin dikembalikan oleh ARISA Cloud Backend.  
> Gunakan field `error.code` untuk menangani error secara programmatic.

---

## Format Error Response

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid login credentials",
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

| Field | Deskripsi |
|---|---|
| `error.code` | Kode error untuk penanganan programmatic |
| `error.message` | Pesan teknis (untuk debugging/developer) |
| `error.userMessage` | Pesan Bahasa Indonesia (untuk ditampilkan ke pengguna akhir) |
| `error.statusCode` | HTTP status code |

---

## Auth Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `AUTH_EMAIL_EXISTS` | `409` | "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain." | Tampilkan userMessage, arahkan ke login |
| `AUTH_INVALID_CREDENTIALS` | `401` | "Email atau kata sandi salah. Coba periksa lagi ya." | Tampilkan userMessage |
| `AUTH_TOKEN_MISSING` | `401` | "Anda belum masuk. Silakan masuk terlebih dahulu." | Redirect ke halaman login |
| `AUTH_TOKEN_INVALID` | `401` | "Sesi Anda tidak valid. Silakan masuk ulang." | Coba refresh token → jika gagal, redirect ke login |
| `AUTH_TOKEN_EXPIRED` | `401` | "Sesi Anda sudah habis. Silakan masuk ulang." | Coba refresh token |
| `AUTH_REFRESH_TOKEN_INVALID` | `401` | "Sesi Anda sudah kadaluarsa. Silakan masuk ulang." | Redirect ke login (user harus login ulang) |
| `AUTH_UNAUTHORIZED` | `401` | "Anda tidak punya izin untuk melakukan ini." | Redirect ke login |
| `AUTH_FORBIDDEN` | `403` | "Maaf, akses ini hanya untuk admin." | Tampilkan userMessage |
| `AUTH_ACCOUNT_SUSPENDED` | `403` | "Akun Anda ditangguhkan. Hubungi admin untuk bantuan." | Tampilkan blocked screen |
| `AUTH_USER_NOT_FOUND` | `404` | "Pengguna tidak ditemukan." | Tampilkan userMessage |

---

## Device Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `DEVICE_NOT_FOUND` | `404` / `401` | "Perangkat tidak ditemukan. Pastikan perangkat sudah terdaftar." | Tampilkan userMessage |
| `DEVICE_ALREADY_PAIRED` | `409` | "Perangkat ini sudah terhubung dengan akun Anda." | Tampilkan userMessage |
| `DEVICE_PAIRING_CODE_INVALID` | `403` | "Kode pairing salah. Cek kembali kode di layar perangkat." | Tampilkan userMessage |
| `DEVICE_PAIRING_CODE_EXPIRED` | `410` | "Kode pairing sudah kadaluarsa. Minta kode baru dari perangkat." | Tampilkan userMessage + tombol "Buat Kode Baru" |
| `DEVICE_TOKEN_MISSING` | `401` | "Perangkat belum terautentikasi." | (Pi internal) |
| `DEVICE_TOKEN_INVALID` | `401` | "Token perangkat tidak valid. Daftarkan ulang perangkat." | (Pi internal) |
| `DEVICE_SERIAL_MISSING` | `401` | "Nomor seri perangkat tidak ditemukan." | (Pi internal) |
| `DEVICE_DISABLED` | `403` | "Perangkat ini sudah dinonaktifkan. Hubungi admin." | Tampilkan userMessage |
| `DEVICE_REVOKED` | `403` | "Perangkat ini sudah dicabut aksesnya." | Tampilkan userMessage |
| `DEVICE_REGISTRATION_SECRET_INVALID` | `401` | "Kunci registrasi perangkat salah. Hubungi admin." | (Pi internal) |
| `DEVICE_SERIAL_EXISTS` | `409` | "Perangkat dengan nomor seri ini sudah terdaftar." | (Pi internal) |

---

## Sync Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `SYNC_DUPLICATE_REQUEST` | — | "Data ini sudah pernah dikirim sebelumnya." | Aman — tidak perlu ditangani |
| `SYNC_PAYLOAD_INVALID` | `400` | "Data yang dikirim tidak valid. Periksa format data." | (Pi internal) |
| `SYNC_JOB_NOT_FOUND` | `404` | "Tugas sinkronisasi tidak ditemukan." | (Pi internal) |
| `SYNC_BATCH_TOO_LARGE` | `400` | "Terlalu banyak data sekaligus. Kirim maksimal 100 data per batch." | (Pi internal) |
| `SYNC_CONFLICT` | — | "Ada konflik data. Data terbaru yang dipakai." | Ditangani otomatis oleh LWW |
| `SYNC_OWNERSHIP_MISMATCH` | `400` | "Perangkat ini bukan milik Anda." | (Pi internal) |

---

## Data Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `DATA_NOT_FOUND` | `404` | "Data tidak ditemukan." | Tampilkan userMessage |
| `DATA_OWNERSHIP_DENIED` | `403` | "Anda tidak punya akses ke data ini." | Tampilkan userMessage |

---

## Notification Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `NOTIFICATION_NOT_FOUND` | `404` | "Notifikasi tidak ditemukan." | Abaikan (mungkin sudah dihapus) |

---

## AI Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `AI_PROVIDER_UNAVAILABLE` | `503` | "Layanan AI sedang tidak tersedia. Coba lagi nanti." | Tampilkan userMessage + tombol retry |
| `AI_QUOTA_EXCEEDED` | `503` | "Kuota AI sudah habis. Hubungi admin untuk penambahan." | Tampilkan userMessage + disable AI features |
| `AI_REQUEST_FAILED` | `503` | "Gagal memproses permintaan AI. Coba lagi." | Tampilkan userMessage + tombol retry |

---

## System Errors

| Code | HTTP Status | `userMessage` (Bahasa Indonesia) | Penanganan di Frontend |
|---|---|---|---|
| `SYSTEM_INTERNAL_ERROR` | `500` | "Terjadi kesalahan sistem. Coba lagi nanti." | Tampilkan userMessage |
| `SYSTEM_SERVICE_UNAVAILABLE` | `503` | "Layanan sedang tidak tersedia. Coba lagi nanti." | Tampilkan userMessage |
| `VALIDATION_ERROR` | `400` | "Data yang dimasukkan tidak sesuai. Periksa kembali." | Tampilkan `error.message` (lebih detail) |
| `RATE_LIMIT_EXCEEDED` | `429` | "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." | Implement exponential backoff |
| `RESOURCE_NOT_FOUND` | `404` | "Data yang dicari tidak ditemukan." | Tampilkan userMessage |
| `RESOURCE_CONFLICT` | `409` | "Data sudah ada. Tidak bisa membuat duplikat." | Tampilkan userMessage |

---

## Best Practices untuk Frontend

### 1. Token Refresh Flow

```
Request gagal dengan AUTH_TOKEN_EXPIRED/AUTH_TOKEN_INVALID
  → Coba POST /auth/refresh dengan refreshToken
    → Berhasil? Simpan token baru, retry request awal
    → Gagal (AUTH_REFRESH_TOKEN_INVALID)? Redirect ke login
```

### 2. Error Handling Pattern

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!data.success) {
    const { code, userMessage } = data.error;

    switch (code) {
      case 'AUTH_TOKEN_EXPIRED':
      case 'AUTH_TOKEN_INVALID':
        // Coba refresh
        const refreshed = await refreshToken();
        if (refreshed) return apiRequest(url, options); // Retry
        return redirectToLogin();

      case 'AUTH_ACCOUNT_SUSPENDED':
        return showBlockedScreen();

      case 'RATE_LIMIT_EXCEEDED':
        await sleep(5000); // Wait 5 seconds
        return apiRequest(url, options); // Retry

      default:
        // Tampilkan userMessage ke user
        showToast(userMessage);
    }
  }

  return data;
}
```

### 3. Offline / Network Error

Jika `fetch` gagal (network error), tampilkan:  
**"Tidak ada koneksi internet. Periksa jaringan Anda."**

### 4. HTTP Status Code Quick Reference

| Status | Artinya |
|---|---|
| `200` | OK — request berhasil |
| `201` | Created — resource baru dibuat |
| `202` | Accepted — request diterima, diproses async |
| `400` | Bad Request — input tidak valid |
| `401` | Unauthorized — token missing/invalid |
| `403` | Forbidden — tidak punya akses |
| `404` | Not Found — resource tidak ditemukan |
| `409` | Conflict — duplikat atau konflik |
| `410` | Gone — resource sudah expired |
| `429` | Too Many Requests — rate limited |
| `500` | Internal Server Error — bug di server |
| `503` | Service Unavailable — dependency down |
