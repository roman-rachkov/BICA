# MVP Контракты и интерфейсы

## EventBus

```typescript
interface SystemEvent {
  id: string;           // UUID
  type: string;
  timestamp: number;    // ms
  source: string;
  payload: any;
  priority?: number;    // 0-10, по умолчанию 5
}

interface EventBus {
  publish(event: SystemEvent): void;
  subscribe(type: string, handler: (event: SystemEvent) => void): () => void;
}
```

## Типы событий MVP

| Тип | Описание |
|-----|----------|
| `user_message` | Сообщение пользователя |
| `observer_thought` | Мысль Наблюдателя |
| `executor_utterance` | Реплика Исполнителя |
| `executor_action` | Действие Исполнителя |
| `drive_event` | Событие драйвера |
| `memory_result` | Результат поиска в памяти |

---

## InputProcessor

```typescript
interface InputProcessor {
  process(text: string): WorkingMemoryItem;
}

interface WorkingMemoryItem {
  id: string;
  type: 'user_message' | 'observer_thought' | 'executor_utterance' | 'drive_event';
  content: string;
  timestamp: number;
  importance: number;  // 0-10
  source: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}
```

---

## WorkingMemory

```typescript
interface WorkingMemory {
  add(item: Omit<WorkingMemoryItem, 'id'>): string;
  getFocus(limit?: number): WorkingMemoryItem[];
  getActive(limit?: number): WorkingMemoryItem[];
  decay(factor?: number): void;
  clear(): void;
}
```

---

## DriveManager

```typescript
interface DriverConfig {
  id: 'curiosity' | 'safety' | 'social' | 'achievement' | 'comfort';
  baseLevel: number;    // 0-1
  decayRate: number;    // за секунду
  thresholdHigh: number; // 0-1
}

interface DriveManager {
  init(configs: DriverConfig[]): void;
  tick(deltaMs: number): SystemEvent[];
  getLevels(): Record<string, number>;
}
```

---

## EmotionEngine

```typescript
interface EmotionVector {
  valence: number;    // -1..1
  arousal: number;    // 0..1
  dominance: number;  // 0..1
}

interface EmotionUpdateRule {
  eventType: string;
  valenceDelta: number;
  arousalDelta: number;
  dominanceDelta?: number;
}

interface EmotionEngine {
  init(rules: EmotionUpdateRule[]): void;
  update(event: WorkingMemoryItem): void;
  getCurrent(): EmotionVector;
  getInferenceParams(): { temperature: number; top_p: number };
}
```

---

## LongTermMemory

```typescript
interface MemoryEpisode {
  id: string;
  content: string;
  timestamp: number;
  importance: number;
  emotion?: EmotionVector;
}

interface LongTermMemory {
  search(query: string, limit: number): Promise<MemoryEpisode[]>;
  add(episode: Omit<MemoryEpisode, 'id'>): Promise<string>;
  getHabits(): Promise<Habit[]>;
  updateHabitStrength(habitId: string, delta: number): Promise<void>;
}
```

---

## Habit

```typescript
interface Habit {
  id: string;
  triggerPattern: string;
  action: string;
  strength: number;  // 0-1
  outcomeBuffer: number[];  // последние 5 исходов
}

interface LearningMechanism {
  findHabits(context: string, habits: Habit[]): Habit[];
  recordOutcome(habitId: string, outcome: number): void;
}
```

---

## BicameralEngine

```typescript
interface BicameralEngine {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
  handleMessage(text: string): void;
  getState(): {
    workingMemory: WorkingMemoryItem[];
    emotions: EmotionVector;
    drives: Record<string, number>;
  };
}
```

---

## Конфигурация MVP

```typescript
interface MVPConfig {
  agentName: string;
  drivers: DriverConfig[];
  emotionRules: EmotionUpdateRule[];
  importanceScorer: {
    baseImportance: number;
    lengthFactor: number;
    nameBonus: number;
    questionBonus: number;
  };
  memory: {
    dbPath: string;
    maxFocusSize: number;
    maxActiveSize: number;
    decayHalfLifeTicks: number;
  };
  llm: {
    observerModel: string;
    executorModel: string;
    baseUrl?: string;  // для облачных API
  };
  tickIntervalMs: number;
}
```

---

**См. также:**
- [Полные интерфейсы](../specification/05-contracts.md) — расширенная версия
- [MVP Конфигурация](mvp-config.md) — пример JSON

---

**Навигация:**
[← Компоненты](mvp-components.md) | [Конфигурация →](mvp-config.md)
