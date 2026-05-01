import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  OpenRouterClient,
  OpenRouterError,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterToolDef,
  ContentPart,
  OpenRouterStreamChunk,
} from './openrouter.client';
import { ChatDto, AnalyzeDto, ImageInputDto } from './dto';
import { ErrorCode } from '../../common/constants/error-codes';

// ─── Constants ───────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'google/gemini-2.5-flash',
  'claude-haiku': 'anthropic/claude-haiku-4.5',
};

/** Approximate USD per 1M tokens — for display only. Actual billing is handled by OpenRouter. */
const AVAILABLE_MODELS = [
  {
    alias: 'gemini-flash',
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    contextWindow: 1_048_576,
    maxOutput: 65_535,
    inputPrice: 0.3,
    outputPrice: 2.5,
    capabilities: [
      'chat',
      'vision',
      'streaming',
      'tools',
      'structured-output',
      'reasoning',
    ],
  },
  {
    alias: 'claude-haiku',
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    contextWindow: 200_000,
    maxOutput: 64_000,
    inputPrice: 1.0,
    outputPrice: 5.0,
    capabilities: [
      'chat',
      'vision',
      'streaming',
      'tools',
      'structured-output',
      'reasoning',
    ],
  },
];

/**
 * OpenRouter web search server tool.
 * Format per official docs: { type: 'openrouter:web_search' }
 * NOT the function-type format — this is a server-side tool managed by OpenRouter.
 */
const WEB_SEARCH_TOOL: OpenRouterToolDef = {
  type: 'openrouter:web_search',
};

const DEFAULT_SYSTEM_PROMPT = `Kamu adalah ARISA (Agricultural Resource & Intelligence System Assistant), asisten AI cerdas untuk pertanian Indonesia.

Tugasmu:
- Membantu petani dengan informasi pertanian yang akurat
- Menganalisis kondisi tanaman dari gambar
- Memberikan rekomendasi berdasarkan data sensor dan kondisi lingkungan
- Menjawab dalam Bahasa Indonesia yang mudah dipahami
- Jika diminta analisis gambar, berikan detail yang spesifik dan actionable

Selalu berikan jawaban yang praktis, ilmiah, dan sesuai konteks pertanian Indonesia.`;

const ANALYSIS_PROMPTS: Record<string, string> = {
  'plant-disease': `Analisis gambar/data tanaman berikut dan identifikasi:
1. Jenis penyakit atau hama (jika ada)
2. Tingkat keparahan (ringan/sedang/berat)
3. Penyebab yang mungkin
4. Rekomendasi penanganan
5. Tindakan pencegahan

Berikan jawaban dalam format JSON dengan key: disease, severity, cause, treatment, prevention.`,

  'soil-analysis': `Analisis data tanah berikut dan berikan:
1. Kondisi kesuburan tanah
2. Kekurangan nutrisi (jika ada)
3. Rekomendasi pemupukan
4. pH optimal untuk tanaman terkait

Berikan jawaban dalam format JSON.`,

  'crop-recommendation': `Berdasarkan data lingkungan berikut, rekomendasikan:
1. Tanaman yang cocok untuk ditanam
2. Waktu tanam optimal
3. Estimasi hasil panen
4. Kebutuhan perawatan

Berikan jawaban dalam format JSON.`,

  'weather-impact': `Analisis dampak kondisi cuaca berikut terhadap pertanian:
1. Risiko yang mungkin terjadi
2. Tindakan preventif
3. Tanaman yang terpengaruh
4. Timeline risiko

Berikan jawaban dalam format JSON.`,
};

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly defaultModel: string;
  private readonly fallbackModel: string;
  private readonly maxTokensCap: number;
  private readonly rateLimitPerMin: number;
  private readonly rateLimitPerHour: number;

  // In-memory rate limit fallback (when Redis unavailable)
  private readonly memoryRateLimit = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly openRouter: OpenRouterClient,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.defaultModel = this.config.get<string>(
      'openRouter.defaultModel',
      'google/gemini-2.5-flash',
    );
    this.fallbackModel = this.config.get<string>(
      'openRouter.fallbackModel',
      'anthropic/claude-haiku-4.5',
    );
    this.maxTokensCap = this.config.get<number>('openRouter.maxTokens', 8192);
    this.rateLimitPerMin = this.config.get<number>(
      'openRouter.userRateLimitPerMinute',
      10,
    );
    this.rateLimitPerHour = this.config.get<number>(
      'openRouter.userRateLimitPerHour',
      100,
    );
  }

  // ─── Chat (Non-Streaming) ─────────────────────────────────

  async chat(userId: string, dto: ChatDto) {
    await this.enforceRateLimit(userId);

    const model = this.resolveModel(dto.model);
    const messages = await this.buildMessages(dto, userId);
    const maxTokens = Math.min(
      dto.maxTokens || this.maxTokensCap,
      this.maxTokensCap,
    );

    const params: OpenRouterRequest = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: dto.temperature ?? 0.7,
      user: userId,
    };

    // Reasoning/Thinking
    if (dto.reasoning) {
      params.reasoning = {};
      if (dto.reasoning.effort) params.reasoning.effort = dto.reasoning.effort;
      if (dto.reasoning.maxTokens)
        params.reasoning.max_tokens = dto.reasoning.maxTokens;
      if (dto.reasoning.exclude !== undefined)
        params.reasoning.exclude = dto.reasoning.exclude;
    }

    // Web search (server tool, replaces deprecated plugins)
    if (dto.enableWebSearch) {
      params.tools = [...(params.tools || []), WEB_SEARCH_TOOL];
    }

    if (dto.responseFormat === 'json') {
      params.response_format = dto.jsonSchema
        ? {
            type: 'json_schema',
            json_schema: { name: 'response', schema: dto.jsonSchema },
          }
        : { type: 'json_object' };
    }

    const startTime = Date.now();
    let response;

    try {
      response = await this.openRouter.chatCompletion(params);
    } catch (error) {
      if (error instanceof OpenRouterError && error.isRetryable) {
        this.logger.warn(
          `Primary model failed (${error.statusCode}), trying fallback...`,
        );
        params.model = this.fallbackModel;
        response = await this.openRouter.chatCompletion(params);
      } else {
        throw this.mapError(error);
      }
    }

    const durationMs = Date.now() - startTime;
    const msg = response.choices[0]?.message;
    const content = msg?.content || '';
    const reasoning = msg?.reasoning || null;
    const usage = response.usage;

    // Save to database
    await this.saveRequest(userId, {
      requestType: 'chat',
      model: response.model,
      input: {
        message: dto.message,
        model: dto.model,
        hasReasoning: !!dto.reasoning,
      },
      output: content,
      usage,
      durationMs,
    });

    return {
      id: response.id,
      model: response.model,
      content,
      reasoning,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            cost: usage.cost,
          }
        : null,
      durationMs,
    };
  }

  // ─── Chat (Streaming) ─────────────────────────────────────

  async *chatStream(
    userId: string,
    dto: ChatDto,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    await this.enforceRateLimit(userId);

    const model = this.resolveModel(dto.model);
    const messages = await this.buildMessages(dto, userId);
    const maxTokens = Math.min(
      dto.maxTokens || this.maxTokensCap,
      this.maxTokensCap,
    );

    const params: OpenRouterRequest = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: dto.temperature ?? 0.7,
      stream: true,
      user: userId,
    };

    // Reasoning/Thinking
    if (dto.reasoning) {
      params.reasoning = {};
      if (dto.reasoning.effort) params.reasoning.effort = dto.reasoning.effort;
      if (dto.reasoning.maxTokens)
        params.reasoning.max_tokens = dto.reasoning.maxTokens;
      if (dto.reasoning.exclude !== undefined)
        params.reasoning.exclude = dto.reasoning.exclude;
    }

    // Web search (server tool)
    if (dto.enableWebSearch) {
      params.tools = [...(params.tools || []), WEB_SEARCH_TOOL];
    }

    const startTime = Date.now();
    let fullContent = '';
    let finalUsage: any = null;
    let finalModel = model;

    try {
      for await (const chunk of this.openRouter.chatCompletionStream(params)) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) fullContent += delta;

        if (chunk.usage) finalUsage = chunk.usage;
        if (chunk.model) finalModel = chunk.model;

        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Stream error: ${(error as Error).message}`);
      throw this.mapError(error);
    }

    // Save to database after stream completes
    await this.saveRequest(userId, {
      requestType: 'chat_stream',
      model: finalModel,
      input: {
        message: dto.message,
        model: dto.model,
        hasReasoning: !!dto.reasoning,
      },
      output: fullContent,
      usage: finalUsage,
      durationMs: Date.now() - startTime,
    });
  }

  // ─── Analyze ──────────────────────────────────────────────

  async analyze(userId: string, dto: AnalyzeDto) {
    await this.enforceRateLimit(userId);

    const model = this.resolveModel(dto.model);
    const systemPrompt =
      ANALYSIS_PROMPTS[dto.type] || ANALYSIS_PROMPTS['plant-disease'];

    // Build user message with images and payload
    const contentParts: ContentPart[] = [];

    if (dto.instructions) {
      contentParts.push({ type: 'text', text: dto.instructions });
    }

    if (dto.payload) {
      contentParts.push({
        type: 'text',
        text: `Data untuk analisis:\n${JSON.stringify(dto.payload, null, 2)}`,
      });
    }

    if (dto.images?.length) {
      for (const img of dto.images) {
        contentParts.push(this.buildImagePart(img));
      }
    }

    if (contentParts.length === 0) {
      contentParts.push({
        type: 'text',
        text: `Lakukan analisis tipe: ${dto.type}`,
      });
    }

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `${DEFAULT_SYSTEM_PROMPT}\n\n${systemPrompt}`,
      },
      { role: 'user', content: contentParts },
    ];

    const params: OpenRouterRequest = {
      model,
      messages,
      max_tokens: this.maxTokensCap,
      temperature: 0.3, // Lower temp for structured analysis
      response_format: { type: 'json_object' },
      plugins: [{ id: 'response-healing' }], // Auto-repair broken JSON (still active per OpenRouter docs)
      user: userId,
    };

    // Apply reasoning if provided (B7 fix — AnalyzeDto.reasoning was defined but never used)
    if (dto.reasoning) {
      params.reasoning = {};
      if (dto.reasoning.effort) params.reasoning.effort = dto.reasoning.effort;
      if (dto.reasoning.maxTokens)
        params.reasoning.max_tokens = dto.reasoning.maxTokens;
      if (dto.reasoning.exclude !== undefined)
        params.reasoning.exclude = dto.reasoning.exclude;
    }

    // Inject IoT context for analyze (D6 — deviceId exists on AnalyzeDto but was unused)
    if (dto.deviceId && userId) {
      const iotContext = await this.buildIotContext(userId, dto.deviceId);
      if (iotContext) {
        messages[0].content = `${messages[0].content}${iotContext}`;
      }
    }

    const startTime = Date.now();
    let response;

    try {
      response = await this.openRouter.chatCompletion(params);
    } catch (error) {
      if (error instanceof OpenRouterError && error.isRetryable) {
        params.model = this.fallbackModel;
        response = await this.openRouter.chatCompletion(params);
      } else {
        throw this.mapError(error);
      }
    }

    const durationMs = Date.now() - startTime;
    const rawContent = response.choices[0]?.message?.content || '{}';

    // Try to parse JSON
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch {
      parsedResult = { raw: rawContent, parseError: true };
    }

    await this.saveRequest(userId, {
      requestType: `analyze_${dto.type}`,
      model: response.model,
      input: {
        type: dto.type,
        payload: dto.payload,
        hasImages: !!dto.images?.length,
      },
      output: parsedResult,
      usage: response.usage,
      durationMs,
    });

    return {
      id: response.id,
      model: response.model,
      type: dto.type,
      result: parsedResult,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            cost: response.usage.cost,
          }
        : null,
      durationMs,
    };
  }

  // ─── History & Stats ──────────────────────────────────────

  async getHistory(userId: string, page = 1, limit = 20) {
    limit = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      this.prisma.aiRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          requestType: true,
          provider: true,
          status: true,
          durationMs: true,
          tokenUsage: true,
          createdAt: true,
        },
      }),
      this.prisma.aiRequest.count({ where: { userId } }),
    ]);

    return {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUsageSummary(userId: string) {
    const requests = await this.prisma.aiRequest.findMany({
      where: { userId },
      select: { tokenUsage: true, durationMs: true, status: true },
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    const totalRequests = requests.length;
    let failedRequests = 0;

    for (const req of requests) {
      if (req.status === 'error') failedRequests++;
      if (req.tokenUsage && typeof req.tokenUsage === 'object') {
        const usage = req.tokenUsage as any;
        totalPromptTokens += usage.prompt_tokens || 0;
        totalCompletionTokens += usage.completion_tokens || 0;
        totalCost += usage.cost || 0;
      }
    }

    return {
      totalRequests,
      failedRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      estimatedCost: totalCost,
    };
  }

  async checkCredits() {
    return this.openRouter.checkCredits();
  }

  getModels() {
    return AVAILABLE_MODELS;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private resolveModel(alias?: string): string {
    if (!alias) return this.defaultModel;
    return MODEL_MAP[alias] || this.defaultModel;
  }

  private async buildMessages(
    dto: ChatDto,
    userId?: string,
  ): Promise<OpenRouterMessage[]> {
    const messages: OpenRouterMessage[] = [];

    // System prompt + IoT context
    let systemContent = dto.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Inject IoT session context if requested
    const shouldInjectIot = dto.deviceId && dto.includeIotContext !== false;
    if (shouldInjectIot && userId) {
      const iotContext = await this.buildIotContext(userId, dto.deviceId!);
      if (iotContext) {
        systemContent += iotContext;
      }
    }

    messages.push({ role: 'system', content: systemContent });

    // History (multi-turn)
    if (dto.history?.length) {
      for (const msg of dto.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Current message (with optional images)
    if (dto.images?.length) {
      const parts: ContentPart[] = [
        { type: 'text', text: dto.message },
        ...dto.images.map((img) => this.buildImagePart(img)),
      ];
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: dto.message });
    }

    return messages;
  }

  /**
   * Build IoT session context from recent SessionSummary records.
   * Injects the last 5 session conclusions as system context for the AI.
   */
  private async buildIotContext(
    userId: string,
    deviceId: string,
  ): Promise<string> {
    try {
      const summaries = await this.prisma.sessionSummary.findMany({
        where: { userId, deviceId },
        orderBy: { sessionEnd: 'desc' },
        take: 5,
        select: {
          summary: true,
          metrics: true,
          alerts: true,
          recommendations: true,
          sessionEnd: true,
          dataPointCount: true,
        },
      });

      if (!summaries.length) return '';

      const contextLines = summaries.map((s, i) => {
        const date = s.sessionEnd.toLocaleString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        let line = `[Sesi ${i + 1} — ${date}, ${s.dataPointCount} data point]\n${s.summary}`;
        if (s.metrics) line += `\nMetrik: ${JSON.stringify(s.metrics)}`;
        if (s.alerts) line += `\nAlerts: ${JSON.stringify(s.alerts)}`;
        if (s.recommendations)
          line += `\nRekomendasi Edge: ${JSON.stringify(s.recommendations)}`;
        return line;
      });

      return `\n\n--- DATA LAHAN TERBARU (dari sensor IoT) ---\n${contextLines.join('\n\n')}`;
    } catch (error) {
      this.logger.warn(
        `Failed to build IoT context: ${(error as Error).message}`,
      );
      return '';
    }
  }

  private buildImagePart(img: ImageInputDto): ContentPart {
    const url =
      img.type === 'base64'
        ? `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
        : img.data;

    return {
      type: 'image_url',
      image_url: { url, detail: 'auto' },
    };
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const key = `ai_ratelimit:${userId}`;
    const now = Date.now();

    // Try Redis first
    try {
      const count = await this.redis.get(key);
      if (count !== null && parseInt(count, 10) >= this.rateLimitPerMin) {
        throw new HttpException(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment with 60s expiry using proper accessor
      const client = this.redis.getClient();
      if (client) {
        await client.multi().incr(key).expire(key, 60).exec();
        return;
      }
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      )
        throw error;
      // Redis unavailable — fall through to in-memory
    }

    // In-memory fallback
    const entry = this.memoryRateLimit.get(key);
    if (entry && now < entry.resetAt) {
      if (entry.count >= this.rateLimitPerMin) {
        throw new HttpException(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      entry.count++;
    } else {
      this.memoryRateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    }
  }

  private async saveRequest(
    userId: string,
    data: {
      requestType: string;
      model: string;
      input: any;
      output: any;
      usage: any;
      durationMs: number;
    },
  ) {
    try {
      await this.prisma.aiRequest.create({
        data: {
          userId,
          requestType: data.requestType,
          provider: 'openrouter',
          inputPayload: data.input,
          outputResult: data.output,
          status: 'completed',
          durationMs: data.durationMs,
          tokenUsage: data.usage,
        },
      });
    } catch (error) {
      // Don't crash if audit logging fails
      this.logger.error(
        `Failed to save AI request: ${(error as Error).message}`,
      );
    }
  }

  private mapError(error: any): Error {
    if (error instanceof OpenRouterError) {
      if (error.isCreditIssue) {
        return new ServiceUnavailableException(ErrorCode.AI_QUOTA_EXCEEDED);
      }
      if (error.statusCode === 429) {
        return new HttpException(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error.statusCode === 401) {
        return new ServiceUnavailableException(
          ErrorCode.AI_PROVIDER_UNAVAILABLE,
        );
      }
      return new ServiceUnavailableException(
        `${ErrorCode.AI_REQUEST_FAILED}: ${error.message}`,
      );
    }
    return new ServiceUnavailableException(ErrorCode.AI_REQUEST_FAILED);
  }
}
