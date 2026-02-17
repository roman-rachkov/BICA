# MVP Roadmap: Пошаговый план реализации

## Этапы реализации MVP

### Этап 1: Фундамент (1-2 недели)

**Задачи:**
- [ ] Настроить проект (TypeScript, Node.js, npm/yarn)
- [ ] Реализовать EventBus (EventEmitter)
- [ ] Создать базовую структуру WorkingMemory (in-memory)
- [ ] Настроить SQLite подключение
- [ ] Создать таблицы БД (episodes, habits)

**Результат:**
```
implimentation/
├── src/
│   ├── core/
│   │   ├── EventBus.ts
│   │   └── WorkingMemory.ts
│   ├── memory/
│   │   └── Database.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

### Этап 2: Сенсорный препроцессор и драйверы (1 неделя)

**Задачи:**
- [ ] Реализовать InputProcessor (важность, тональность)
- [ ] Реализовать DriveManager (5 драйверов)
- [ ] Настроить генерацию drive_event
- [ ] Написать тесты на расчёт важности

**Результат:**
```
src/
├── input/
│   └── InputProcessor.ts
└── drives/
    └── DriveManager.ts
```

---

### Этап 3: Эмоциональная система (3-5 дней)

**Задачи:**
- [ ] Реализовать EmotionEngine (VAD вектор)
- [ ] Настроить правила обновления эмоций
- [ ] Реализовать влияние на параметры LLM
- [ ] Добавить скользящее среднее

**Результат:**
```
src/
└── emotions/
    └── EmotionEngine.ts
```

---

### Этап 4: Бикамеральное ядро (2 недели)

**Задачи:**
- [ ] Реализовать BicameralEngine (цикл tick)
- [ ] Создать промпты Наблюдателя и Исполнителя
- [ ] Настроить LLM-клиент (Ollama/API)
- [ ] Реализовать парсинг ответов ([REFLECT], [SEND_RESPONSE], etc.)
- [ ] Добавить WebSocket для стриминга мыслей

**Результат:**
```
src/
├── engine/
│   ├── BicameralEngine.ts
│   ├── prompts/
│   │   ├── observer.hbs
│   │   └── executor.hbs
│   └── LlmClient.ts
└── api/
    └── WebSocketServer.ts
```

---

### Этап 5: Долговременная память и привычки (1-2 недели)

**Задачи:**
- [ ] Реализовать поиск в SQLite (FTS5)
- [ ] Реализовать запись эпизодов
- [ ] Создать HabitManager (поиск паттернов)
- [ ] Реализовать обучение с подкреплением
- [ ] Добавить предустановленные привычки

**Результат:**
```
src/
├── memory/
│   ├── LongTermMemory.ts
│   └── migrations/
│       └── 001_initial.sql
└── learning/
    └── HabitManager.ts
```

---

### Этап 6: Интеграция и тестирование (1 неделя)

**Задачи:**
- [ ] Собрать все компоненты вместе
- [ ] Написать интеграционные тесты
- [ ] Протестировать сценарии диалогов
- [ ] Оптимизировать производительность
- [ ] Создать CLI для запуска

**Результат:**
- Работающий агент
- Набор тестов
- CLI команда `bica start`

---

## Итоговая структура проекта

```
implimentation/
├── src/
│   ├── core/
│   │   ├── EventBus.ts
│   │   ├── WorkingMemory.ts
│   │   └── types.ts
│   ├── input/
│   │   └── InputProcessor.ts
│   ├── drives/
│   │   └── DriveManager.ts
│   ├── emotions/
│   │   └── EmotionEngine.ts
│   ├── engine/
│   │   ├── BicameralEngine.ts
│   │   ├── LlmClient.ts
│   │   └── prompts/
│   │       ├── observer.hbs
│   │       └── executor.hbs
│   ├── memory/
│   │   ├── Database.ts
│   │   ├── LongTermMemory.ts
│   │   └── migrations/
│   ├── learning/
│   │   └── HabitManager.ts
│   ├── api/
│   │   └── WebSocketServer.ts
│   ├── config/
│   │   └── ConfigLoader.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── data/
│   └── .gitkeep
├── configs/
│   ├── default.json
│   └── elena.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Зависимости (package.json)

```json
{
  "name": "bica-mvp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "eventemitter3": "^5.0.0",
    "handlebars": "^4.7.8",
    "ws": "^8.14.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Критерии готовности MVP

- [ ] Агент запускается из CLI
- [ ] Отвечает на сообщения пользователя
- [ ] Ведёт внутренний диалог (видно в WebSocket)
- [ ] Драйверы обновляются и влияют на поведение
- [ ] Эмоции меняются от событий
- [ ] Привычки формируются после повторений
- [ ] Память сохраняет и ищет эпизоды

---

## Следующие шаги после MVP

1. **MCP-интеграция** — внешние инструменты
2. **Мета-когнитивный модуль** — мониторинг ригидности
3. **Когнитивный гомеостаз** — принудительная рефлексия
4. **Фронтенд-дашборд** — визуализация состояний
5. **Векторная память** — LanceDB для семантического поиска
6. **Кластеризация** — несколько агентов

---

**См. также:**
- [MVP Архитектура](mvp-architecture.md) — общая схема
- [MVP Компоненты](mvp-components.md) — детальное описание

---

**Навигация:**
[← Конфигурация](mvp-config.md) | [К оглавлению MVP →](README.md)
