# BICA MVP - Bicameral Intelligent Cognitive Architecture

Минимально жизнеспособная версия бикамерального когнитивного агента.

## Быстрый старт

### 1. Установка зависимостей

```bash
cd implimentation
npm install
```

### 2. Настройка LLM

По умолчанию используется **Ollama** (локально). Убедитесь, что Ollama запущен:

```bash
ollama serve
```

Нужные модели (установятся автоматически при первом запросе):
- `phi3:mini` - для Наблюдателя
- `mistral:7b` - для Исполнителя

Или установите вручную:
```bash
ollama pull phi3:mini
ollama pull mistral:7b
```

### 3. Запуск

```bash
# Режим 1: Разработка с авто-перезагрузкой (может быть нестабилен с readline)
npm run dev

# Режим 2: Разработка без авто-перезагрузки (рекомендуется)
npm run start:dev

# Режим 3: Продакшен (после сборки)
npm run build
npm start
```

### 4. Использование

После запуска:
- Дождитесь сообщения `✅ Агент готов к общению`
- Введите сообщение для общения с агентом
- Используйте `/help` для списка команд

**Команды:**
- `/help` - показать справку
- `/status` - текущее состояние (эмоции, драйверы)
- `/stats` - статистика работы
- `/config` - конфигурация
- `/exit` - выход
- `Ctrl+C` - выход

## Альтернативные LLM провайдеры

### OpenRouter

```json
{
  "llm": {
    "provider": "openrouter",
    "baseURL": "https://openrouter.ai/api/v1",
    "apiKey": "${OPENROUTER_KEY}",
    "model": {
      "observer": "meta-llama/llama-3-8b-instruct",
      "executor": "mistralai/mistral-7b-instruct"
    }
  }
}
```

### DeepSeek

```json
{
  "llm": {
    "provider": "deepseek",
    "baseURL": "https://api.deepseek.com/v1",
    "apiKey": "${DEEPSEEK_KEY}",
    "model": {
      "observer": "deepseek-chat",
      "executor": "deepseek-chat"
    }
  }
}
```

### LM Studio

```json
{
  "llm": {
    "provider": "lmstudio",
    "baseURL": "http://localhost:1234/v1",
    "apiKey": "not-needed",
    "model": {
      "observer": "local-model",
      "executor": "local-model"
    }
  }
}
```

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Пользователь                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  InputProcessor (важность, тональность)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Working Memory (Focus + Active)                        │
└────────────┬─────────────────────────────┬──────────────┘
             │                             │
             ▼                             ▼
    ┌────────────────┐           ┌────────────────┐
    │  DriveManager  │           │ EmotionEngine  │
    │  (5 драйверов) │           │    (VAD)       │
    └────────────────┘           └────────────────┘
             │                             │
             └──────────┬──────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   Bicameral Engine           │
         │  ┌────────┐    ┌──────────┐  │
         │  │ LLM    │◄──►│ Observer │  │
         │  │ Client │    │ (мысль)  │  │
         │  └────────┘    └──────────┘  │
         │       │              │        │
         │       ▼              ▼        │
         │  ┌──────────┐  ┌──────────┐  │
         │  │ Executor │  │ Prompts  │  │
         │  │ (ответ)  │  │  (hbs)   │  │
         │  └──────────┘  └──────────┘  │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  LongTermMemory (SQLite)     │
         │  + HabitManager              │
         └──────────────────────────────┘
```

## Компоненты

| Компонент | Описание |
|-----------|----------|
| `EventBus` | Шина событий для коммуникации |
| `WorkingMemory` | Кратковременная память (Focus + Active) |
| `InputProcessor` | Обработка входа (важность, тональность) |
| `DriveManager` | 5 драйверов (любопытство, безопасность, социальность, достижение, комфорт) |
| `EmotionEngine` | Эмоциональный вектор VAD |
| `LlmClient` | Универсальный OpenAI-совместимый клиент |
| `BicameralEngine` | Координация Наблюдателя и Исполнителя |
| `DatabaseManager` | SQLite база данных |
| `LongTermMemory` | Долговременная память с FTS поиском |
| `HabitManager` | Механизм привычек |
| `ConfigLoader` | Загрузка конфигурации |

## Конфигурация

Файл: `configs/default.json`

Основные секции:
- `drivers` - настройки 5 драйверов
- `emotionRules` - правила обновления эмоций
- `importanceScorer` - расчёт важности сообщений
- `memory` - параметры памяти
- `llm` - LLM провайдер и модели
- `primingHabits` - стартовые привычки

## Структура проекта

```
implimentation/
├── src/
│   ├── core/           # Ядро (EventBus, WorkingMemory, типы)
│   ├── input/          # InputProcessor
│   ├── drives/         # DriveManager
│   ├── emotions/       # EmotionEngine
│   ├── engine/         # BicameralEngine, LlmClient, промпты
│   ├── memory/         # Database, LongTermMemory
│   ├── learning/       # HabitManager
│   ├── config/         # ConfigLoader
│   └── cli.ts          # Консольный интерфейс
├── configs/
│   └── default.json    # Конфигурация по умолчанию
├── data/               # SQLite база данных (создаётся)
├── package.json
└── tsconfig.json
```

## Разработка

```bash
# Сборка
npm run build

# Запуск тестов
npm test
```

## Требования

- Node.js 20+
- Ollama (или другой OpenAI-совместимый провайдер)

## Лицензия

MIT
