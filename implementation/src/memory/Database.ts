import initSqlJs, { Database } from 'sql.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Менеджер базы данных SQLite на основе sql.js (WebAssembly)
 * Создаёт и мигрирует таблицы для долговременной памяти
 */
export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    
    // Создаём директорию если не существует
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Инициализация базы данных
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();
    
    // Загружаем существующую БД или создаём новую
    try {
      if (existsSync(this.dbPath)) {
        const fileBuffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }
    } catch {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.initialized = true;
  }

  /**
   * Запуск миграций
   */
  private runMigrations(): void {
    if (!this.db) return;

    // Таблица эпизодов
    this.db.run(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        importance REAL NOT NULL,
        emotion_valence REAL,
        emotion_arousal REAL,
        emotion_dominance REAL
      )
    `);

    // Простой текстовый поиск (без FTS5 в sql.js)
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_episodes_content ON episodes(content)
    `);

    // Таблица привычек
    this.db.run(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        trigger_pattern TEXT NOT NULL,
        action TEXT NOT NULL,
        strength REAL NOT NULL DEFAULT 0.5,
        outcome_buffer TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Индексы для производительности
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp DESC)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance DESC)
    `);

    this.save();
  }

  /**
   * Сохранение БД на диск
   */
  save(): void {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  /**
   * Получение экземпляра Database для прямых запросов
   */
  getDatabase(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Закрытие соединения
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Очистка всех данных (для тестов)
   */
  clear(): void {
    if (!this.db) return;

    this.db.run('DELETE FROM episodes');
    this.db.run('DELETE FROM habits');
    this.save();
  }
}
