import type { MemoryEpisode, Habit, EmotionVector } from '../core/types.js';
import { DatabaseManager } from './Database.js';

/**
 * Долговременная память на основе SQLite (sql.js)
 * Хранит эпизоды и привычки, поддерживает текстовый поиск
 */
export class LongTermMemory {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Поиск эпизодов по запросу (простой LIKE поиск)
   */
  async search(query: string, limit: number = 10): Promise<MemoryEpisode[]> {
    const db = this.dbManager.getDatabase();
    
    // Разбиваем запрос на слова и ищем по каждому
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) {
      return [];
    }

    // Строим LIKE запрос для каждого слова
    const conditions = words.map(() => 'LOWER(content) LIKE ?').join(' OR ');
    const params = words.map(w => `%${w}%`);

    const stmt = db.prepare(`
      SELECT id, content, timestamp, importance,
             emotion_valence, emotion_arousal, emotion_dominance
      FROM episodes
      WHERE ${conditions}
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `);

    stmt.bind([...params, limit]);
    const rows: any[] = [];
    
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      timestamp: row.timestamp,
      importance: row.importance,
      emotion: row.emotion_valence !== null ? {
        valence: row.emotion_valence,
        arousal: row.emotion_arousal,
        dominance: row.emotion_dominance
      } : undefined
    }));
  }

  /**
   * Добавление эпизода в память
   */
  async add(episode: Omit<MemoryEpisode, 'id'>): Promise<string> {
    const db = this.dbManager.getDatabase();
    const id = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = db.prepare(`
      INSERT INTO episodes (id, content, timestamp, importance,
                           emotion_valence, emotion_arousal, emotion_dominance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id,
      episode.content,
      episode.timestamp,
      episode.importance,
      episode.emotion?.valence ?? null,
      episode.emotion?.arousal ?? null,
      episode.emotion?.dominance ?? null
    ]);
    stmt.free();

    this.dbManager.save();
    return id;
  }

  /**
   * Получение последних эпизодов
   */
  async getRecent(limit: number = 20): Promise<MemoryEpisode[]> {
    const db = this.dbManager.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, content, timestamp, importance,
             emotion_valence, emotion_arousal, emotion_dominance
      FROM episodes
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    stmt.bind([limit]);
    const rows: any[] = [];
    
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      timestamp: row.timestamp,
      importance: row.importance,
      emotion: row.emotion_valence !== null ? {
        valence: row.emotion_valence,
        arousal: row.emotion_arousal,
        dominance: row.emotion_dominance
      } : undefined
    }));
  }

  /**
   * Получение всех привычек
   */
  async getHabits(): Promise<Habit[]> {
    const db = this.dbManager.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, trigger_pattern, action, strength, outcome_buffer
      FROM habits
      ORDER BY strength DESC
    `);

    const rows: any[] = [];
    
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    return rows.map(row => ({
      id: row.id,
      triggerPattern: row.trigger_pattern,
      action: row.action,
      strength: row.strength,
      outcomeBuffer: row.outcome_buffer ? JSON.parse(row.outcome_buffer) : []
    }));
  }

  /**
   * Добавление или обновление привычки
   */
  async saveHabit(habit: Habit): Promise<void> {
    const db = this.dbManager.getDatabase();
    const now = Date.now();

    // Проверяем существование
    const checkStmt = db.prepare('SELECT id FROM habits WHERE id = ?');
    checkStmt.bind([habit.id]);
    const exists = checkStmt.step();
    checkStmt.free();

    let stmt;
    if (exists) {
      stmt = db.prepare(`
        UPDATE habits 
        SET trigger_pattern = ?, action = ?, strength = ?, 
            outcome_buffer = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run([
        habit.triggerPattern,
        habit.action,
        habit.strength,
        JSON.stringify(habit.outcomeBuffer),
        now,
        habit.id
      ]);
    } else {
      stmt = db.prepare(`
        INSERT INTO habits 
        (id, trigger_pattern, action, strength, outcome_buffer, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        habit.id,
        habit.triggerPattern,
        habit.action,
        habit.strength,
        JSON.stringify(habit.outcomeBuffer),
        now,
        now
      ]);
    }
    stmt.free();

    this.dbManager.save();
  }

  /**
   * Обновление силы привычки
   */
  async updateHabitStrength(habitId: string, delta: number): Promise<void> {
    const db = this.dbManager.getDatabase();

    // Получаем текущую силу
    const stmt = db.prepare('SELECT strength FROM habits WHERE id = ?');
    stmt.bind([habitId]);

    let currentStrength = 0.5;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      currentStrength = typeof row.strength === 'number' ? row.strength : 0.5;
    }
    stmt.free();

    const newStrength = Math.max(0, Math.min(1, currentStrength + delta));

    const updateStmt = db.prepare(`
      UPDATE habits
      SET strength = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run([newStrength, Date.now(), habitId]);
    updateStmt.free();

    this.dbManager.save();
  }

  /**
   * Добавление исхода к привычке (буфер последних 5)
   */
  async addHabitOutcome(habitId: string, outcome: number): Promise<void> {
    const db = this.dbManager.getDatabase();

    const stmt = db.prepare('SELECT outcome_buffer FROM habits WHERE id = ?');
    stmt.bind([habitId]);

    let buffer: number[] = [];
    if (stmt.step()) {
      const row = stmt.getAsObject();
      const bufferStr = row.outcome_buffer;
      buffer = (bufferStr && typeof bufferStr === 'string') ? JSON.parse(bufferStr) : [];
    }
    stmt.free();

    buffer.push(outcome);

    // Храним только последние 5
    if (buffer.length > 5) {
      buffer.shift();
    }

    const updateStmt = db.prepare(`
      UPDATE habits
      SET outcome_buffer = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run([JSON.stringify(buffer), Date.now(), habitId]);
    updateStmt.free();

    this.dbManager.save();
  }

  /**
   * Удаление привычки
   */
  async deleteHabit(habitId: string): Promise<void> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare('DELETE FROM habits WHERE id = ?');
    stmt.run([habitId]);
    stmt.free();
    this.dbManager.save();
  }

  /**
   * Получение статистики памяти
   */
  async getStats(): Promise<{
    episodeCount: number;
    habitCount: number;
    oldestEpisode: number;
    newestEpisode: number;
  }> {
    const db = this.dbManager.getDatabase();

    // Эпизоды
    const epStmt = db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as oldest, MAX(timestamp) as newest
      FROM episodes
    `);
    epStmt.step();
    const episodeStats = epStmt.getAsObject();
    epStmt.free();

    // Привычки
    const habStmt = db.prepare('SELECT COUNT(*) as count FROM habits');
    habStmt.step();
    const habitStats = habStmt.getAsObject();
    habStmt.free();

    return {
      episodeCount: typeof episodeStats.count === 'number' ? episodeStats.count : 0,
      habitCount: typeof habitStats.count === 'number' ? habitStats.count : 0,
      oldestEpisode: typeof episodeStats.oldest === 'number' ? episodeStats.oldest : 0,
      newestEpisode: typeof episodeStats.newest === 'number' ? episodeStats.newest : 0
    };
  }
}
