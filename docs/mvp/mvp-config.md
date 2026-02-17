# MVP Конфигурация

## Минимальный набор параметров

```json
{
  "agentName": "Алекс",
  "version": "0.1.0-mvp",
  "description": "MVP версия бикамерального агента",
  
  "drivers": [
    {
      "id": "curiosity",
      "baseLevel": 0.3,
      "decayRate": 0.001,
      "thresholdHigh": 0.8
    },
    {
      "id": "safety",
      "baseLevel": 0.2,
      "decayRate": 0.0005,
      "thresholdHigh": 0.7
    },
    {
      "id": "social",
      "baseLevel": 0.5,
      "decayRate": 0.002,
      "thresholdHigh": 0.8
    },
    {
      "id": "achievement",
      "baseLevel": 0.4,
      "decayRate": 0.0015,
      "thresholdHigh": 0.75
    },
    {
      "id": "comfort",
      "baseLevel": 0.6,
      "decayRate": 0.001,
      "thresholdHigh": 0.9
    }
  ],
  
  "emotionRules": [
    {
      "eventType": "user_message",
      "valenceDelta": 0.1,
      "arousalDelta": 0.05,
      "dominanceDelta": 0,
      "condition": "sentiment === 'positive'"
    },
    {
      "eventType": "user_message",
      "valenceDelta": -0.15,
      "arousalDelta": 0.1,
      "dominanceDelta": -0.1,
      "condition": "sentiment === 'negative'"
    },
    {
      "eventType": "drive_event",
      "valenceDelta": -0.1,
      "arousalDelta": 0.15,
      "dominanceDelta": 0
    }
  ],
  
  "importanceScorer": {
    "baseImportance": 5,
    "lengthFactor": 0.02,
    "nameBonus": 2,
    "questionBonus": 1
  },
  
  "memory": {
    "dbPath": "./data/bica.db",
    "maxFocusSize": 5,
    "maxActiveSize": 15,
    "decayHalfLifeTicks": 100,
    "maxAgeMs": 3600000
  },
  
  "llm": {
    "observerModel": "phi3:mini",
    "executorModel": "mistral:7b",
    "baseUrl": "http://localhost:11434",
    "defaultParams": {
      "temperature": 0.7,
      "top_p": 0.9,
      "max_tokens": 200
    }
  },
  
  "tickIntervalMs": 1000,
  
  "primingHabits": [
    {
      "id": "greet_positive",
      "triggerPattern": "привет здравствуй hello hi",
      "action": "[SEND_RESPONSE] Привет! Рад общению!",
      "strength": 0.8
    },
    {
      "id": "ask_clarify",
      "triggerPattern": "помощь помогите не понимаю",
      "action": "[SEND_RESPONSE] Чем я могу помочь? Расскажите подробнее.",
      "strength": 0.7
    }
  ]
}
```

---

## Описание параметров

### Драйверы

| Параметр | Описание | Рекомендуемый диапазон |
|----------|----------|------------------------|
| `baseLevel` | Начальный уровень | 0.2-0.6 |
| `decayRate` | Рост в секунду | 0.0005-0.003 |
| `thresholdHigh` | Порог события | 0.7-0.9 |

### Эмоциональные правила

| Параметр | Описание |
|----------|----------|
| `eventType` | Тип события из EventBus |
| `valenceDelta` | Изменение валентности (-0.3..0.3) |
| `arousalDelta` | Изменение возбуждения (-0.2..0.2) |
| `dominanceDelta` | Изменение доминантности (-0.2..0.2) |
| `condition` | JavaScript-условие (опционально) |

### Важность (Importance Scorer)

| Параметр | Описание | Значение по умолчанию |
|----------|----------|----------------------|
| `baseImportance` | Базовая важность | 5 |
| `lengthFactor` | За каждый символ | 0.02 |
| `nameBonus` | Если есть имя агента | 2 |
| `questionBonus` | Если есть вопрос | 1 |

### Память

| Параметр | Описание |
|----------|----------|
| `dbPath` | Путь к SQLite БД |
| `maxFocusSize` | Максимум элементов в Focus |
| `maxActiveSize` | Максимум элементов в Active |
| `decayHalfLifeTicks` | Тиков для уменьшения важности в 2 раза |
| `maxAgeMs` | Максимальный возраст элемента (мс) |

### LLM

| Параметр | Описание |
|----------|----------|
| `observerModel` | Модель для Наблюдателя |
| `executorModel` | Модель для Исполнителя |
| `baseUrl` | URL Ollama или другого API |
| `defaultParams` | Параметры генерации по умолчанию |

---

## Профили личности (примеры)

### Рефлексивный аналитик

```json
{
  "agentName": "Елена",
  "drivers": [
    { "id": "curiosity", "baseLevel": 0.7, "decayRate": 0.0015, "thresholdHigh": 0.9 },
    { "id": "safety", "baseLevel": 0.3, "decayRate": 0.002, "thresholdHigh": 0.7 }
  ],
  "emotionRules": [
    { "eventType": "user_message", "valenceDelta": 0.05, "arousalDelta": 0.02 }
  ]
}
```

### Импульсивный деятель

```json
{
  "agentName": "Макс",
  "drivers": [
    { "id": "curiosity", "baseLevel": 0.8, "decayRate": 0.003, "thresholdHigh": 0.6 },
    { "id": "achievement", "baseLevel": 0.6, "decayRate": 0.0025, "thresholdHigh": 0.65 }
  ],
  "emotionRules": [
    { "eventType": "user_message", "valenceDelta": 0.15, "arousalDelta": 0.1 }
  ]
}
```

---

**См. также:**
- [Полная конфигурация](../specification/07-configuration.md) — расширенная версия
- [MVP Roadmap](mvp-roadmap.md) — план реализации

---

**Навигация:**
[← Контракты](mvp-interfaces.md) | [Roadmap →](mvp-roadmap.md)
