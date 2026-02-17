import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { AppConfig } from '../config/ConfigLoader.js';
import type {
  WorkingMemoryItem,
  EmotionVector,
  DriverId,
  SystemEvent,
  LlmInferenceParams,
  AgentState,
  BicameralCycleResult,
  Habit,
  MemoryEpisode
} from '../core/types.js';

import { EventBus, WorkingMemory } from '../core/index.js';
import { InputProcessor } from '../input/InputProcessor.js';
import { DriveManager } from '../drives/DriveManager.js';
import { EmotionEngine } from '../emotions/EmotionEngine.js';
import { LlmClient, type ChatMessage } from '../engine/LlmClient.js';
import { DatabaseManager } from '../memory/Database.js';
import { LongTermMemory } from '../memory/LongTermMemory.js';
import { HabitManager } from '../learning/HabitManager.js';
import type { Logger } from '../utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Максимальная глубина многошагового диалога
const MAX_REFLECTION_DEPTH = 5;

/**
 * Бикамеральный движок агента
 * Координирует все компоненты, реализует многошаговый бикамеральный цикл
 */
export class BicameralEngine {
  private config: AppConfig;
  private eventBus: EventBus;
  private workingMemory: WorkingMemory;
  private inputProcessor: InputProcessor;
  private driveManager: DriveManager;
  private emotionEngine: EmotionEngine;
  private llmClient: LlmClient;
  private dbManager: DatabaseManager;
  private ltm: LongTermMemory;
  private habitManager: HabitManager;
  private logger: Logger;

  private isRunning: boolean = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = 0;
  private tickCount: number = 0;
  private spontaneousReflectionTicks: number;

  // Промпты
  private observerPrompt: Handlebars.TemplateDelegate;
  private executorPrompt: Handlebars.TemplateDelegate;

  private initPromise: Promise<void> | null = null;

  constructor(config: AppConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.eventBus = new EventBus();
    this.spontaneousReflectionTicks = config.spontaneousReflectionTicks || 15;
    
    // Рабочая память
    this.workingMemory = new WorkingMemory(
      config.memory.maxFocusSize,
      config.memory.maxActiveSize,
      config.memory.decayHalfLifeTicks,
      config.memory.maxAgeMs
    );

    // Обработчик входа
    this.inputProcessor = new InputProcessor(
      config.importanceScorer,
      config.agentName
    );

    // Драйверы
    this.driveManager = new DriveManager();
    this.driveManager.init(config.drivers);

    // Эмоции
    this.emotionEngine = new EmotionEngine();
    this.emotionEngine.init(config.emotionRules);

    // LLM клиент
    this.llmClient = new LlmClient({
      provider: config.llm.provider,
      baseURL: config.llm.baseURL,
      apiKey: config.llm.apiKey,
      defaultModel: config.llm.model.executor,
      defaultParams: config.llm.defaultParams
    });

    // База данных и память
    this.dbManager = new DatabaseManager(config.memory.dbPath);
    this.ltm = new LongTermMemory(this.dbManager);
    this.habitManager = new HabitManager(this.ltm);

    // Загрузка промптов
    this.observerPrompt = this.loadPrompt('observer.hbs');
    this.executorPrompt = this.loadPrompt('executor.hbs');

    // Подписка на события
    this.setupEventHandlers();
  }

  /**
   * Загрузка шаблона промпта
   */
  private loadPrompt(filename: string): Handlebars.TemplateDelegate {
    const promptPath = join(__dirname, `prompts/${filename}`);
    const content = readFileSync(promptPath, 'utf-8');
    return Handlebars.compile(content);
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    // Обработка drive_event с влиянием на веса драйверов
    this.eventBus.subscribe('drive_event', (event) => {
      const weightChanges = this.emotionEngine.update({
        id: event.id,
        type: 'drive_event',
        content: event.payload.driverId,
        timestamp: event.timestamp,
        importance: event.priority || 5,
        source: 'drive'
      });

      // Применяем изменения весов драйверов
      weightChanges.forEach((delta, index) => {
        const driveIds: DriverId[] = ['curiosity', 'safety', 'social', 'achievement', 'comfort'];
        if (delta !== 0) {
          this.driveManager.updateWeight(driveIds[index], delta);
        }
      });
    });
  }

  /**
   * Запуск агента
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('SYS', 'Агент уже запущен');
      return;
    }

    // Инициализация БД если ещё не инициализирована
    if (!this.initPromise) {
      this.initPromise = this.dbManager.initialize();
    }
    await this.initPromise;

    this.logger.info('INIT', `Запуск BICA агента "${this.config.agentName}"...`);

    // Инициализация привычек
    if (this.config.primingHabits) {
      await this.habitManager.initializePrimingHabits(
        this.config.primingHabits.map(h => ({
          id: h.id,
          triggerPattern: h.triggerPattern,
          action: h.action,
          strength: h.strength
        }))
      );
      this.logger.info('INIT', `Загружено ${this.config.primingHabits.length} стартовых привычек`);
    }

    // Проверка LLM с подробным логом
    this.logger.info('SYS', 'Проверка подключения к LLM...');
    try {
      const llmAvailable = await this.llmClient.healthCheck();
      if (!llmAvailable) {
        this.logger.warn('SYS', `LLM недоступен. Проверьте подключение к ${this.config.llm.baseURL}`);
        this.logger.warn('SYS', 'Модели будут загружены при первом запросе (это может занять время)');
      } else {
        this.logger.info('SYS', `LLM подключён: ${this.config.llm.provider} @ ${this.config.llm.baseURL}`);
      }
    } catch (error) {
      this.logger.error('SYS', 'Ошибка проверки LLM', error as Error);
      this.logger.warn('SYS', 'Попытка работы в режиме ожидания...');
    }

    this.isRunning = true;
    this.lastTickTime = Date.now();

    // Запуск цикла тиков
    this.tickInterval = setInterval(async () => {
      try {
        await this.tick();
      } catch (error) {
        this.logger.error('SYS', 'Ошибка в tick()', error as Error);
      }
    }, this.config.tickIntervalMs);
    this.logger.info('SYS', `Цикл тиков запущен (интервал: ${this.config.tickIntervalMs}мс)`);
  }

  /**
   * Остановка агента
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('SYS', 'Остановка агента...');

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.isRunning = false;

    // Закрытие БД
    this.dbManager.close();

    this.logger.info('SYS', 'Агент остановлен');
  }

  /**
   * Основной цикл (tick)
   * Вызывается автоматически каждые tickIntervalMs
   */
  private lastDriveLevels: Record<string, number> = {};
  
  private async tick(): Promise<void> {
    const now = Date.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;
    this.tickCount++;

    // 1. Обновление драйверов
    const driveEvents = this.driveManager.tick(deltaMs);
    const currentLevels = this.driveManager.getLevels();
    
    for (const event of driveEvents) {
      this.eventBus.publish(event);
      
      // Логирование только при изменении >5%
      const driverId = event.payload.driverId as string;
      const prevLevel = this.lastDriveLevels[driverId] || 0;
      const currentLevel = currentLevels[driverId as DriverId] || 0;
      const change = Math.abs(currentLevel - prevLevel);
      if (change >= 0.05) {
        this.logger.drive(`${driverId}: ${(currentLevel * 100).toFixed(0)}%`, {
          driverId,
          level: currentLevel,
          priority: event.priority
        });
        this.lastDriveLevels[driverId] = currentLevel;
      }

      // Запуск внутреннего диалога при важном событии драйвера (priority >= 7)
      if ((event.priority || 5) >= 7) {
        this.logger.info('DRV', `Важное событие драйвера — запуск рефлексии...`);
        await this.internalBicameralCycle(`Драйвер ${event.payload.driverId} требует внимания`);
      }
    }

    // 2. Decay рабочей памяти (каждые 10 тиков)
    if (this.tickCount % 10 === 0) {
      this.workingMemory.decay();
    }

    // 3. Очистка старой памяти (каждые 100 тиков)
    if (this.tickCount % 100 === 0) {
      this.workingMemory.cleanup();
    }

    // 4. Спонтанная рефлексия (только при простое)
    await this.checkAndRunSpontaneousReflection();
  }

  /**
   * Внутренний бикамеральный цикл (для драйверов и рефлексии)
   * Не возвращает ответ пользователю, только внутренние мысли
   */
  private async internalBicameralCycle(trigger: string): Promise<void> {
    const focus = this.workingMemory.getFocus();
    const active = this.workingMemory.getActive(5);
    const emotions = this.emotionEngine.getCurrent();
    const emotionsText = this.emotionEngine.getEmotionTexts();
    const drives = Object.entries(this.driveManager.getLevels()).map(([id, level]) => ({
      id,
      level,
      weight: this.driveManager.getDriver(id as DriverId)?.weight || 1
    }));
    const habits = await this.habitManager.getAllHabits();

    this.logger.info('SYS', `Запуск внутреннего цикла: ${trigger}`);

    // Наблюдатель: генерация мысли
    const observerPrompt = this.observerPrompt({
      agentName: this.config.agentName,
      emotions,
      emotionsText,
      drives,
      focus,
      active,
      longTermMemories: [],
      habits
    });

    const observerThought = await this.llmClient.generate(
      [{ role: 'user', content: `[Внутренний триггер] ${trigger}\n\n${observerPrompt}` }],
      this.config.llm.model.observer,
      this.config.llm.defaultParams
    );

    this.logger.observer(observerThought);

    // Добавляем мысль в рабочую память
    this.workingMemory.add({
      type: 'observer_thought',
      content: observerThought,
      timestamp: Date.now(),
      importance: 6,
      source: 'observer',
      reflectionDepth: this.workingMemory.getCurrentReflectionDepth()
    });

    // Публикация события
    this.eventBus.publish({
      id: `obs_${Date.now()}`,
      type: 'observer_thought',
      timestamp: Date.now(),
      source: 'observer',
      payload: { thought: observerThought, internal: true }
    });

    // Исполнитель: обработка мысли
    const executorPrompt = this.executorPrompt({
      agentName: this.config.agentName,
      emotions,
      emotionsText,
      drives,
      focus,
      observerThought,
      habits: []
    });

    const executorResponse = await this.llmClient.generate(
      [{ role: 'user', content: `[Внутренний диалог] ${executorPrompt}` }],
      this.config.llm.model.executor,
      this.config.llm.defaultParams
    );

    this.logger.executor(executorResponse);

    // Добавляем ответ в рабочую память
    this.workingMemory.add({
      type: 'executor_utterance',
      content: executorResponse,
      timestamp: Date.now(),
      importance: 5,
      source: 'executor',
      reflectionDepth: this.workingMemory.getCurrentReflectionDepth()
    });

    this.logger.info('SYS', `Внутренний цикл завершён`);
  }

  /**
   * Проверка условий и запуск спонтанной рефлексии
   * Запускается только когда агент простаивает
   */
  private lastReflectionTick: number = 0;
  private reflectionCooldownTicks: number = 30;  // Минимум 30 тиков между рефлексиями
  
  private async checkAndRunSpontaneousReflection(): Promise<void> {
    // Проверка cooldown
    if (this.tickCount - this.lastReflectionTick < this.reflectionCooldownTicks) {
      return;
    }
    
    // Проверка: было ли недавно сообщение от пользователя (последние 30 секунд)
    const focus = this.workingMemory.getFocus();
    const lastUserMessage = focus.find(item => item.type === 'user_message');
    const idleTime = lastUserMessage ? (Date.now() - lastUserMessage.timestamp) / 1000 : 999;
    
    // Проверка: все ли драйверы ниже порога беспокойства
    const drives = this.driveManager.getLevels();
    const allDrivesLow = Object.values(drives).every(level => level < 0.5);
    
    // Запуск если:
    // - Нет сообщений от пользователя > 30 секунд
    // - Все драйверы спокойны (<50%)
    if (idleTime > 30 && allDrivesLow) {
      this.lastReflectionTick = this.tickCount;
      this.logger.info('SYS', `Спонтанная рефлексия: простой ${Math.round(idleTime)}с, все драйверы спокойны`);
      await this.spontaneousReflection('простой');
    }
  }

  /**
   * Спонтанная рефлексия
   * Запускается когда агент простаивает
   */
  private async spontaneousReflection(reason: string): Promise<void> {
    const drives = this.driveManager.getLevels();

    // Находим самый активный драйвер
    const mostActiveDrive = Object.entries(drives)
      .sort(([, a], [, b]) => b - a)[0];

    this.logger.info('SYS', `Запуск спонтанной рефлексии: причина — ${reason}`);
    
    if (!mostActiveDrive || mostActiveDrive[1] < 0.2) {
      // Все драйверы очень спокойны — генерируем случайную тему
      this.logger.info('REFLECT', 'Все драйверы спокойны — генерация случайной темы');
      const topics = [
        'Проанализировать последние события',
        'Оценить текущее эмоциональное состояние',
        'Проверить долгосрочные цели',
        'Обдумать последние взаимодействия'
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      await this.internalBicameralCycle(`Спонтанная рефлексия: ${randomTopic}`);
      return;
    }

    const trigger = `Спонтанная рефлексия (${reason}): ${mostActiveDrive[0]} наиболее активен (${(mostActiveDrive[1] * 100).toFixed(0)}%)`;
    await this.internalBicameralCycle(trigger);
  }

  /**
   * Обработка сообщения пользователя
   * Запускает МНОГОШАГОВЫЙ бикамеральный цикл
   */
  async handleMessage(text: string): Promise<string> {
    this.logger.user(text);

    // 1. Обработка входа
    const item = this.inputProcessor.process(text);
    this.workingMemory.add(item);

    // 2. Обновление эмоций
    const weightChanges = this.emotionEngine.update(item);
    weightChanges.forEach((delta, index) => {
      const driveIds: DriverId[] = ['curiosity', 'safety', 'social', 'achievement', 'comfort'];
      if (delta !== 0) {
        this.driveManager.updateWeight(driveIds[index], delta);
      }
    });

    // 3. Публикация события
    const event: SystemEvent = {
      id: item.id,
      type: 'user_message',
      timestamp: item.timestamp,
      source: 'user',
      payload: { content: text, sentiment: item.sentiment }
    };
    this.eventBus.publish(event);

    // 4. МНОГОШАГОВЫЙ бикамеральный цикл
    const result = await this.multiStepBicameralCycle();

    // 5. Сохранение эпизода в LTM
    await this.ltm.add({
      content: text,
      timestamp: Date.now(),
      importance: item.importance,
      emotion: this.emotionEngine.getCurrent()
    });

    return result.responseText || result.executorResponse;
  }

  /**
   * МНОГОШАГОВЫЙ бикамеральный цикл
   * Наблюдатель ↔ Исполнитель пока не будет принято решение о действии
   */
  private async multiStepBicameralCycle(): Promise<BicameralCycleResult> {
    let depth = 0;
    let lastObserverThought = '';
    let lastExecutorResponse = '';
    let actionType: 'reflect' | 'response' | 'query_memory' | 'none' = 'none';
    let responseText: string | undefined;

    this.logger.info('SYS', `Запуск бикамерального цикла (макс. глубина: ${MAX_REFLECTION_DEPTH})`);

    while (depth < MAX_REFLECTION_DEPTH) {
      depth++;
      this.logger.debug('SYS', `━━━ Шаг ${depth}/${MAX_REFLECTION_DEPTH} ━━━`);

      const currentDepth = depth;
      const focus = this.workingMemory.getFocus();
      const active = this.workingMemory.getActive(5);
      const emotions = this.emotionEngine.getCurrent();
      const emotionsText = this.emotionEngine.getEmotionTexts();
      const drives = Object.entries(this.driveManager.getLevels()).map(([id, level]) => ({
        id,
        level,
        weight: this.driveManager.getDriver(id as DriverId)?.weight || 1
      }));
      const habits = await this.habitManager.getAllHabits();

      // Поиск подходящих привычек для текущего контекста
      const contextText = focus.map(f => f.content).join(' ');
      const relevantHabits = this.habitManager.findHabits(contextText, habits);

      // 1. Наблюдатель: генерация мысли
      this.logger.info('OBS', 'Наблюдатель думает...');
      const observerPrompt = this.observerPrompt({
        agentName: this.config.agentName,
        emotions,
        emotionsText,
        drives,
        focus,
        active,
        longTermMemories: [],
        habits: relevantHabits
      });

      const observerThought = await this.llmClient.generate(
        [{ role: 'user', content: observerPrompt }],
        this.config.llm.model.observer,
        this.config.llm.defaultParams
      );

      this.logger.observer(`Мысль: ${observerThought}`);
      lastObserverThought = observerThought;

      // Добавляем мысль в рабочую память с глубиной
      this.workingMemory.add({
        type: 'observer_thought',
        content: observerThought,
        timestamp: Date.now(),
        importance: 7 - depth, // Уменьшаем важность с глубиной
        source: 'observer',
        reflectionDepth: currentDepth
      });

      // Публикация события
      this.eventBus.publish({
        id: `obs_${Date.now()}_${depth}`,
        type: 'observer_thought',
        timestamp: Date.now(),
        source: 'observer',
        payload: { thought: observerThought, depth: currentDepth }
      });

      // 2. Исполнитель: генерация ответа
      this.logger.info('EXE', 'Исполнитель решает...');
      const executorPrompt = this.executorPrompt({
        agentName: this.config.agentName,
        emotions,
        emotionsText,
        drives,
        focus,
        observerThought,
        habits: relevantHabits
      });

      const executorResponse = await this.llmClient.generate(
        [{ role: 'user', content: executorPrompt }],
        this.config.llm.model.executor,
        this.config.llm.defaultParams
      );

      this.logger.executor(executorResponse);
      lastExecutorResponse = executorResponse;

      // 3. Парсинг ответа Исполнителя
      const parsed = this.parseExecutorAction(executorResponse);
      actionType = parsed.actionType;
      responseText = parsed.responseText;

      // Добавляем ответ в рабочую память
      this.workingMemory.add({
        type: 'executor_utterance',
        content: executorResponse,
        timestamp: Date.now(),
        importance: 6 - depth,
        source: 'executor',
        reflectionDepth: currentDepth
      });

      // 4. Проверка: нужно ли продолжать диалог?
      if (actionType === 'response') {
        this.logger.info('EXE', `Действие: ответ пользователю (глубина: ${depth})`);
        break; // Выход из цикла — есть действие
      }

      if (actionType === 'query_memory') {
        this.logger.memory(`Поиск: ${parsed.searchQuery || '...'}`);
        if (parsed.searchQuery) {
          const results = await this.ltm.search(parsed.searchQuery, 3);
          if (results.length > 0) {
            this.logger.memory(`Найдено: ${results.length} эпизодов`);
            for (const ep of results) {
              this.workingMemory.add({
                type: 'memory_result',
                content: ep.content,
                timestamp: Date.now(),
                importance: ep.importance,
                source: 'memory',
                reflectionDepth: currentDepth
              });
            }
          }
        }
        // Продолжаем цикл с новой информацией
      } else if (actionType === 'reflect') {
        this.logger.info('EXE', 'Продолжение рефлексии...');
        // Продолжаем цикл
      } else {
        this.logger.info('EXE', 'Нет явного действия — завершение цикла');
        break;
      }
    }

    if (depth >= MAX_REFLECTION_DEPTH) {
      this.logger.warn('SYS', `Достигнут лимит глубины рефлексии (${MAX_REFLECTION_DEPTH})`);
    }

    return {
      observerThought: lastObserverThought,
      executorResponse: lastExecutorResponse,
      actionType,
      responseText,
      depth
    };
  }

  /**
   * Парсинг действия Исполнителя
   */
  private parseExecutorAction(response: string): {
    actionType: 'reflect' | 'response' | 'query_memory' | 'none';
    responseText?: string;
    searchQuery?: string;
  } {
    const lines = response.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.startsWith('[SEND_RESPONSE]')) {
        return {
          actionType: 'response',
          responseText: line.replace('[SEND_RESPONSE]', '').trim()
        };
      }

      if (line.startsWith('[QUERY_MEMORY]')) {
        return {
          actionType: 'query_memory',
          searchQuery: line.replace('[QUERY_MEMORY]', '').trim()
        };
      }

      if (line.startsWith('[REFLECT]')) {
        return {
          actionType: 'reflect'
        };
      }
    }

    // Если нет явного тега, проверяем наличие ответа
    if (response.includes('[SEND_RESPONSE]')) {
      const match = response.match(/\[SEND_RESPONSE\]\s*(.+)/);
      if (match) {
        return {
          actionType: 'response',
          responseText: match[1].trim()
        };
      }
    }

    return { actionType: 'none' };
  }

  /**
   * Получение текущего состояния агента
   */
  getState(): AgentState {
    return {
      workingMemory: this.workingMemory.getAll(),
      emotions: this.emotionEngine.getCurrent(),
      drives: this.driveManager.getLevels(),
      reflectionDepth: this.workingMemory.getCurrentReflectionDepth()
    };
  }

  /**
   * Проверка, запущен ли агент
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Получение статистики
   */
  async getStats(): Promise<{
    tickCount: number;
    workingMemorySize: number;
    currentReflectionDepth: number;
    memoryStats: Awaited<ReturnType<LongTermMemory['getStats']>>;
  }> {
    return {
      tickCount: this.tickCount,
      workingMemorySize: this.workingMemory.getAll().length,
      currentReflectionDepth: this.workingMemory.getCurrentReflectionDepth(),
      memoryStats: await this.ltm.getStats()
    };
  }
}
