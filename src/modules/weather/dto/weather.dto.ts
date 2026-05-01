import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Query DTOs ──────────────────────────────────────────

export class GetWeatherBySawahDto {
  @ApiProperty({ description: 'ID sawah yang ingin dicek cuaca', example: 'uuid-sawah' })
  @IsUUID()
  @IsNotEmpty()
  sawah_id: string;
}

export class GetWeatherByCoordinatesDto {
  @ApiProperty({ description: 'Latitude (-90 to 90)', example: -7.797 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @ApiProperty({ description: 'Longitude (-180 to 180)', example: 110.361 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lon: number;

  @ApiPropertyOptional({ description: 'Label lokasi', example: 'Sawah Utara' })
  @IsString()
  @IsOptional()
  label?: string;
}

// ─── Sawah CRUD DTOs ─────────────────────────────────────

export class CreateSawahDto {
  @ApiProperty({ description: 'Nama sawah', example: 'Sawah Utara - Blok A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Latitude', example: -7.797 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: 110.361 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({ description: 'Luas sawah (hektar)', example: 2.5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  luasHektar?: number;

  @ApiPropertyOptional({ description: 'Alamat / deskripsi lokasi', example: 'Desa Sukamaju, Kab. Bandung' })
  @IsString()
  @IsOptional()
  alamat?: string;
}

export class UpdateSawahDto {
  @ApiPropertyOptional({ description: 'Nama sawah' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Luas sawah (hektar)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  luasHektar?: number;

  @ApiPropertyOptional({ description: 'Alamat / deskripsi lokasi' })
  @IsString()
  @IsOptional()
  alamat?: string;
}

// ─── Response interfaces ─────────────────────────────────

export interface CuacaSekarangResponse {
  suhu: number;
  terasa_seperti: number;
  kelembapan: number;
  tekanan_udara: number;
  kondisi: string;
  deskripsi: string;
  ikon: string;
  angin: {
    kecepatan: number;
    arah_derajat: number;
    hembusan?: number;
  };
  uv_index: number | null;
  jarak_pandang: number;
  awan: number;
  curah_hujan_1jam?: number;
  sunrise: string;
  sunset: string;
}

export interface PrakiraanHarianResponse {
  tanggal: string;
  hari: string;
  kondisi: string;
  deskripsi: string;
  ikon: string;
  suhu_min: number;
  suhu_max: number;
  kelembapan: number;
  angin: number;
  peluang_hujan: number;
  curah_hujan?: number;
}

export interface PrakiraanPerJamResponse {
  waktu: string;
  suhu: number;
  kelembapan: number;
  kondisi: string;
  peluang_hujan: number;
  angin: number;
}

export interface RekomendasiResponse {
  tingkat: 'info' | 'peringatan' | 'bahaya';
  kategori: string;
  pesan: string;
  detail?: string;
}

export interface AlertCuacaResponse {
  sumber: string;
  peristiwa: string;
  mulai: string;
  selesai: string;
  deskripsi: string;
}

export interface WeatherFullResponse {
  lokasi: {
    nama: string;
    latitude: number;
    longitude: number;
    sawah_id?: string;
  };
  cuaca_sekarang: CuacaSekarangResponse;
  prakiraan_harian: PrakiraanHarianResponse[];
  prakiraan_per_jam: PrakiraanPerJamResponse[];
  alerts: AlertCuacaResponse[];
  rekomendasi: RekomendasiResponse[];
  cache: {
    dari_cache: boolean;
    diperbarui_pada: string;
    kadaluarsa_pada: string;
  };
}
