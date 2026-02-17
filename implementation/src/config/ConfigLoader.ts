import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Схема валидации конфигурации
 */
const ConfigSchema = z.object({
  agentName: z.string(),
  version: z.string(),
  description: z.string().optional(),

  drivers: z.array(z.object({
    id: z.enum(['curiosity', 'safety', 'social', 'achievement', 'comfort']),
    baseLevel: z.number().min(0).max(1),
    decayRate: z.number().positive(),
    thresholdLow: z.number().min(0).max(1),
    thresholdHigh: z.number().min(0).max(1),
    polarity: z.enum(['centrifugal', 'centripetal']).optional()
  })),

  emotionRules: z.array(z.object({
    eventType: z.string(),
    valenceDelta: z.number().min(-1).max(1),
    arousalDelta: z.number().min(-1).max(1),
    dominanceDelta: z.number().min(-1).max(1).optional(),
    condition: z.string().optional()
  })),

  importanceScorer: z.object({
    baseImportance: z.number(),
    lengthFactor: z.number(),
    nameBonus: z.number(),
    questionBonus: z.number()
  }),

  memory: z.object({
    dbPath: z.string(),
    maxFocusSize: z.number().int().positive(),
    maxActiveSize: z.number().int().positive(),
    decayHalfLifeTicks: z.number().int().positive(),
    maxAgeMs: z.number().int().positive()
  }),

  llm: z.object({
    provider: z.string(),
    baseURL: z.string().url(),
    apiKey: z.string().optional(),
    model: z.object({
      observer: z.string(),
      executor: z.string()
    }),
    defaultParams: z.object({
      temperature: z.number(),
      top_p: z.number(),
      max_tokens: z.number().int().positive()
    })
  }),

  tui: z.object({
    icons: z.boolean().optional()
  }).optional(),

  tickIntervalMs: z.number().int().positive(),
  spontaneousReflectionTicks: z.number().int().positive().optional(),

  primingHabits: z.array(z.object({
    id: z.string(),
    triggerPattern: z.string(),
    action: z.string(),
    strength: z.number().min(0).max(1)
  })).optional()
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Загрузчик конфигурации
 */
export class ConfigLoader {
  /**
   * Загрузка конфигурации из файла
   */
  static load(configPath?: string): AppConfig {
    const path = configPath || join(__dirname, '../../configs/default.json');

    if (!existsSync(path)) {
      throw new Error(`Configuration file not found: ${path}`);
    }

    const content = readFileSync(path, 'utf-8');
    const config = JSON.parse(content);

    // Валидация
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Invalid configuration:\n${errors.join('\n')}`);
    }

    return result.data;
  }

  /**
   * Загрузка конфигурации с переменными окружения
   * Заменяет ${VAR_NAME} на значения из process.env
   */
  static loadWithEnv(configPath?: string): AppConfig {
    const config = this.load(configPath);

    // Заменяем переменные окружения в apiKey
    if (config.llm.apiKey?.startsWith('${') && config.llm.apiKey?.endsWith('}')) {
      const envVar = config.llm.apiKey.slice(2, -1);
      config.llm.apiKey = process.env[envVar];
    }

    return config;
  }

  /**
   * Создание конфигурации по умолчанию (для тестов)
   */
  static createDefault(): AppConfig {
    return {
      agentName: 'Алекс',
      version: '0.1.0-mvp',
      description: 'Default test configuration',

      drivers: [
        { id: 'curiosity', baseLevel: 0.3, decayRate: 0.001, thresholdLow: 0.5, thresholdHigh: 0.8 },
        { id: 'safety', baseLevel: 0.2, decayRate: 0.0005, thresholdLow: 0.4, thresholdHigh: 0.7 },
        { id: 'social', baseLevel: 0.5, decayRate: 0.002, thresholdLow: 0.6, thresholdHigh: 0.8 },
        { id: 'achievement', baseLevel: 0.4, decayRate: 0.0015, thresholdLow: 0.5, thresholdHigh: 0.75 },
        { id: 'comfort', baseLevel: 0.6, decayRate: 0.001, thresholdLow: 0.7, thresholdHigh: 0.9 }
      ],

      emotionRules: [
        { eventType: 'user_message', valenceDelta: 0.1, arousalDelta: 0.05 },
        { eventType: 'user_message', valenceDelta: -0.15, arousalDelta: 0.1, dominanceDelta: -0.1 },
        { eventType: 'drive_event', valenceDelta: -0.1, arousalDelta: 0.15 }
      ],

      importanceScorer: {
        baseImportance: 5,
        lengthFactor: 0.02,
        nameBonus: 2,
        questionBonus: 1
      },

      memory: {
        dbPath: ':memory:',
        maxFocusSize: 5,
        maxActiveSize: 15,
        decayHalfLifeTicks: 100,
        maxAgeMs: 3600000
      },

      llm: {
        provider: 'ollama',
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        model: {
          observer: 'phi3:mini',
          executor: 'mistral:7b'
        },
        defaultParams: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 300
        }
      },

      tui: {
        icons: false
      },

      tickIntervalMs: 2000,
      spontaneousReflectionTicks: 15,

      primingHabits: [
        { id: 'greet_positive', triggerPattern: 'привет здравствуй hello hi', action: '[SEND_RESPONSE] Привет!', strength: 0.8 }
      ]
    };
  }
}
