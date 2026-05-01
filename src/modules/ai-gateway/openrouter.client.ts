import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Types ───────────────────────────────────────────────────

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: string };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  response_format?:
    | { type: 'json_object' }
    | {
        type: 'json_schema';
        json_schema: { name: string; strict?: boolean; schema: object };
      };
  tools?: OpenRouterToolDef[];
  tool_choice?: any;
  /** @deprecated Use tools with openrouter:web_search instead */
  plugins?: { id: string; enabled?: boolean }[];
  user?: string;
  /** Unified reasoning/thinking parameter (Apr 2026) */
  reasoning?: {
    effort?: 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';
    max_tokens?: number;
    exclude?: boolean;
    enabled?: boolean;
  };
}

/** OpenAI-compatible tool definition */
export interface OpenRouterFunctionToolDef {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: object;
  };
}

/** OpenRouter server tool definition (e.g., web_search) */
export interface OpenRouterServerToolDef {
  type: `openrouter:${string}`;
}

/** Combined tool definition — supports both function tools and server tools */
export type OpenRouterToolDef =
  | OpenRouterFunctionToolDef
  | OpenRouterServerToolDef;

export interface OpenRouterResponse {
  id: string;
  choices: {
    finish_reason: string | null;
    native_finish_reason: string | null;
    message: {
      role: string;
      content: string | null;
      tool_calls?: any[];
      reasoning?: string | null;
      reasoning_details?: any[];
    };
    error?: { code: number; message: string };
  }[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

export interface OpenRouterStreamChunk {
  id: string;
  choices: {
    finish_reason: string | null;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: any[];
      reasoning?: string | null;
      reasoning_details?: any[];
    };
    error?: { code: string; message: string };
  }[];
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
  error?: { code: string; message: string };
}

export interface OpenRouterKeyInfo {
  data: {
    label: string;
    limit: number | null;
    limit_remaining: number | null;
    usage: number;
    is_free_tier: boolean;
  };
}

// ─── Client ──────────────────────────────────────────────────

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly appUrl: string;
  private readonly appTitle: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('openRouter.apiKey', '');
    this.timeoutMs = this.config.get<number>('openRouter.timeoutMs', 30000);
    this.appUrl = this.config.get<string>(
      'openRouter.appUrl',
      'https://arisa.app',
    );
    this.appTitle = this.config.get<string>(
      'openRouter.appTitle',
      'ARISA Smart Agriculture',
    );
  }

  /**
   * Non-streaming chat completion.
   */
  async chatCompletion(params: OpenRouterRequest): Promise<OpenRouterResponse> {
    const body = { ...params, stream: false };

    const response = await this.request('/chat/completions', body);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OpenRouterError(
        response.status,
        error?.error?.message || `OpenRouter HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<OpenRouterResponse>;
  }

  /**
   * Streaming chat completion — returns an async iterable of SSE chunks.
   */
  async *chatCompletionStream(
    params: OpenRouterRequest,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    const body = { ...params, stream: true };

    const response = await this.request('/chat/completions', body, abortSignal);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OpenRouterError(
        response.status,
        error?.error?.message || `OpenRouter HTTP ${response.status}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new OpenRouterError(500, 'No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and SSE comments (": OPENROUTER PROCESSING")
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') return;

          if (trimmed.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(
                trimmed.slice(6),
              ) as OpenRouterStreamChunk;

              // Check for mid-stream errors
              if (chunk.error) {
                throw new OpenRouterError(
                  500,
                  chunk.error.message || 'Mid-stream error',
                );
              }

              yield chunk;
            } catch (e) {
              if (e instanceof OpenRouterError) throw e;
              // Skip unparseable lines (per SSE spec)
              this.logger.debug(`Skipping unparseable SSE line: ${trimmed}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Check API key credits and rate limit status.
   */
  async checkCredits(): Promise<OpenRouterKeyInfo> {
    const response = await fetch(`${this.baseUrl}/key`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new OpenRouterError(response.status, 'Failed to check credits');
    }

    return response.json() as Promise<OpenRouterKeyInfo>;
  }

  /**
   * Get generation stats by ID (for async audit).
   */
  async getGenerationStats(generationId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/generation?id=${generationId}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );

    if (!response.ok) return null;
    return response.json();
  }

  // ─── Internal ────────────────────────────────────────────────

  private async request(
    path: string,
    body: any,
    abortSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Combine user abort signal with timeout
    const signal = abortSignal
      ? AbortSignal.any([controller.signal, abortSignal])
      : controller.signal;

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.appUrl,
          'X-OpenRouter-Title': this.appTitle,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new OpenRouterError(408, 'Request timeout or cancelled');
      }
      throw new OpenRouterError(500, `Network error: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ─── Error Class ─────────────────────────────────────────────

export class OpenRouterError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }

  /** True if this error is retryable (server-side issue) */
  get isRetryable(): boolean {
    return [429, 502, 503].includes(this.statusCode);
  }

  /** True if this is a credit/payment issue */
  get isCreditIssue(): boolean {
    return this.statusCode === 402;
  }
}
