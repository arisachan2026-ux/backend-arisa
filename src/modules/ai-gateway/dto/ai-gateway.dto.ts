import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Image Input ─────────────────────────────────────────────

export class ImageInputDto {
  @ApiProperty({ enum: ['url', 'base64'] })
  @IsIn(['url', 'base64'])
  type: 'url' | 'base64';

  @ApiProperty({ description: 'Image URL or base64-encoded data' })
  @IsString()
  data: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

// ─── Chat Message ────────────────────────────────────────────

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

// ─── Reasoning ───────────────────────────────────────────────

export class ReasoningDto {
  @ApiPropertyOptional({
    enum: ['xhigh', 'high', 'medium', 'low', 'minimal', 'none'],
    description:
      'How hard the model should think. Maps to OpenRouter reasoning.effort.',
    example: 'medium',
  })
  @IsOptional()
  @IsIn(['xhigh', 'high', 'medium', 'low', 'minimal', 'none'])
  effort?: 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';

  @ApiPropertyOptional({
    description:
      'Max reasoning tokens (Anthropic: min 1024). Overrides effort.',
    example: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description:
      'If true, model thinks internally but reasoning is excluded from response.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  exclude?: boolean;
}

// ─── Chat Request ────────────────────────────────────────────

export class ChatDto {
  @ApiProperty({ example: 'Apa penyebab daun padi menguning?' })
  @IsString()
  @MaxLength(32000)
  message: string;

  @ApiPropertyOptional({
    enum: ['gemini-flash', 'claude-haiku'],
    default: 'gemini-flash',
  })
  @IsOptional()
  @IsIn(['gemini-flash', 'claude-haiku'])
  model?: 'gemini-flash' | 'claude-haiku';

  @ApiPropertyOptional({
    description: 'Previous messages for multi-turn context',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  @ArrayMaxSize(50)
  history?: ChatMessageDto[];

  @ApiPropertyOptional({ description: 'Override default system prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @ApiPropertyOptional({ default: 4096, maximum: 16384 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(16384)
  maxTokens?: number;

  @ApiPropertyOptional({ default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Images for vision analysis' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  @ArrayMaxSize(5)
  images?: ImageInputDto[];

  @ApiPropertyOptional({ enum: ['text', 'json'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'json'])
  responseFormat?: 'text' | 'json';

  @ApiPropertyOptional({
    description: 'JSON Schema for structured output (when responseFormat=json)',
  })
  @IsOptional()
  @IsObject()
  jsonSchema?: object;

  // ─── NEW: Reasoning/Thinking ─────────────────────────────

  @ApiPropertyOptional({
    description: 'Control AI reasoning/thinking depth',
    type: ReasoningDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReasoningDto)
  reasoning?: ReasoningDto;

  // ─── NEW: Web Search (Server Tool) ───────────────────────

  @ApiPropertyOptional({
    description: 'Enable web search grounding (uses OpenRouter server tool)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableWebSearch?: boolean;

  // ─── NEW: IoT Context ────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Device ID to inject IoT session data as AI context',
    example: 'uuid-of-device',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      'Whether to include IoT session context. Defaults to true when deviceId is provided.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeIotContext?: boolean;
}

// ─── Analyze Request ─────────────────────────────────────────

export class AnalyzeDto {
  @ApiProperty({ example: 'plant-disease', description: 'Analysis type' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Data payload to analyze' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Images for visual analysis' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInputDto)
  @ArrayMaxSize(5)
  images?: ImageInputDto[];

  @ApiPropertyOptional({ enum: ['gemini-flash', 'claude-haiku'] })
  @IsOptional()
  @IsIn(['gemini-flash', 'claude-haiku'])
  model?: 'gemini-flash' | 'claude-haiku';

  @ApiPropertyOptional({ description: 'Additional instructions' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @ApiPropertyOptional({ description: 'Device ID for IoT context injection' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Control reasoning depth',
    type: ReasoningDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReasoningDto)
  reasoning?: ReasoningDto;
}
