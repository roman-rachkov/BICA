import type { Habit } from '../core/types.js';
import { LongTermMemory } from '../memory/LongTermMemory.js';

/**
 * Менеджер привычек
 * Поиск паттернов, обучение с подкреплением
 */
export class HabitManager {
  private ltm: LongTermMemory;

  constructor(ltm: LongTermMemory) {
    this.ltm = ltm;
  }

  /**
   * Поиск подходящих привычек по контексту
   * @param context - текст для поиска паттернов
   * @param habits - массив привычек для поиска
   * @returns отсортированные по силе привычки, чьи паттерны совпадают
   */
  findHabits(context: string, habits: Habit[]): Habit[] {
    const lowerContext = context.toLowerCase();
    const matchedHabits: Array<Habit & { score: number }> = [];

    for (const habit of habits) {
      const score = this.calculateMatchScore(lowerContext, habit.triggerPattern.toLowerCase());
      if (score > 0) {
        matchedHabits.push({
          ...habit,
          score
        });
      }
    }

    // Сортируем по комбинации силы и релевантности
    return matchedHabits
      .sort((a, b) => (b.strength * b.score) - (a.strength * a.score))
      .slice(0, 3); // Возвращаем топ-3
  }

  /**
   * Расчёт релевантности паттерна к контексту
   */
  private calculateMatchScore(context: string, pattern: string): number {
    const patternWords = pattern.split(/\s+/).filter(w => w.length > 2);
    if (patternWords.length === 0) return 0;

    let matchCount = 0;
    for (const word of patternWords) {
      if (context.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / patternWords.length;
  }

  /**
   * Запись исхода для привычки
   * @param habitId - ID привычки
   * @param outcome - исход (0-1, где 1 = успешно)
   */
  async recordOutcome(habitId: string, outcome: number): Promise<void> {
    await this.ltm.addHabitOutcome(habitId, outcome);

    // Получаем привычку для обновления силы
    const habits = await this.ltm.getHabits();
    const habit = habits.find((h: Habit) => h.id === habitId);
    if (!habit) return;

    // Вычисляем среднее из буфера
    const avgOutcome = habit.outcomeBuffer.length > 0
      ? habit.outcomeBuffer.reduce((a: number, b: number) => a + b, 0) / habit.outcomeBuffer.length
      : outcome;

    // Обновляем силу: Δstrength = 0.1 * (outcome - expectedOutcome)
    const expectedOutcome = 0.5; // Нейтральное ожидание
    const delta = 0.1 * (avgOutcome - expectedOutcome);
    
    await this.ltm.updateHabitStrength(habitId, delta);
  }

  /**
   * Инициализация стартовых привычек
   */
  async initializePrimingHabits(habits: Array<Omit<Habit, 'outcomeBuffer'>>): Promise<void> {
    const existingHabits = await this.ltm.getHabits();
    const existingIds = new Set(existingHabits.map((h: Habit) => h.id));

    for (const habit of habits) {
      if (!existingIds.has(habit.id)) {
        await this.ltm.saveHabit({
          ...habit,
          outcomeBuffer: []
        });
      }
    }
  }

  /**
   * Получение всех привычек
   */
  async getAllHabits(): Promise<Habit[]> {
    return await this.ltm.getHabits();
  }

  /**
   * Сохранение привычки
   */
  async saveHabit(habit: Habit): Promise<void> {
    await this.ltm.saveHabit(habit);
  }

  /**
   * Удаление привычки
   */
  async deleteHabit(habitId: string): Promise<void> {
    await this.ltm.deleteHabit(habitId);
  }
}
