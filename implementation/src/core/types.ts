/**
 * Базовые типы данных для BICA MVP
 * Версия 2: с учётом исправлений архитектуры
 */

// Типы событий в системе
export type EventType =
  | 'user_message'
  | 'observer_thought'
  | 'executor_utterance'
  | 'executor_action'
  | 'drive_event'
  | 'memory_result';

// Типы элементов рабочей памяти
export type MemoryItemType =
  | 'user_message'
  | 'observer_thought'
  | 'executor_utterance'
  | 'drive_event'
  | 'memory_result';

// Источник события
export type MemorySource = 'user' | 'observer' | 'executor' | 'drive' | 'memory';

// Тональность
export type Sentiment = 'positive' | 'neutral' | 'negative';

// Полярность драйвера
export type DriverPolarity = 'centrifugal' | 'centripetal';

// Системное событие
export interface SystemEvent {
  id: string;
  type: EventType;
  timestamp: number;
  source: string;
  payload: any;
  priority?: number;  // 0-10, по умолчанию 5
}

// Элемент рабочей памяти (расширенный)
export interface WorkingMemoryItem {
  id: string;
  type: MemoryItemType;
  content: string;
  timestamp: number;
  importance: number;  // 0-10
  source: MemorySource;
  sentiment?: Sentiment;
  tags?: string[];
  goalId?: string;
  reflectionDepth?: number;  // для отслеживания глубины диалога
  emotionAtTime?: EmotionVector;
}

// Эмоциональный вектор VAD
export interface EmotionVector {
  valence: number;    // -1..1 (негатив -> позитив)
  arousal: number;    // 0..1 (спокойствие -> возбуждение)
  dominance: number;  // 0..1 (подчинение -> доминирование)
}

// Драйверы
export type DriverId = 'curiosity' | 'safety' | 'social' | 'achievement' | 'comfort';

export interface DriverConfig {
  id: DriverId;
  baseLevel: number;    // 0-1
  decayRate: number;    // за секунду
  thresholdLow: number; // 0-1, порог беспокойства
  thresholdHigh: number; // 0-1, критический порог
  polarity?: DriverPolarity;
}

export interface DriverState {
  id: DriverId;
  level: number;
  weight: number;  // вес для влияния эмоций
}

// Эпизод долговременной памяти
export interface MemoryEpisode {
  id: string;
  content: string;
  timestamp: number;
  importance: number;
  emotion?: EmotionVector;
  tags?: string[];
}

// Привычка
export interface Habit {
  id: string;
  triggerPattern: string;
  action: string;
  strength: number;  // 0-1
  outcomeBuffer: number[];  // последние 5 исходов
}

// Параметры для LLM
export interface LlmInferenceParams {
  temperature: number;
  top_p: number;
  max_tokens: number;
}

// Состояние агента
export interface AgentState {
  workingMemory: WorkingMemoryItem[];
  emotions: EmotionVector;
  drives: Record<DriverId, number>;
  reflectionDepth?: number;
}

// Результат бикамерального цикла
export interface BicameralCycleResult {
  observerThought: string;
  executorResponse: string;
  actionType: 'reflect' | 'response' | 'query_memory' | 'none';
  responseText?: string;
  depth: number;
}
