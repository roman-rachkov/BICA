# 5. Контракты и интерфейсы

## 5.1. Событийная шина (EventBus)

```typescript
interface SystemEvent {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  payload: any;
  priority?: number; // 0-10
}

interface EventBus {
  publish(event: SystemEvent): void;
  subscribe<T extends SystemEvent>(type: string, handler: (event: T) => void): Subscription;
  unsubscribe(subscription: Subscription): void;
}
```

---

## 5.2. Типы событий (основные)

| Тип события | Описание |
|-------------|----------|
| `user_message` | Входящее сообщение пользователя (обработанное препроцессором) |
| `observer_thought` | Мысль Наблюдателя (текст) |
| `executor_utterance` | Внутренняя реплика Исполнителя |
| `executor_action` | Внешнее действие Исполнителя |
| `drive_event` | Событие от драйвера (достижение порога) |
| `memory_result` | Результат поиска в долговременной памяти |
| `mcp_result` | Результат вызова MCP-инструмента |
| `reality_check` | Событие сенсорного якоря |
| `rigidity_detected` | Обнаружена ригидность |
| `cognitive_crisis` | Сработал мета-драйвер гомеостаза |
| `personality_drift` | Обнаружен дрейф личности |

---

## 5.3. JSON Schema для основных событий (пример)

**Для `user_message`:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "const": "user_message" },
    "timestamp": { "type": "number" },
    "source": { "type": "string" },
    "payload": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "sentiment": { "enum": ["positive", "neutral", "negative"] },
        "entities": { "type": "array", "items": { "type": "string" } },
        "embedding": { "type": "array", "items": { "type": "number" } }
      },
      "required": ["text", "sentiment"]
    },
    "priority": { "type": "number", "minimum": 0, "maximum": 10 }
  },
  "required": ["id", "type", "timestamp", "source", "payload"]
}
```

---

## 5.4. Интерфейсы компонентов

```typescript
// Базовый интерфейс для всех компонентов (при необходимости)
interface Component {
  init(config: any): void;
  shutdown(): void;
}

// Сенсорный препроцессор
interface InputProcessor {
  process(rawInput: string, metadata?: any): WorkingMemoryItem;
  configure(rules: ImportanceScorerConfig): void;
}

// Рабочая память
interface WorkingMemory {
  add(item: Omit<WorkingMemoryItem, 'id'>): string;
  get(id: string): WorkingMemoryItem | undefined;
  updateImportance(id: string, delta: number): void;
  getContext(limit: number): { focus: WorkingMemoryItem[]; active: WorkingMemoryItem[] };
  prune(maxAge: number, minImportance: number): number;
  decayImportance(halfLifeTicks: number): void;
  clear(): void;
}

// Менеджер драйверов
interface DriveManager {
  registerDriver(config: DriverConfig): void;
  tick(deltaTimeMs: number): DriverEvent[];
  setDriverLevel(driverId: string, level: number): void;
  getActiveDrives(): Array<{ id: string; level: number; urgency: string }>;
}

// Эмоциональная система
interface EmotionEngine {
  getCurrent(): EmotionVector;
  update(event: WorkingMemoryItem): void;
  getInfluenceOnPrompt(): string;
  getInferenceParams(): InferenceParams;
  setBaseTemperament(vector: EmotionVector): void;
  setReactivity(factor: number): void;
}

// Долговременная память
interface LongTermMemory {
  search(query: string, limit: number, filter?: any): Promise<MemoryItem[]>;
  add(item: Omit<MemoryItem, 'id'>): Promise<string>;
  reinforce(itemId: string, delta: number): Promise<void>;
  consolidate(): Promise<number>;
  compress(olderThan: number): Promise<CompressedMemory[]>;
  getPriorityMemories(): Promise<MemoryItem[]>; // для мета-модуля
}

// Механизм привычек
interface Habit {
  id: string;
  triggerPattern: string; // семантический паттерн (JSON)
  action: Action;
  strength: number;
  outcomeBuffer: number[]; // последние исходы (1/-1/0)
  lastExecuted: number;
}

interface LearningMechanism {
  findHabits(context: string): Habit[]; // поиск подходящих привычек (по эмбеддингам)
  recordOutcome(habitId: string, outcome: number, goalAlignment?: number): void;
  weakenHabit(habitId: string, delta: number): void;
  getDriftIndex(): Promise<number>; // расчёт индекса дрейфа
}

// Диспетчер действий
interface Action {
  type: string;
  payload: any;
  id?: string;
}

interface ActionDispatcher {
  dispatch(action: Action): Promise<string>;
  onResult(actionId: string, callback: (result: any) => void): void;
}

// Бикамеральный движок
interface BicameralEngine {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
  injectEvent(event: Omit<WorkingMemoryItem, 'id'>): void;
  getState(): any;
  getHealthMetrics(): CognitiveHealthMetrics;
}
```

---

**См. также:**
- [Детальная спецификация компонентов](04-components.md) — описание логики компонентов
- [Промпты](06-prompts.md) — как компоненты взаимодействуют через LLM

---

**Навигация:**
[← Компоненты](04-components.md) | [Промпты →](06-prompts.md)
