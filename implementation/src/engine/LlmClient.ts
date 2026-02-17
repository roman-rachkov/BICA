import OpenAI from 'openai';
import type { LlmInferenceParams } from '../core/types.js';

/**
 * Конфигурация LLM клиента
 */
export interface LlmClientConfig {
  provider: string;
  baseURL: string;
  apiKey?: string;
  defaultModel: string;
  defaultParams: LlmInferenceParams;
}

/**
 * Сообщение для LLM
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Универсальный OpenAI-совместимый LLM клиент
 * Поддерживает: Ollama, LM Studio, OpenRouter, DeepSeek, Together, OpenAI
 */
export class LlmClient {
  private client: OpenAI;
  private config: LlmClientConfig;

  constructor(config: LlmClientConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey || 'not-needed'
    });
  }

  /**
   * Генерация ответа от LLM
   * @param messages - массив сообщений диалога
   * @param model - модель для генерации (опционально, иначе defaultModel)
   * @param params - параметры генерации (опционально, иначе defaultParams)
   */
  async generate(
    messages: ChatMessage[],
    model?: string,
    params?: Partial<LlmInferenceParams>
  ): Promise<string> {
    const finalModel = model || this.config.defaultModel;
    const finalParams: LlmInferenceParams = {
      ...this.config.defaultParams,
      ...params
    };

    try {
      const response = await this.client.chat.completions.create({
        model: finalModel,
        messages,
        temperature: finalParams.temperature,
        top_p: finalParams.top_p,
        max_tokens: finalParams.max_tokens
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      return content.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`LLM generation failed: ${errorMessage}`);
    }
  }

  /**
   * Генерация с потоковой передачей (streaming)
   * @param messages - массив сообщений диалога
   * @param onChunk - колбэк для каждого чанка ответа
   * @param model - модель для генерации
   * @param params - параметры генерации
   */
  async generateStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    model?: string,
    params?: Partial<LlmInferenceParams>
  ): Promise<string> {
    const finalModel = model || this.config.defaultModel;
    const finalParams: LlmInferenceParams = {
      ...this.config.defaultParams,
      ...params
    };

    try {
      const stream = await this.client.chat.completions.create({
        model: finalModel,
        messages,
        temperature: finalParams.temperature,
        top_p: finalParams.top_p,
        max_tokens: finalParams.max_tokens,
        stream: true
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      return fullResponse.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`LLM streaming generation failed: ${errorMessage}`);
    }
  }

  /**
   * Проверка доступности LLM
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Пробуем сделать минимальный запрос
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получение списка доступных моделей
   */
  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map(m => m.id);
    } catch {
      return [];
    }
  }

  /**
   * Обновление конфигурации (для динамического переключения провайдеров)
   */
  reconfigure(config: Partial<LlmClientConfig>): void {
    if (config.baseURL || config.apiKey) {
      this.client = new OpenAI({
        baseURL: config.baseURL || this.config.baseURL,
        apiKey: config.apiKey || this.config.apiKey || 'not-needed'
      });
    }

    if (config.defaultModel) {
      this.config.defaultModel = config.defaultModel;
    }
    if (config.defaultParams) {
      this.config.defaultParams = config.defaultParams;
    }
    if (config.provider) {
      this.config.provider = config.provider;
    }
  }

  /**
   * Получение текущей конфигурации
   */
  getConfig(): LlmClientConfig {
    return { ...this.config };
  }
}
