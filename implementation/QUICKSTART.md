# Быстрый старт BICA MVP

## 1. Установка

```bash
cd implimentation
npm install
```

## 2. Настройка LLM

### Вариант A: Ollama (локально, рекомендуется)

1. Установите Ollama: https://ollama.ai
2. Запустите сервер:
   ```bash
   ollama serve
   ```
3. Модели установятся автоматически при первом запросе или вручную:
   ```bash
   ollama pull phi3:mini
   ollama pull mistral:7b
   ```

### Вариант B: OpenRouter (облако, платно)

1. Получите ключ: https://openrouter.ai
2. Создайте конфиг `configs/openrouter.json`:
   ```json
   {
     "llm": {
       "provider": "openrouter",
       "baseURL": "https://openrouter.ai/api/v1",
       "apiKey": "your-key-here",
       "model": {
         "observer": "meta-llama/llama-3-8b-instruct",
         "executor": "mistralai/mistral-7b-instruct"
       }
     }
   }
   ```

### Вариант C: DeepSeek (облако, платно)

1. Получите ключ: https://platform.deepseek.com
2. Создайте конфиг `configs/deepseek.json`:
   ```json
   {
     "llm": {
       "provider": "deepseek",
       "baseURL": "https://api.deepseek.com/v1",
       "apiKey": "your-key-here",
       "model": {
         "observer": "deepseek-chat",
         "executor": "deepseek-chat"
       }
     }
   }
   ```

## 3. Запуск

```bash
# Режим разработки (авто-перезагрузка)
npm run dev

# Или обычный запуск
npm start
```

С альтернативным конфигом:
```bash
npm start -- --config configs/openrouter.json
```

## 4. Использование

После запуска:
- Введите сообщение для общения с агентом
- Используйте команды:
  - `/help` - справка
  - `/status` - состояние (эмоции, драйверы)
  - `/stats` - статистика
  - `/exit` - выход

## 5. Проверка работы

1. Агент должен ответить на ваше сообщение
2. В логе видно:
   - `👁️ Наблюдатель думает...` - внутренняя мысль
   - `💭 Мысль: ...` - результат работы Наблюдателя
   - `🎯 Исполнитель отвечает...` - генерация ответа
   - `💬 Ответ: ...` - финальный ответ

3. Команда `/status` покажет:
   - Эмоции (VAD вектор)
   - Уровни 5 драйверов

## 6. Структура проекта

```
implimentation/
├── src/
│   ├── core/           # Ядро (EventBus, WorkingMemory)
│   ├── input/          # InputProcessor
│   ├── drives/         # DriveManager (5 драйверов)
│   ├── emotions/       # EmotionEngine (VAD)
│   ├── engine/         # BicameralEngine, LlmClient
│   ├── memory/         # Database, LongTermMemory
│   ├── learning/       # HabitManager
│   ├── config/         # ConfigLoader
│   └── cli.ts          # Консольный интерфейс
├── configs/            # JSON конфиги
├── data/               # SQLite база данных
└── dist/               # Скомпилированный JS
```

## 7. Настройка личности

Отредактируйте `configs/default.json`:

### Драйверы
Измените базовые уровни и скорость роста потребностей.

### Эмоциональные правила
Настройте как события влияют на эмоции.

### Привычки
Добавьте новые паттерны поведения.

## 8. Возможные проблемы

### LLM недоступен
- Проверьте, запущен ли Ollama: `ollama serve`
- Проверьте URL в конфиге (по умолчанию `http://localhost:11434/v1`)

### Ошибки компиляции
- Удалите `node_modules` и `package-lock.json`
- Запустите `npm install`
- Запустите `npm run build`

### Медленная работа
- Используйте более лёгкие модели
- Уменьшите `tickIntervalMs` в конфиге
- Отключите лишние компоненты

## 9. Следующие шаги

После знакомства с MVP:
1. Добавьте новые привычки
2. Настройте профиль личности
3. Экспериментируйте с разными LLM
4. Изучите логи для понимания работы
