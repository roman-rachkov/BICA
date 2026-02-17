import type { WorkingMemoryItem, Sentiment } from '../core/types.js';

/**
 * Конфигурация для InputProcessor
 */
export interface ImportanceScorerConfig {
  baseImportance: number;
  lengthFactor: number;
  nameBonus: number;
  questionBonus: number;
}

/**
 * Словарь тональности (упрощённый)
 */
const POSITIVE_WORDS = new Set([
  'хорошо', 'отлично', 'прекрасно', 'замечательно', 'рад', 'радост',
  'счастлив', 'люблю', 'нравится', 'приятн', 'весел', 'смешн',
  'успех', 'победа', 'достиж', 'благодар', 'спасибо', 'пожалуйста',
  'good', 'great', 'excellent', 'wonderful', 'happy', 'love', 'like',
  'nice', 'funny', 'success', 'win', 'thank', 'please', 'awesome'
]);

const NEGATIVE_WORDS = new Set([
  'плохо', 'ужасно', 'страшно', 'груст', 'печаль', 'зл', 'сердит',
  'разочарован', 'устал', 'больн', 'неприятн', 'отвратит', 'ненавижу',
  'проблем', 'ошибк', 'неудач', 'страдан', 'крик', 'слез',
  'bad', 'terrible', 'awful', 'sad', 'angry', 'hate', 'disappointed',
  'tired', 'pain', 'problem', 'error', 'fail', 'suffer', 'cry'
]);

/**
 * Сенсорный препроцессор входных сообщений
 * Вычисляет важность и определяет тональность
 */
export class InputProcessor {
  private config: ImportanceScorerConfig;
  private agentName: string;

  constructor(
    config: ImportanceScorerConfig,
    agentName: string = 'Алекс'
  ) {
    this.config = config;
    this.agentName = agentName;
  }

  /**
   * Обработка входного сообщения
   */
  process(text: string): WorkingMemoryItem {
    const importance = this.calculateImportance(text);
    const sentiment = this.analyzeSentiment(text);

    return {
      id: this.generateId(),
      type: 'user_message',
      content: text,
      timestamp: Date.now(),
      importance,
      source: 'user',
      sentiment
    };
  }

  /**
   * Вычисление важности сообщения
   * Формула: base + lengthFactor + nameBonus + questionBonus + sentimentScore
   */
  private calculateImportance(text: string): number {
    const { baseImportance, lengthFactor, nameBonus, questionBonus } = this.config;

    // Базовая важность
    let importance = baseImportance;

    // Фактор длины (нормализованный)
    const lengthContribution = Math.min(text.length * lengthFactor, 3);
    importance += lengthContribution;

    // Бонус за упоминание имени агента
    const namePattern = new RegExp(`\\b(${this.agentName}|алекс|alex)\\b`, 'i');
    if (namePattern.test(text)) {
      importance += nameBonus;
    }

    // Бонус за вопрос
    const questionPattern = /[?？¿]/;
    if (questionPattern.test(text)) {
      importance += questionBonus;
    }

    // Бонус за эмоциональную окраску
    const sentimentScore = Math.abs(this.getSentimentScore(text)) * 2;
    importance += sentimentScore;

    // Нормализация к шкале 0-10
    return Math.max(0, Math.min(10, importance));
  }

  /**
   * Анализ тональности сообщения
   */
  private analyzeSentiment(text: string): Sentiment {
    const score = this.getSentimentScore(text);

    if (score > 0.3) return 'positive';
    if (score < -0.3) return 'negative';
    return 'neutral';
  }

  /**
   * Вычисление скоринга тональности
   */
  private getSentimentScore(text: string): number {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      // Проверка на частичное совпадение
      for (const posWord of POSITIVE_WORDS) {
        if (word.includes(posWord) || posWord.includes(word)) {
          positiveCount++;
          break;
        }
      }
      for (const negWord of NEGATIVE_WORDS) {
        if (word.includes(negWord) || negWord.includes(word)) {
          negativeCount++;
          break;
        }
      }
    }

    const total = positiveCount + negativeCount;
    if (total === 0) return 0;

    // Score от -1 до 1
    return (positiveCount - negativeCount) / total;
  }

  /**
   * Генерация уникального ID
   */
  private generateId(): string {
    return `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
