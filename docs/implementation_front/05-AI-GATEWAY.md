# 🤖 Modul AI Gateway — Chat, Analyze, Vision & Streaming

> **Prefix:** `/api/v1/ai`  
> **Auth:** ✅ Bearer Token (semua endpoint)  
> **Rate Limit:** 10 request/menit, 100 request/jam per user

---

## Available Models

| Alias (gunakan ini) | Model ID | Provider | Context Window | Max Output | Capabilities |
|---|---|---|---|---|---|
| `gemini-flash` | `google/gemini-2.5-flash` | Google | 1,048,576 | 65,535 | chat, vision, streaming, tools, structured-output, reasoning |
| `claude-haiku` | `anthropic/claude-haiku-4.5` | Anthropic | 200,000 | 64,000 | chat, vision, streaming, tools, structured-output, reasoning |

> **Default model:** `gemini-flash`. Jika model utama gagal (retryable error), backend otomatis fallback ke `claude-haiku`.

---

## 1. POST `/ai/chat` — Chat dengan AI (Non-Streaming)

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `message` | `string` | ✅ | Max 32000 char | `"Apa penyebab daun padi menguning?"` |
| `model` | `string` | ❌ | `"gemini-flash"` atau `"claude-haiku"` | `"gemini-flash"` |
| `history` | `ChatMessageDto[]` | ❌ | Max 50 item | Lihat di bawah |
| `systemPrompt` | `string` | ❌ | Max 8000 char | `"Kamu adalah pakar pertanian."` |
| `maxTokens` | `number` | ❌ | 1 – 16384, default 4096 | `4096` |
| `temperature` | `number` | ❌ | 0 – 2, default 0.7 | `0.7` |
| `images` | `ImageInputDto[]` | ❌ | Max 5 images | Lihat di bawah |
| `responseFormat` | `string` | ❌ | `"text"` atau `"json"` | `"text"` |
| `jsonSchema` | `object` | ❌ | JSON Schema (hanya jika `responseFormat: "json"`) | `{ "type": "object", ... }` |
| `reasoning` | `ReasoningDto` | ❌ | Lihat di bawah | `{ "effort": "medium" }` |
| `enableWebSearch` | `boolean` | ❌ | default `false` | `true` |
| `deviceId` | `string (UUID)` | ❌ | UUID device | `"uuid-of-device"` |
| `includeIotContext` | `boolean` | ❌ | default `true` jika `deviceId` ada | `true` |

### Sub-DTO: ChatMessageDto (untuk `history`)

| Field | Type | Wajib | Deskripsi |
|---|---|---|---|
| `role` | `string` | ✅ | `"user"` atau `"assistant"` |
| `content` | `string` | ✅ | Isi pesan |

### Sub-DTO: ImageInputDto (untuk `images`)

| Field | Type | Wajib | Deskripsi |
|---|---|---|---|
| `type` | `string` | ✅ | `"url"` atau `"base64"` |
| `data` | `string` | ✅ | URL gambar atau data base64 |
| `mimeType` | `string` | ❌ | MIME type, default `"image/jpeg"` |

### Sub-DTO: ReasoningDto (untuk `reasoning`)

| Field | Type | Wajib | Deskripsi |
|---|---|---|---|
| `effort` | `string` | ❌ | `"xhigh"`, `"high"`, `"medium"`, `"low"`, `"minimal"`, `"none"` |
| `maxTokens` | `number` | ❌ | Min 1024, Max 128000. Override effort |
| `exclude` | `boolean` | ❌ | Jika `true`, AI tetap berpikir tapi reasoning tidak dikirim ke response |

### Contoh Request — Chat Sederhana

```json
{
  "message": "Apa penyebab daun padi menguning?"
}
```

### Contoh Request — Multi-turn dengan History

```json
{
  "message": "Bagaimana cara mengobatinya?",
  "model": "gemini-flash",
  "history": [
    { "role": "user", "content": "Daun padi saya menguning" },
    { "role": "assistant", "content": "Daun padi menguning bisa disebabkan oleh kekurangan nitrogen..." }
  ],
  "temperature": 0.5
}
```

### Contoh Request — Dengan Image (Vision)

```json
{
  "message": "Analisis gambar tanaman ini",
  "images": [
    {
      "type": "base64",
      "data": "/9j/4AAQSkZJRgABAQ...",
      "mimeType": "image/jpeg"
    }
  ]
}
```

### Contoh Request — Dengan IoT Context

```json
{
  "message": "Berdasarkan data sensor, apa yang harus saya lakukan?",
  "deviceId": "uuid-of-device",
  "includeIotContext": true,
  "reasoning": {
    "effort": "high"
  }
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "gen-abc123",
    "model": "google/gemini-2.5-flash",
    "content": "Daun padi menguning bisa disebabkan oleh beberapa faktor:\n\n1. **Kekurangan Nitrogen**...",
    "reasoning": "Saya perlu menganalisis kemungkinan penyebab...",
    "usage": {
      "promptTokens": 150,
      "completionTokens": 420,
      "totalTokens": 570,
      "cost": 0.0015
    },
    "durationMs": 2340
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `id` | `string` | ID generasi dari OpenRouter |
| `model` | `string` | Model ID yang dipakai (bisa fallback) |
| `content` | `string` | Jawaban AI |
| `reasoning` | `string \| null` | Proses berpikir AI (jika reasoning diaktifkan dan `exclude: false`) |
| `usage.promptTokens` | `number` | Jumlah token input |
| `usage.completionTokens` | `number` | Jumlah token output |
| `usage.totalTokens` | `number` | Total token |
| `usage.cost` | `number` | Estimasi biaya USD |
| `durationMs` | `number` | Durasi request dalam ms |

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `429` | `RATE_LIMIT_EXCEEDED` | Melebihi batas rate limit |
| `503` | `AI_QUOTA_EXCEEDED` | Kredit OpenRouter habis |
| `503` | `AI_PROVIDER_UNAVAILABLE` | API key invalid |
| `503` | `AI_REQUEST_FAILED` | Error lainnya dari provider |

### Kriteria Berhasil ✅

- [x] `content` berisi jawaban AI dalam Bahasa Indonesia
- [x] `usage` berisi statistik token
- [x] Request tersimpan di tabel `ai_requests`
- [x] Jika `deviceId` dikirim, data IoT sensor terbaru diinjeksikan ke system prompt

---

## 2. POST `/ai/chat/stream` — Chat dengan AI (Streaming SSE)

**Auth:** ✅ Bearer Token  
**Content-Type Response:** `text/event-stream`

### Request Body

Sama persis dengan `POST /ai/chat`.

### Response Format (Server-Sent Events)

```
data: {"type":"content","content":"Daun "}

data: {"type":"content","content":"padi "}

data: {"type":"content","content":"menguning "}

data: {"type":"content","content":"bisa "}

...

data: {"type":"usage","usage":{"promptTokens":150,"completionTokens":420,"totalTokens":570,"cost":0.0015}}

data: [DONE]
```

### Event Types

| Type | Deskripsi |
|---|---|
| `content` | Chunk teks dari AI, append ke output |
| `usage` | Statistik token (dikirim di akhir stream) |
| `error` | Error terjadi selama streaming |

### Cara Handle di Frontend

```javascript
const response = await fetch('/api/v1/ai/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: 'Halo ARISA' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullContent = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value, { stream: true });
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const parsed = JSON.parse(data);
      if (parsed.type === 'content') {
        fullContent += parsed.content;
        // Update UI secara real-time
      } else if (parsed.type === 'usage') {
        // Tampilkan statistik
      } else if (parsed.type === 'error') {
        // Handle error
      }
    }
  }
}
```

### Kriteria Berhasil ✅

- [x] Stream dimulai segera (teks muncul secara real-time)
- [x] Event `[DONE]` menandakan akhir stream
- [x] Usage dikirim setelah seluruh content selesai

---

## 3. POST `/ai/analyze` — Analisis Terstruktur (JSON Output)

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Request Body

| Field | Type | Wajib | Validasi | Contoh |
|---|---|---|---|---|
| `type` | `string` | ✅ | Tipe analisis | `"plant-disease"` |
| `payload` | `object` | ❌ | Data untuk dianalisis | `{ "ph": 6.5 }` |
| `images` | `ImageInputDto[]` | ❌ | Max 5 images | Lihat ChatDto |
| `model` | `string` | ❌ | Alias model | `"gemini-flash"` |
| `instructions` | `string` | ❌ | Max 4000 char | `"Fokus pada penyakit jamur"` |
| `deviceId` | `string (UUID)` | ❌ | Untuk inject IoT context | `"uuid-of-device"` |
| `reasoning` | `ReasoningDto` | ❌ | Control reasoning depth | `{ "effort": "high" }` |

### Tipe Analisis Tersedia

| Type | Deskripsi | Output JSON Keys |
|---|---|---|
| `plant-disease` | Identifikasi penyakit/hama tanaman | `disease`, `severity`, `cause`, `treatment`, `prevention` |
| `soil-analysis` | Analisis kondisi tanah | fertility, nutrient deficiency, fertilizer recommendation, pH |
| `crop-recommendation` | Rekomendasi tanaman | suitable crops, planting time, yield estimate, care needs |
| `weather-impact` | Analisis dampak cuaca | risks, preventive actions, affected crops, timeline |

### Contoh Request

```json
{
  "type": "plant-disease",
  "images": [
    {
      "type": "url",
      "data": "https://example.com/leaf-photo.jpg"
    }
  ],
  "instructions": "Ini adalah daun padi dari sawah saya di Jawa Barat",
  "deviceId": "uuid-of-device"
}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "id": "gen-xyz789",
    "model": "google/gemini-2.5-flash",
    "type": "plant-disease",
    "result": {
      "disease": "Blast (Pyricularia oryzae)",
      "severity": "sedang",
      "cause": "Kelembapan tinggi dan suhu optimal untuk jamur (25-28°C)",
      "treatment": [
        "Aplikasikan fungisida berbahan aktif Tricyclazole",
        "Kurangi kepadatan tanaman"
      ],
      "prevention": [
        "Gunakan varietas tahan blast",
        "Atur jarak tanam yang tepat",
        "Hindari pemupukan nitrogen berlebihan"
      ]
    },
    "usage": {
      "promptTokens": 800,
      "completionTokens": 350,
      "totalTokens": 1150,
      "cost": 0.005
    },
    "durationMs": 3200
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Perilaku Internal

- Temperature rendah (`0.3`) untuk output terstruktur
- `response_format: json_object` dipaksa agar output selalu JSON
- Plugin `response-healing` aktif untuk auto-repair broken JSON
- Jika `deviceId` dikirim, 5 session IoT terakhir diinjeksikan ke system prompt
- Jika JSON parsing gagal, dikembalikan sebagai `{ "raw": "...", "parseError": true }`

### Kriteria Berhasil ✅

- [x] `result` berisi JSON terstruktur sesuai tipe analisis
- [x] Jika `images` dikirim, gambar dianalisis oleh AI
- [x] Data IoT context memperkaya jawaban AI

---

## 4. POST `/ai/vision` — Image Analysis via AI Vision

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Request Body

Sama dengan `POST /ai/analyze`. Jika `type` tidak diisi, default ke `"plant-disease"`.  
Jika `images` kosong, array kosong akan digunakan (tetap diproses).

### Perilaku Internal

- Endpoint ini adalah shortcut untuk `analyze` dengan fokus vision
- Secara internal memanggil `AiGatewayService.analyze()`

### Kriteria Berhasil ✅

- [x] Sama dengan `/ai/analyze` — output JSON terstruktur
- [x] Cocok dipakai untuk quick image analysis tanpa banyak parameter

---

## 5. GET `/ai/history` — Riwayat Request AI (Paginated)

**Auth:** ✅ Bearer Token  
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
      "requestType": "chat",
      "provider": "openrouter",
      "status": "completed",
      "durationMs": 2340,
      "tokenUsage": {
        "prompt_tokens": 150,
        "completion_tokens": 420,
        "total_tokens": 570,
        "cost": 0.0015
      },
      "createdAt": "2026-04-30T13:00:00.000Z"
    }
  ],
  "meta": {
    "requestId": "uuid",
    "timestamp": "...",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

### Request Types

| requestType | Deskripsi |
|---|---|
| `chat` | Chat non-streaming |
| `chat_stream` | Chat streaming |
| `analyze_plant-disease` | Analisis penyakit tanaman |
| `analyze_soil-analysis` | Analisis tanah |
| `analyze_crop-recommendation` | Rekomendasi tanaman |
| `analyze_weather-impact` | Analisis dampak cuaca |

### Kriteria Berhasil ✅

- [x] Menampilkan semua request AI milik user yang login
- [x] Terbaru dulu (descending by `createdAt`)

---

## 6. GET `/ai/usage` — Ringkasan Penggunaan Token

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "totalRequests": 50,
    "failedRequests": 2,
    "totalPromptTokens": 25000,
    "totalCompletionTokens": 45000,
    "totalTokens": 70000,
    "estimatedCost": 0.35
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Response Fields

| Field | Type | Deskripsi |
|---|---|---|
| `totalRequests` | `number` | Total semua request AI |
| `failedRequests` | `number` | Jumlah request yang gagal |
| `totalPromptTokens` | `number` | Total token input |
| `totalCompletionTokens` | `number` | Total token output |
| `totalTokens` | `number` | Gabungan input + output |
| `estimatedCost` | `number` | Estimasi biaya USD |

### Kriteria Berhasil ✅

- [x] Angka-angka akurat berdasarkan data di tabel `ai_requests`

---

## 7. GET `/ai/credits` — Cek Sisa Kredit OpenRouter (Admin Only)

**Auth:** ✅ Bearer Token + Role `ADMIN` atau `SUPER_ADMIN`  
**HTTP Status:** `200 OK`

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "remaining": 45.67,
    "limit": 100.00,
    "usage": 54.33
  },
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Error Responses

| Status | Error Code | Kondisi |
|---|---|---|
| `403` | `AUTH_FORBIDDEN` | User bukan admin |

---

## 8. GET `/ai/models` — List Model yang Tersedia

**Auth:** ✅ Bearer Token  
**HTTP Status:** `200 OK`

### Success Response (200)

```json
{
  "success": true,
  "data": [
    {
      "alias": "gemini-flash",
      "id": "google/gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "provider": "Google",
      "contextWindow": 1048576,
      "maxOutput": 65535,
      "inputPrice": 0.30,
      "outputPrice": 2.50,
      "capabilities": ["chat", "vision", "streaming", "tools", "structured-output", "reasoning"]
    },
    {
      "alias": "claude-haiku",
      "id": "anthropic/claude-haiku-4.5",
      "name": "Claude Haiku 4.5",
      "provider": "Anthropic",
      "contextWindow": 200000,
      "maxOutput": 64000,
      "inputPrice": 1.00,
      "outputPrice": 5.00,
      "capabilities": ["chat", "vision", "streaming", "tools", "structured-output", "reasoning"]
    }
  ],
  "meta": { "requestId": "uuid", "timestamp": "..." }
}
```

### Kriteria Berhasil ✅

- [x] List model lengkap dengan harga dan capabilities
- [x] Frontend bisa render model selector berdasarkan data ini

---

## Fitur Tambahan: IoT Context Injection

Ketika `deviceId` dikirim pada request chat atau analyze, backend otomatis:

1. Query 5 `SessionSummary` terakhir dari device tersebut
2. Inject sebagai konteks tambahan di system prompt:
   ```
   --- DATA LAHAN TERBARU (dari sensor IoT) ---
   [Sesi 1 — 30 April 2026, 14:30, 250 data point]
   Suhu rata-rata 32°C, kelembapan 78%, tanah lembap...
   Metrik: {"avgTemp": 32, "avgHumidity": 78, ...}
   Alerts: [{"type": "high_temp", "severity": "warning"}]
   Rekomendasi Edge: ["Penyiraman perlu dikurangi"]
   ```
3. AI akan menjawab berdasarkan data sensor real + pertanyaan user

> Ini membuat ARISA menjadi context-aware terhadap kondisi lahan nyata.

---

## Appendix A: Default System Prompt

Jika `systemPrompt` tidak dikirim di request, backend menggunakan prompt berikut:

```
Kamu adalah ARISA (Agricultural Resource & Intelligence System Assistant),
asisten AI cerdas untuk pertanian Indonesia.

Tugasmu:
- Membantu petani dengan informasi pertanian yang akurat
- Menganalisis kondisi tanaman dari gambar
- Memberikan rekomendasi berdasarkan data sensor dan kondisi lingkungan
- Menjawab dalam Bahasa Indonesia yang mudah dipahami
- Jika diminta analisis gambar, berikan detail yang spesifik dan actionable

Selalu berikan jawaban yang praktis, ilmiah, dan sesuai konteks pertanian Indonesia.
```

> **Catatan:** Jika `systemPrompt` dikirim, prompt default TIDAK digunakan — sepenuhnya digantikan oleh prompt custom.

---

## Appendix B: Analysis Prompts (per Tipe)

Setiap tipe analisis memiliki system prompt template yang berbeda:

### `plant-disease`

```
Analisis gambar/data tanaman berikut dan identifikasi:
1. Jenis penyakit atau hama (jika ada)
2. Tingkat keparahan (ringan/sedang/berat)
3. Penyebab yang mungkin
4. Rekomendasi penanganan
5. Tindakan pencegahan

Berikan jawaban dalam format JSON dengan key: disease, severity, cause, treatment, prevention.
```

### `soil-analysis`

```
Analisis data tanah berikut dan berikan:
1. Kondisi kesuburan tanah
2. Kekurangan nutrisi (jika ada)
3. Rekomendasi pemupukan
4. pH optimal untuk tanaman terkait

Berikan jawaban dalam format JSON.
```

### `crop-recommendation`

```
Berdasarkan data lingkungan berikut, rekomendasikan:
1. Tanaman yang cocok untuk ditanam
2. Waktu tanam optimal
3. Estimasi hasil panen
4. Kebutuhan perawatan

Berikan jawaban dalam format JSON.
```

### `weather-impact`

```
Analisis dampak kondisi cuaca berikut terhadap pertanian:
1. Risiko yang mungkin terjadi
2. Tindakan preventif
3. Tanaman yang terpengaruh
4. Timeline risiko

Berikan jawaban dalam format JSON.
```

> Tipe selain 4 di atas → fallback ke prompt `plant-disease`.

---

## Appendix C: Web Search (Server Tool)

Ketika `enableWebSearch: true`, backend menambahkan **OpenRouter Server Tool** ke request:

```json
{
  "tools": [
    { "type": "openrouter:web_search" }
  ]
}
```

### Cara Kerja

1. AI akan **otomatis memutuskan** apakah perlu melakukan web search berdasarkan pertanyaan
2. Pencarian dilakukan **di sisi server** oleh OpenRouter — BUKAN di client
3. Hasil pencarian diinjeksi ke konteks AI sebelum menjawab
4. Frontend **tidak perlu melakukan apa-apa** — web search sepenuhnya transparan

### Kapan Berguna

- Pertanyaan tentang harga komoditas terkini
- Cuaca terbaru di wilayah tertentu
- Informasi terbaru tentang hama/penyakit
- Data peraturan pemerintah tentang pertanian

> ⚠️ **Catatan:** Web search menambah latency ±2-5 detik ke response. Hanya aktifkan jika user membutuhkan informasi terkini.

---

## Appendix D: Fallback Model & Error Handling

### Non-Streaming (POST `/ai/chat` dan `/ai/analyze`)

```
Request ke model utama (gemini-flash)
  → Sukses? Return response
  → Error retryable (429, 502, 503)? ─→ Retry ke fallback (claude-haiku)
  → Error non-retryable (401, 400)? ─→ Langsung throw error ke client
```

### Streaming (POST `/ai/chat/stream`)

```
Request streaming ke model utama
  → Sukses? Stream chunks ke client
  → Error? ─→ Kirim event error ke client
             ─→ TIDAK ada auto-fallback untuk stream
```

> ⚠️ **PENTING:** Streaming **TIDAK** memiliki auto-fallback. Jika model utama gagal saat streaming, frontend akan menerima event `error`. Frontend harus **retry manual** dengan parameter `model: "claude-haiku"` jika diperlukan.

### Retryable Error Codes (dari OpenRouter)

| HTTP Status | Deskripsi | Retryable? |
|---|---|---|
| `429` | Rate limit dari provider | ✅ Ya |
| `502` | Bad gateway | ✅ Ya |
| `503` | Service unavailable | ✅ Ya |
| `401` | API key invalid | ❌ Tidak |
| `402` | Credit habis | ❌ Tidak |
| `400` | Bad request | ❌ Tidak |

---

## Appendix E: Rate Limiting

### Batas Default

| Metric | Limit | Configurable via |
|---|---|---|
| Per menit per user | 10 request | `AI_USER_RATE_LIMIT_PER_MINUTE` |
| Per jam per user | 100 request | `AI_USER_RATE_LIMIT_PER_HOUR` |

### Mekanisme

1. **Primary:** Redis — counter per userId dengan TTL 60 detik
2. **Fallback:** In-memory Map — jika Redis tidak tersedia (graceful degradation)

### Error Response saat Rate Limited

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "RATE_LIMIT_EXCEEDED",
    "userMessage": "Terlalu banyak permintaan. Tunggu sebentar.",
    "statusCode": 429
  }
}
```

### Tips Frontend

- Tampilkan cooldown timer saat menerima `429`
- Implementasi exponential backoff: tunggu 5s → 10s → 20s
- Disable tombol "Kirim" sementara saat cooldown

---

## Appendix F: Timeout & Token Limits

### Timeout

| Setting | Default | Env Variable |
|---|---|---|
| Request timeout | 30 detik | `OPENROUTER_TIMEOUT_MS` |

Jika AI tidak merespons dalam 30 detik, request di-abort dan error `408` dikembalikan.

### Token Limits

| Setting | DTO Validation | Actual Server Cap | Env Variable |
|---|---|---|---|
| `maxTokens` (chat) | Min 1, Max 16384 | Cap di `min(dto.maxTokens, config.maxTokens)` | `OPENROUTER_MAX_TOKENS` (default: 8192) |
| `maxTokens` (analyze) | — | Langsung menggunakan `config.maxTokens` (8192) | `OPENROUTER_MAX_TOKENS` |

> ⚠️ Meskipun DTO mengizinkan `maxTokens: 16384`, server memotong ke **8192** (default config). Jadi `maxTokens` > 8192 tidak efektif kecuali admin mengubah env.

---

## Appendix G: Streaming Response — Detail Teknis

### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Event Format Lengkap

Setiap event dikirim dalam format SSE standar:

```
data: {json}\n\n
```

### Event Types Detail

#### 1. Content Event

```json
{"type": "content", "content": "Daun padi menguning bisa "}
```

- Dikirim berkali-kali — **append** setiap `content` ke string output
- Bisa berisi kata parsial atau beberapa kata sekaligus

#### 2. Usage Event

```json
{
  "type": "usage",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 420,
    "totalTokens": 570,
    "cost": 0.0015
  }
}
```

- Dikirim **SATU KALI** di akhir stream (sebelum `[DONE]`)
- Bisa juga tidak dikirim jika provider tidak mengembalikan usage

#### 3. Error Event

```json
{"type": "error", "error": "Rate limit exceeded"}
```

- Dikirim jika terjadi error selama streaming
- Setelah error, stream akan di-close (`[DONE]` mungkin tidak dikirim)

#### 4. Done Signal

```
data: [DONE]
```

- **BUKAN JSON** — ini literal string `[DONE]`
- Menandakan akhir stream, tidak ada data lagi setelah ini

### Flutter/Dart SSE Client Example

```dart
final request = http.Request('POST', Uri.parse('$baseUrl/ai/chat/stream'))
  ..headers.addAll({
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  })
  ..body = jsonEncode({'message': 'Halo ARISA'});

final response = await http.Client().send(request);
String fullContent = '';

await for (final chunk in response.stream.transform(utf8.decoder)) {
  for (final line in chunk.split('\n')) {
    if (line.startsWith('data: ')) {
      final data = line.substring(6);
      if (data == '[DONE]') break;

      final parsed = jsonDecode(data);
      if (parsed['type'] == 'content') {
        fullContent += parsed['content'];
        // setState(() => _aiResponse = fullContent);
      } else if (parsed['type'] == 'usage') {
        // Handle usage stats
      } else if (parsed['type'] == 'error') {
        // Handle error
      }
    }
  }
}
```

### React Native / Expo SSE Client Example

```javascript
import EventSource from 'react-native-sse';

// Untuk POST-based SSE, gunakan fetch + ReadableStream:
const response = await fetch(`${BASE_URL}/ai/chat/stream`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: 'Halo ARISA' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content') {
          setResponse(prev => prev + parsed.content);
        }
      } catch (e) {
        // Skip unparseable lines
      }
    }
  }
}
```

---

## Appendix H: Tool Calls (OpenRouter)

Backend mendukung **OpenRouter Tool Calls** pada level transport (OpenRouter Client). Saat ini digunakan untuk:

### Server Tools (dikelola OpenRouter)

| Tool | Identifier | Diaktifkan via |
|---|---|---|
| Web Search | `openrouter:web_search` | `enableWebSearch: true` |

### Function Tools (didefinisikan di backend)

OpenRouter Client mendukung custom function tools melalui interface:

```typescript
interface OpenRouterFunctionToolDef {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: object; // JSON Schema
  };
}
```

> **Status saat ini:** Function tools BELUM di-expose ke frontend. Ini adalah fitur internal untuk future use (misalnya: query database, IoT command execution, dll). Endpoint API saat ini hanya menggunakan `openrouter:web_search` sebagai server tool.

### Bagaimana Tool Calls Muncul di Response

Untuk **non-streaming**, tool calls ditangani secara internal oleh OpenRouter (server tool) — frontend menerima hasil akhir langsung.

Untuk **streaming**, jika AI melakukan web search:
1. AI mengirimkan content chunks seperti biasa
2. Mungkin ada jeda saat AI melakukan pencarian (~2-5 detik tanpa content event)
3. Content dilanjutkan setelah pencarian selesai
4. Frontend tidak perlu menangani tool_calls secara eksplisit

---

## Appendix I: Response Healing (Analyze only)

Pada endpoint `POST /ai/analyze`, backend menambahkan plugin:

```json
{
  "plugins": [{ "id": "response-healing" }]
}
```

Plugin ini otomatis memperbaiki JSON yang rusak dari AI (missing brackets, trailing comma, dll).

**Jika JSON masih tidak bisa di-parse setelah healing:**

```json
{
  "result": {
    "raw": "... raw text from AI ...",
    "parseError": true
  }
}
```

Frontend harus cek `result.parseError === true` dan menampilkan fallback UI.
