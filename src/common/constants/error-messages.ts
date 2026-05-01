/**
 * Pesan error dalam Bahasa Indonesia yang mudah dipahami.
 * Ditampilkan ke pengguna (petani) di aplikasi mobile.
 *
 * Error codes (error-codes.ts) tetap dipakai untuk logika program,
 * sedangkan pesan ini untuk tampilan ke pengguna akhir.
 */
import { ErrorCode } from './error-codes';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // ─── Auth ───────────────────────────────────────────────
  [ErrorCode.AUTH_EMAIL_EXISTS]:
    'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]:
    'Email atau kata sandi salah. Coba periksa lagi ya.',
  [ErrorCode.AUTH_TOKEN_MISSING]:
    'Anda belum masuk. Silakan masuk terlebih dahulu.',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Sesi Anda tidak valid. Silakan masuk ulang.',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Sesi Anda sudah habis. Silakan masuk ulang.',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]:
    'Sesi Anda sudah kadaluarsa. Silakan masuk ulang.',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'Anda tidak punya izin untuk melakukan ini.',
  [ErrorCode.AUTH_FORBIDDEN]: 'Maaf, akses ini hanya untuk admin.',
  [ErrorCode.AUTH_ACCOUNT_SUSPENDED]:
    'Akun Anda ditangguhkan. Hubungi admin untuk bantuan.',
  [ErrorCode.AUTH_USER_NOT_FOUND]: 'Pengguna tidak ditemukan.',

  // ─── Device ─────────────────────────────────────────────
  [ErrorCode.DEVICE_NOT_FOUND]:
    'Perangkat tidak ditemukan. Pastikan perangkat sudah terdaftar.',
  [ErrorCode.DEVICE_ALREADY_PAIRED]:
    'Perangkat ini sudah terhubung dengan akun Anda.',
  [ErrorCode.DEVICE_PAIRING_CODE_INVALID]:
    'Kode pairing salah. Cek kembali kode di layar perangkat.',
  [ErrorCode.DEVICE_PAIRING_CODE_EXPIRED]:
    'Kode pairing sudah kadaluarsa. Minta kode baru dari perangkat.',
  [ErrorCode.DEVICE_TOKEN_MISSING]: 'Perangkat belum terautentikasi.',
  [ErrorCode.DEVICE_TOKEN_INVALID]:
    'Token perangkat tidak valid. Daftarkan ulang perangkat.',
  [ErrorCode.DEVICE_SERIAL_MISSING]: 'Nomor seri perangkat tidak ditemukan.',
  [ErrorCode.DEVICE_DISABLED]:
    'Perangkat ini sudah dinonaktifkan. Hubungi admin.',
  [ErrorCode.DEVICE_REVOKED]: 'Perangkat ini sudah dicabut aksesnya.',
  [ErrorCode.DEVICE_REGISTRATION_SECRET_INVALID]:
    'Kunci registrasi perangkat salah. Hubungi admin.',
  [ErrorCode.DEVICE_SERIAL_EXISTS]:
    'Perangkat dengan nomor seri ini sudah terdaftar.',

  // ─── Sync ───────────────────────────────────────────────
  [ErrorCode.SYNC_DUPLICATE_REQUEST]:
    'Data ini sudah pernah dikirim sebelumnya.',
  [ErrorCode.SYNC_PAYLOAD_INVALID]:
    'Data yang dikirim tidak valid. Periksa format data.',
  [ErrorCode.SYNC_JOB_NOT_FOUND]: 'Tugas sinkronisasi tidak ditemukan.',
  [ErrorCode.SYNC_BATCH_TOO_LARGE]:
    'Terlalu banyak data sekaligus. Kirim maksimal 100 data per batch.',
  [ErrorCode.SYNC_CONFLICT]: 'Ada konflik data. Data terbaru yang dipakai.',
  [ErrorCode.SYNC_OWNERSHIP_MISMATCH]: 'Perangkat ini bukan milik Anda.',

  // ─── Data ───────────────────────────────────────────────
  [ErrorCode.DATA_NOT_FOUND]: 'Data tidak ditemukan.',
  [ErrorCode.DATA_OWNERSHIP_DENIED]: 'Anda tidak punya akses ke data ini.',

  // ─── Notification ───────────────────────────────────────
  [ErrorCode.NOTIFICATION_NOT_FOUND]: 'Notifikasi tidak ditemukan.',

  // ─── AI ─────────────────────────────────────────────────
  [ErrorCode.AI_PROVIDER_UNAVAILABLE]:
    'Layanan AI sedang tidak tersedia. Coba lagi nanti.',
  [ErrorCode.AI_QUOTA_EXCEEDED]:
    'Kuota AI sudah habis. Hubungi admin untuk penambahan.',
  [ErrorCode.AI_REQUEST_FAILED]: 'Gagal memproses permintaan AI. Coba lagi.',

  // ─── Weather ─────────────────────────────────────────────
  [ErrorCode.WEATHER_API_NOT_CONFIGURED]:
    'Layanan cuaca belum dikonfigurasi. Hubungi admin.',
  [ErrorCode.WEATHER_FETCH_FAILED]:
    'Gagal mengambil data cuaca. Coba lagi nanti.',
  [ErrorCode.WEATHER_API_UNAUTHORIZED]:
    'API cuaca tidak valid. Hubungi admin.',
  [ErrorCode.WEATHER_RATE_LIMITED]:
    'Terlalu banyak permintaan cuaca. Coba lagi nanti.',
  [ErrorCode.WEATHER_INVALID_COORDINATES]:
    'Koordinat tidak valid. Gunakan angka untuk lat dan lon.',
  [ErrorCode.WEATHER_MISSING_PARAMS]:
    'Berikan sawah_id atau kombinasi lat+lon.',

  // ─── Sawah ───────────────────────────────────────────────
  [ErrorCode.SAWAH_NOT_FOUND]: 'Sawah tidak ditemukan.',
  [ErrorCode.SAWAH_OWNERSHIP_DENIED]:
    'Anda tidak punya akses ke sawah ini.',

  // ─── System ─────────────────────────────────────────────
  [ErrorCode.SYSTEM_INTERNAL_ERROR]:
    'Terjadi kesalahan sistem. Coba lagi nanti.',
  [ErrorCode.SYSTEM_SERVICE_UNAVAILABLE]:
    'Layanan sedang tidak tersedia. Coba lagi nanti.',
  [ErrorCode.VALIDATION_ERROR]:
    'Data yang dimasukkan tidak sesuai. Periksa kembali.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]:
    'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Data yang dicari tidak ditemukan.',
  [ErrorCode.RESOURCE_CONFLICT]: 'Data sudah ada. Tidak bisa membuat duplikat.',
};
