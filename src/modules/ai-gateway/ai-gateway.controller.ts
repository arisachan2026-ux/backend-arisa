import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AiGatewayService } from './ai-gateway.service';
import { ChatDto, AnalyzeDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/roles';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class AiGatewayController {
  constructor(private readonly aiService: AiGatewayService) {}

  // ─── Chat ─────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with AI (non-streaming)' })
  @ApiResponse({ status: 200, description: 'AI response returned' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async chat(@CurrentUser('id') userId: string, @Body() dto: ChatDto) {
    return this.aiService.chat(userId, dto);
  }

  // ─── Chat Stream (SSE) ───────────────────────────────────

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  // NOTE: @Header() decorators are NOT used here because @Res() puts NestJS
  // into library-specific mode which disables all @Header(), @HttpCode(), etc.
  // Headers are set manually via res.setHeader() inside the handler.
  @ApiOperation({ summary: 'Chat with AI (streaming SSE)' })
  @ApiProduces('text/event-stream')
  @ApiResponse({ status: 200, description: 'SSE stream of AI tokens' })
  async chatStream(
    @CurrentUser('id') userId: string,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.chatStream(userId, dto)) {
        const content = chunk.choices?.[0]?.delta?.content;
        const usage = chunk.usage;

        // Send content chunks
        if (content) {
          res.write(
            `data: ${JSON.stringify({ type: 'content', content })}\n\n`,
          );
        }

        // Send final usage stats
        if (usage) {
          res.write(
            `data: ${JSON.stringify({
              type: 'usage',
              usage: {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                cost: usage.cost,
              },
            })}\n\n`,
          );
        }
      }

      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error.message || 'Stream error',
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  // ─── Analyze ──────────────────────────────────────────────

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Structured AI analysis (plant disease, soil, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Structured JSON analysis result' })
  async analyze(@CurrentUser('id') userId: string, @Body() dto: AnalyzeDto) {
    return this.aiService.analyze(userId, dto);
  }

  // ─── Vision ───────────────────────────────────────────────

  @Post('vision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Image analysis via AI vision' })
  @ApiResponse({ status: 200, description: 'Vision analysis result' })
  async vision(@CurrentUser('id') userId: string, @Body() dto: AnalyzeDto) {
    // Vision uses the same analyze flow but with images required
    if (!dto.images?.length) {
      dto.images = [];
    }
    if (!dto.type) {
      dto.type = 'plant-disease';
    }
    return this.aiService.analyze(userId, dto);
  }

  // ─── History ──────────────────────────────────────────────

  @Get('history')
  @ApiOperation({ summary: 'Get AI request history (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async history(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.aiService.getHistory(userId, page, limit);
  }

  // ─── Usage ────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Get token/cost usage summary for current user' })
  async usage(@CurrentUser('id') userId: string) {
    return this.aiService.getUsageSummary(userId);
  }

  // ─── Credits (Admin) ─────────────────────────────────────

  @Get('credits')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Check OpenRouter API credit balance (admin only)' })
  async credits() {
    return this.aiService.checkCredits();
  }

  // ─── Models ───────────────────────────────────────────────

  @Get('models')
  @ApiOperation({ summary: 'List available AI models and their capabilities' })
  async models() {
    return this.aiService.getModels();
  }
}
