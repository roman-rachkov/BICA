import type { DriverConfig, DriverId, DriverState, SystemEvent, DriverPolarity } from '../core/types.js';

/**
 * Менеджер драйверов (5 потребностей)
 * Отслеживает уровни потребностей и генерирует события при достижении порогов
 */
export class DriveManager {
  private drivers: Map<DriverId, DriverState>;
  private configs: Map<DriverId, DriverConfig>;
  private lastUpdate: number = Date.now();

  constructor() {
    this.drivers = new Map();
    this.configs = new Map();
  }

  /**
   * Инициализация драйверов конфигурацией
   */
  init(configs: DriverConfig[]): void {
    for (const config of configs) {
      this.configs.set(config.id, config);
      this.drivers.set(config.id, {
        id: config.id,
        level: config.baseLevel,
        weight: 1.0  // Базовый вес
      });
    }
  }

  /**
   * Обновление уровней драйверов
   * Вызывается каждый тик с дельтой времени
   * @returns массив событий drive_event для драйверов, достигших порога
   */
  tick(deltaMs: number): SystemEvent[] {
    const events: SystemEvent[] = [];
    const deltaSeconds = deltaMs / 1000;

    for (const [id, state] of this.drivers) {
      const config = this.configs.get(id);
      if (!config) continue;

      // Увеличиваем уровень (потребность растёт со временем)
      state.level = Math.min(1, state.level + config.decayRate * deltaSeconds);

      // Проверка на достижение высокого порога (критическое событие)
      if (state.level >= config.thresholdHigh) {
        events.push(this.createDriveEvent(id, state.level, 'high'));
        // Сбрасываем уровень к базовому
        state.level = config.baseLevel;
      }
      // Проверка на достижение низкого порога (беспокойство)
      else if (state.level >= config.thresholdLow && state.level < config.thresholdHigh) {
        // Генерируем событие с низким приоритетом
        events.push(this.createDriveEvent(id, state.level, 'low'));
      }
    }

    this.lastUpdate = Date.now();
    return events;
  }

  /**
   * Обновление веса драйвера на основе эмоций
   */
  updateWeight(id: DriverId, weightDelta: number): void {
    const state = this.drivers.get(id);
    if (!state) return;

    state.weight = Math.max(0.1, Math.min(2.0, state.weight + weightDelta));
  }

  /**
   * Сброс весов всех драйверов
   */
  resetWeights(): void {
    for (const state of this.drivers.values()) {
      state.weight = 1.0;
    }
  }

  /**
   * Уменьшение уровня драйвера (удовлетворение потребности)
   */
  reduceLevel(id: DriverId, amount: number): void {
    const state = this.drivers.get(id);
    if (!state) return;

    state.level = Math.max(0, state.level - amount);
  }

  /**
   * Увеличение уровня драйвера (фрустрация потребности)
   */
  increaseLevel(id: DriverId, amount: number): void {
    const state = this.drivers.get(id);
    if (!state) return;

    state.level = Math.min(1, state.level + amount);
  }

  /**
   * Получение текущих уровней всех драйверов
   */
  getLevels(): Record<DriverId, number> {
    const levels = {} as Record<DriverId, number>;
    
    levels.curiosity = this.drivers.get('curiosity')?.level || 0;
    levels.safety = this.drivers.get('safety')?.level || 0;
    levels.social = this.drivers.get('social')?.level || 0;
    levels.achievement = this.drivers.get('achievement')?.level || 0;
    levels.comfort = this.drivers.get('comfort')?.level || 0;

    return levels;
  }

  /**
   * Получение весов драйверов
   */
  getWeights(): Record<DriverId, number> {
    const weights = {} as Record<DriverId, number>;
    
    weights.curiosity = this.drivers.get('curiosity')?.weight || 1;
    weights.safety = this.drivers.get('safety')?.weight || 1;
    weights.social = this.drivers.get('social')?.weight || 1;
    weights.achievement = this.drivers.get('achievement')?.weight || 1;
    weights.comfort = this.drivers.get('comfort')?.weight || 1;

    return weights;
  }

  /**
   * Получение состояния конкретного драйвера
   */
  getDriver(id: DriverId): DriverState | undefined {
    return this.drivers.get(id);
  }

  /**
   * Создание события драйвера
   */
  private createDriveEvent(id: DriverId, level: number, urgency: 'low' | 'high'): SystemEvent {
    const config = this.configs.get(id);
    const priority = urgency === 'high' ? 8 + Math.floor(level * 2) : 4 + Math.floor(level * 2);

    let content: string;
    switch (id) {
      case 'curiosity':
        content = `Любопытство: хочу узнать что-то новое (уровень: ${(level * 100).toFixed(0)}%)`;
        break;
      case 'safety':
        content = `Безопасность: чувствую угрозу, нужна осторожность (уровень: ${(level * 100).toFixed(0)}%)`;
        break;
      case 'social':
        content = `Социальность: хочу общаться, быть понятым (уровень: ${(level * 100).toFixed(0)}%)`;
        break;
      case 'achievement':
        content = `Достижение: хочу решить задачу, достичь цели (уровень: ${(level * 100).toFixed(0)}%)`;
        break;
      case 'comfort':
        content = `Комфорт: хочу отдохнуть, снизить напряжение (уровень: ${(level * 100).toFixed(0)}%)`;
        break;
    }

    return {
      id: `drive_${Date.now()}_${id}_${urgency}`,
      type: 'drive_event',
      timestamp: Date.now(),
      source: 'drive',
      payload: {
        driverId: id,
        level,
        urgency
      },
      priority
    };
  }

  /**
   * Сброс всех драйверов к базовым уровням
   */
  reset(): void {
    for (const [id, config] of this.configs) {
      const state = this.drivers.get(id);
      if (state) {
        state.level = config.baseLevel;
        state.weight = 1.0;
      }
    }
  }
}
