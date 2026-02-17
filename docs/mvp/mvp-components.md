# MVP Компоненты

## Минимальный набор компонентов для MVP

### 1. Сенсорный препроцессор (базовый)

**Функции:**
- Вычисление важности по формуле:
  ```
  importance = 5 + lengthFactor + nameBonus + questionBonus + sentimentScore
  ```
- Определение тональности (простой словарь позитивных/негативных слов)
- Извлечение длины сообщения

**Без:**
- Эмбеддингов
- Сравнения с целью
- Извлечения сущностей

---

### 2. Рабочая память (Focus + Active)

**Структура:**
```typescript
interface WorkingMemoryItem {
  id: string;
  type: 'user_message' | 'observer_thought' | 'executor_utterance' | 'drive_event';
  content: string;
  timestamp: number;
  importance: number;  // 0-10
  source: string;
}
```

**Механизмы:**
- Добавление в Focus (сдвиг старых)
- Перемещение в Active при необходимости
- Удаление старых (> maxAge)
- Decay важности каждые N тиков

**Без:**
- Background уровня
- Эмбеддингов
- Семантического поиска

---

### 3. Система драйверов (5 потребностей)

**Драйверы:**
1. `curiosity` — любопытство
2. `safety` — безопасность
3. `social` — социальность
4. `achievement` — достижение
5. `comfort` — комфорт

**Логика:**
- Уровень растёт с `decayRate` каждую секунду
- При достижении `thresholdHigh` генерируется `drive_event`
- Событие сбрасывает уровень в `baseLevel`

**Без:**
- Влияния на эмоции (прямая связь)
- Полярности

---

### 4. Эмоциональная система (VAD)

**Вектор:**
```typescript
interface EmotionVector {
  valence: number;    // -1..1
  arousal: number;    // 0..1
  dominance: number;  // 0..1
}
```

**Обновление:**
- По событиям из рабочей памяти
- Правила из конфигурации
- Скользящее среднее (окно 3)

**Влияние на LLM:**
```
temperature = baseTemp + arousal * 0.3
top_p = 0.9 + dominance * 0.1
```

**Без:**
- Функциональной карты драйверов
- Буферизации

---

### 5. Наблюдатель (LLM)

**Промпт:**
- Текущие эмоции
- Активные драйверы
- Focus рабочной памяти
- Последние 5 записей из Active

**Выход:**
- Одна мысль (текст)

---

### 6. Исполнитель (LLM)

**Промпт:**
- Мысль Наблюдателя
- Текущие эмоции
- Привычки-кандидаты
- Focus рабочной памяти

**Выход:**
- `[REFLECT]` — внутренняя реплика
- `[SEND_RESPONSE]` — ответ пользователю
- `[QUERY_MEMORY]` — поиск в памяти

---

### 7. Долговременная память (SQLite)

**Таблицы:**
```sql
-- Эпизоды
CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  content TEXT,
  timestamp INTEGER,
  importance REAL,
  emotion_valence REAL,
  emotion_arousal REAL,
  emotion_dominance REAL
);

-- FTS поиск
CREATE VIRTUAL TABLE episodes_fts USING fts5(content, content_rowid=id);

-- Привычки
CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  trigger_pattern TEXT,
  action TEXT,
  strength REAL,
  last_outcomes TEXT  -- JSON массив
);
```

**Операции:**
- `search(query, limit)` — FTS5 поиск
- `add(episode)` — запись эпизода
- `getHabitPatterns()` — получение привычек

**Без:**
- Векторного поиска
- Компрессии
- Reinforcement через эмбеддинги

---

### 8. Механизм привычек (базовый)

**Хранение:**
```typescript
interface Habit {
  id: string;
  triggerPattern: string;  // текстовый паттерн
  action: string;          // строка действия
  strength: number;        // 0-1
  outcomeBuffer: number[]; // последние 5 исходов
}
```

**Поиск:**
- По ключевым словам в triggerPattern
- Возврат до 3 подходящих привычек

**Обучение:**
```
Δstrength = 0.1 * (outcome - expectedOutcome)
```

**Без:**
- Автовыполнения
- Семантического поиска
- Учёта долгосрочных целей

---

## Сводная таблица компонентов MVP

| Компонент | Реализация | Сложность |
|-----------|------------|-----------|
| Сенсорный препроцессор | Детерминированный | Низкая |
| Рабочая память | In-memory массив | Низкая |
| Драйверы | Детерминированные | Низкая |
| Эмоции | Детерминированные | Низкая |
| Наблюдатель | LLM | Средняя |
| Исполнитель | LLM | Средняя |
| Долговременная память | SQLite + FTS5 | Средняя |
| Привычки | Текстовый поиск | Средняя |

---

**См. также:**
- [MVP Контракты](mvp-interfaces.md) — интерфейсы
- [MVP Конфигурация](mvp-config.md) — параметры

---

**Навигация:**
[← Архитектура](mvp-architecture.md) | [Контракты →](mvp-interfaces.md)
