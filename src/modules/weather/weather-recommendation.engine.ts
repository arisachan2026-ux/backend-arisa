import { Injectable } from '@nestjs/common';
import { RekomendasiResponse, CuacaSekarangResponse, PrakiraanHarianResponse } from './dto/weather.dto';

/**
 * Rule-based recommendation engine for rice paddy farming.
 *
 * Evaluates current weather + forecast and produces
 * actionable recommendations in Bahasa Indonesia.
 * Rules are calibrated for tropical lowland rice farming (sawah).
 */
@Injectable()
export class WeatherRecommendationEngine {
  /**
   * Analyze current + forecast data and generate recommendations.
   */
  generateRecommendations(
    current: CuacaSekarangResponse,
    forecast: PrakiraanHarianResponse[],
  ): RekomendasiResponse[] {
    const recommendations: RekomendasiResponse[] = [];

    // ─── Current weather rules ────────────────────────────
    this.evaluateRain(current, recommendations);
    this.evaluateHumidity(current, recommendations);
    this.evaluateTemperatureAndUV(current, recommendations);
    this.evaluateWind(current, recommendations);
    this.evaluateExtremeHeat(current, recommendations);
    this.evaluateExtremeCold(current, recommendations);
    this.evaluateVisibility(current, recommendations);

    // ─── Forecast-based rules ─────────────────────────────
    this.evaluateForecastRain(forecast, recommendations);
    this.evaluateForecastDrought(forecast, recommendations);

    // If no issues found, give positive feedback
    if (recommendations.length === 0) {
      recommendations.push({
        tingkat: 'info',
        kategori: 'kondisi_baik',
        pesan: 'Kondisi cuaca saat ini baik untuk aktivitas pertanian.',
        detail: 'Tidak ada peringatan cuaca. Lanjutkan kegiatan pertanian seperti biasa.',
      });
    }

    return recommendations;
  }

  // ─── Rule implementations ────────────────────────────────

  private evaluateRain(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    const rainMm = current.curah_hujan_1jam ?? 0;
    const kondisi = current.kondisi.toLowerCase();
    const isRaining = kondisi.includes('rain') || kondisi.includes('hujan') || kondisi.includes('drizzle') || kondisi.includes('gerimis');

    if (rainMm > 7.5 || kondisi.includes('heavy') || kondisi.includes('lebat')) {
      recs.push({
        tingkat: 'bahaya',
        kategori: 'hujan_lebat',
        pesan: 'Hujan lebat terdeteksi. Tunda semua aktivitas lapangan.',
        detail: `Curah hujan: ${rainMm} mm/jam. Tunda pemupukan, penyemprotan pestisida, dan panen. Pastikan saluran drainase sawah berfungsi baik untuk mencegah genangan berlebih.`,
      });
    } else if (rainMm > 2.5 || isRaining) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'hujan_sedang',
        pesan: 'Sedang hujan — tunda pemupukan dan penyemprotan.',
        detail: `Curah hujan: ${rainMm} mm/jam. Pupuk dan pestisida akan tercuci jika diaplikasikan saat hujan. Tunggu minimal 2 jam setelah hujan berhenti.`,
      });
    }
  }

  private evaluateHumidity(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    if (current.kelembapan >= 90) {
      recs.push({
        tingkat: 'bahaya',
        kategori: 'kelembapan_sangat_tinggi',
        pesan: 'Kelembapan sangat tinggi — risiko penyakit jamur tinggi!',
        detail: `Kelembapan: ${current.kelembapan}%. Periksa tanaman untuk gejala blast (blas), hawar daun, dan busuk batang. Pertimbangkan aplikasi fungisida preventif.`,
      });
    } else if (current.kelembapan >= 80) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'kelembapan_tinggi',
        pesan: 'Waspada jamur — kelembapan tinggi.',
        detail: `Kelembapan: ${current.kelembapan}%. Pantau tanaman secara rutin untuk tanda-tanda penyakit jamur. Pastikan sirkulasi udara di sawah baik.`,
      });
    }
  }

  private evaluateTemperatureAndUV(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    const uvIndex = current.uv_index ?? 0;

    // Extreme heat (>= 38°C) is handled by evaluateExtremeHeat — skip here to avoid duplicate alerts
    if (current.suhu >= 38) return;

    if (current.suhu >= 35 && uvIndex >= 8) {
      recs.push({
        tingkat: 'bahaya',
        kategori: 'panas_ekstrem',
        pesan: 'Suhu dan UV sangat tinggi — periksa irigasi segera!',
        detail: `Suhu: ${current.suhu}°C, UV Index: ${uvIndex}. Tanaman berisiko mengalami heat stress. Pastikan air irigasi cukup. Hindari bekerja di lapangan antara jam 10:00–15:00.`,
      });
    } else if (current.suhu >= 33 || uvIndex >= 6) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'suhu_tinggi',
        pesan: 'Suhu tinggi — pastikan irigasi mencukupi.',
        detail: `Suhu: ${current.suhu}°C, UV Index: ${uvIndex}. Monitor level air di sawah. Padi membutuhkan genangan 3-5 cm saat suhu tinggi.`,
      });
    }
  }

  private evaluateWind(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    const kecepatan = current.angin.kecepatan;
    const hembusan = current.angin.hembusan ?? kecepatan;

    if (hembusan >= 15 || kecepatan >= 10) {
      recs.push({
        tingkat: 'bahaya',
        kategori: 'angin_kencang',
        pesan: 'Angin kencang — waspada tanaman rebah!',
        detail: `Kecepatan angin: ${kecepatan} m/s, hembusan: ${hembusan} m/s. Padi yang sudah berbunga atau berbulir berisiko rebah (lodging). Jangan melakukan penyemprotan — pestisida akan terbang.`,
      });
    } else if (kecepatan >= 6) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'angin_sedang',
        pesan: 'Angin cukup kencang — hindari penyemprotan.',
        detail: `Kecepatan angin: ${kecepatan} m/s. Penyemprotan pestisida tidak efektif pada kecepatan angin > 5 m/s. Tunda hingga angin mereda.`,
      });
    }
  }

  private evaluateExtremeHeat(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    if (current.suhu >= 38) {
      recs.push({
        tingkat: 'bahaya',
        kategori: 'gelombang_panas',
        pesan: 'Suhu ekstrem — potensi gagal penyerbukan!',
        detail: `Suhu: ${current.suhu}°C. Di atas 35°C, penyerbukan padi terganggu berat. Jika padi sedang berbunga, potensi gabah hampa meningkat. Pertimbangkan irigasi berselang untuk menurunkan suhu mikro.`,
      });
    }
  }

  private evaluateExtremeCold(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    if (current.suhu <= 15) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'suhu_rendah',
        pesan: 'Suhu terlalu rendah untuk pertumbuhan optimal padi.',
        detail: `Suhu: ${current.suhu}°C. Padi tumbuh optimal di 22-30°C. Suhu di bawah 15°C memperlambat pertumbuhan vegetatif dan berpotensi merusak bibit muda.`,
      });
    }
  }

  private evaluateVisibility(
    current: CuacaSekarangResponse,
    recs: RekomendasiResponse[],
  ): void {
    if (current.jarak_pandang < 1000) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'kabut_tebal',
        pesan: 'Kabut tebal — hati-hati saat ke sawah.',
        detail: `Jarak pandang: ${current.jarak_pandang}m. Berkendara pelan dan gunakan lampu. Kabut pagi biasanya hilang setelah jam 09:00.`,
      });
    }
  }

  private evaluateForecastRain(
    forecast: PrakiraanHarianResponse[],
    recs: RekomendasiResponse[],
  ): void {
    const rainyDays = forecast.filter(d => d.peluang_hujan >= 70);

    if (rainyDays.length >= 3) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'musim_hujan',
        pesan: `${rainyDays.length} hari ke depan diprediksi hujan — siapkan drainase.`,
        detail: `Potensi hujan berturut-turut. Pastikan saluran air sawah lancar. Jika padi siap panen, pertimbangkan panen lebih awal untuk menghindari kerusakan gabah.`,
      });
    }
  }

  private evaluateForecastDrought(
    forecast: PrakiraanHarianResponse[],
    recs: RekomendasiResponse[],
  ): void {
    const dryHotDays = forecast.filter(
      d => d.peluang_hujan < 20 && d.suhu_max >= 33,
    );

    if (dryHotDays.length >= 4) {
      recs.push({
        tingkat: 'peringatan',
        kategori: 'potensi_kekeringan',
        pesan: `${dryHotDays.length} hari ke depan panas tanpa hujan — siapkan cadangan air irigasi.`,
        detail: `Potensi kekeringan. Periksa sumber air irigasi dan pastikan pompa berfungsi. Pertimbangkan irigasi berselang (System of Rice Intensification).`,
      });
    }
  }
}
