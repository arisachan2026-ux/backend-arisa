import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'ARISA-PI-001', description: 'Unique device serial' })
  @IsString()
  @MaxLength(100)
  deviceSerial: string;

  @ApiProperty({
    example: 'Farm Sensor Alpha',
    description: 'Human-readable device name',
  })
  @IsString()
  @MaxLength(200)
  deviceName: string;

  @ApiProperty({ description: 'Pre-shared registration secret' })
  @IsString()
  registrationSecret: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  firmwareVersion?: string;
}
