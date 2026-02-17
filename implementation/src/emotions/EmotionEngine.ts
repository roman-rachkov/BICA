import type { EmotionVector, WorkingMemoryItem, Sentiment, DriverId } from '../core/types.js';

/**
 * Правило обновления эмоций
 */
export interface EmotionUpdateRule {
  eventType: string;
  valenceDelta: number;
  arousalDelta: number;
  dominanceDelta?: number;
  condition?: string; // JavaScript-условие как строка
}

/**
 * Влияние эмоций на драйверы
 */
export interface EmotionDriveInfluence {
  driveId: DriverId;
  weightDelta: number; // Изменение веса драйвера
}

/**
 * Эмоциональный движок (VAD вектор)
 * Valence: -1..1 (негатив -> позитив)
 * Arousal: 0..1 (спокойствие -> возбуждение)
 * Dominance: 0..1 (подчинение -> доминирование)
 * 
 * ВАЖНО: Эмоции влияют на ВЕСА драйверов, а не напрямую на LLM
 */
export class EmotionEngine {
  private current: EmotionVector = {
    valence: 0,
    arousal: 0.3,
    dominance: 0.5
  };

  private rules: EmotionUpdateRule[] = [];
  private history: EmotionVector[] = [];
  private historyWindowSize: number = 3;

  // Влияние эмоций на драйверы (конфигурируемое)
  private driveInfluences: EmotionDriveInfluence[] = [];

  /**
   * Инициализация правилами обновления
   */
  init(rules: EmotionUpdateRule[], driveInfluences?: EmotionDriveInfluence[]): void {
    this.rules = rules;
    this.driveInfluences = driveInfluences || this.getDefaultDriveInfluences();
  }

  /**
   * Эмоции по умолчанию влияют на драйверы
   */
  private getDefaultDriveInfluences(): EmotionDriveInfluence[] {
    return [
      // Высокий arousal усиливает любопытство (центробежная энергия)
      { driveId: 'curiosity', weightDelta: 0.15 },
      // Низкая valence усиливает безопасность (защита)
      { driveId: 'safety', weightDelta: 0.2 },
      // Высокая valence усиливает социальность
      { driveId: 'social', weightDelta: 0.1 },
      // Высокая dominance усиливает достижение
      { driveId: 'achievement', weightDelta: 0.15 },
      // Низкий arousal усиливает комфорт (энергосбережение)
      { driveId: 'comfort', weightDelta: 0.1 }
    ];
  }

  /**
   * Обновление эмоций на основе события
   * @returns Изменения весов драйверов для применения
   */
  update(item: WorkingMemoryItem): number[] {
    const rule = this.findRule(item.type, item.sentiment);
    const weightChanges: number[] = [];
    
    if (rule) {
      // Применяем дельты
      const oldValence = this.current.valence;
      const oldArousal = this.current.arousal;
      const oldDominance = this.current.dominance;

      this.current.valence = this.clamp(-1, 1, this.current.valence + rule.valenceDelta);
      this.current.arousal = this.clamp(0, 1, this.current.arousal + rule.arousalDelta);
      this.current.dominance = this.clamp(0, 1, this.current.dominance + (rule.dominanceDelta || 0));

      // Вычисляем изменения для драйверов на основе изменений эмоций
      for (const influence of this.driveInfluences) {
        let weightDelta = 0;

        // Пример: если arousal вырос, усиливаем соответствующие драйверы
        if (influence.driveId === 'curiosity' && this.current.arousal > oldArousal) {
          weightDelta = influence.weightDelta * (this.current.arousal - oldArousal);
        }
        if (influence.driveId === 'safety' && this.current.valence < oldValence) {
          weightDelta = influence.weightDelta * Math.abs(this.current.valence - oldValence);
        }
        if (influence.driveId === 'achievement' && this.current.dominance > oldDominance) {
          weightDelta = influence.weightDelta * (this.current.dominance - oldDominance);
        }

        weightChanges.push(weightDelta);
      }
    }

    // Добавляем в историю
    this.history.push({ ...this.current });
    if (this.history.length > this.historyWindowSize) {
      this.history.shift();
    }

    return weightChanges;
  }

  /**
   * Получение текущего эмоционального вектора
   * Возвращает скользящее среднее для сглаживания
   */
  getCurrent(): EmotionVector {
    if (this.history.length === 0) {
      return { ...this.current };
    }

    // Скользящее среднее
    const sum = this.history.reduce(
      (acc, v) => ({
        valence: acc.valence + v.valence,
        arousal: acc.arousal + v.arousal,
        dominance: acc.dominance + v.dominance
      }),
      { valence: 0, arousal: 0, dominance: 0 }
    );

    const count = this.history.length;
    return {
      valence: sum.valence / count,
      arousal: sum.arousal / count,
      dominance: sum.dominance / count
    };
  }

  /**
   * Прямая установка эмоций (для отладки или внешних воздействий)
   */
  set(valence?: number, arousal?: number, dominance?: number): void {
    if (valence !== undefined) {
      this.current.valence = this.clamp(-1, 1, valence);
    }
    if (arousal !== undefined) {
      this.current.arousal = this.clamp(0, 1, arousal);
    }
    if (dominance !== undefined) {
      this.current.dominance = this.clamp(0, 1, dominance);
    }
  }

  /**
   * Сброс к нейтральному состоянию
   */
  reset(): void {
    this.current = {
      valence: 0,
      arousal: 0.3,
      dominance: 0.5
    };
    this.history = [];
  }

  /**
   * Поиск подходящего правила
   */
  private findRule(eventType: string, sentiment?: Sentiment): EmotionUpdateRule | undefined {
    for (const rule of this.rules) {
      if (rule.eventType !== eventType) continue;

      // Проверка условия (если есть)
      if (rule.condition) {
        try {
          const conditionFn = new Function('sentiment', `return ${rule.condition}`);
          if (!conditionFn(sentiment)) continue;
        } catch {
          continue;
        }
      }

      return rule;
    }

    return undefined;
  }

  /**
   * Ограничение значения диапазоном
   */
  private clamp(min: number, max: number, value: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Получение текстового описания эмоций (для промптов)
   */
  getEmotionTexts(): {
    valenceText: string;
    arousalText: string;
    dominanceText: string;
  } {
    const { valence, arousal, dominance } = this.getCurrent();

    const valenceText = valence > 0.3 ? 'позитивное' : valence < -0.3 ? 'негативное' : 'нейтральное';
    const arousalText = arousal > 0.6 ? 'возбуждённое' : arousal < 0.3 ? 'спокойное' : 'умеренное';
    const dominanceText = dominance > 0.6 ? 'уверенное' : dominance < 0.3 ? 'осторожное' : 'сбалансированное';

    return { valenceText, arousalText, dominanceText };
  }
}
