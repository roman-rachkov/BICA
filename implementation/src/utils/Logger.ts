import { EventEmitter } from 'events';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Уровни логирования
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'EVENT';

/**
 * Типы событий для логирования
 */
export type LogEventType = 
  | 'INIT'      // Инициализация
  | 'DRV'       // Драйверы
  | 'EMO'       // Эмоции
  | 'OBS'       // Наблюдатель
  | 'EXE'       // Исполнитель
  | 'MEM'       // Память
  | 'USER'      // Пользователь
  | 'AGENT'     // Ответ агента
  | 'SYS'       // Системные
  | 'TUI'       // TUI события
  | 'REFLECT';  // Рефлексия

/**
 * Структура лог-сообщения
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: LogEventType;
  message: string;
  data?: any;
}

/**
 * Конфигурация логгера
 */
export interface LoggerConfig {
  logDir: string;
  consoleLevel: LogLevel;  // Минимальный уровень для консоли
  fileLevel: LogLevel;     // Минимальный уровень для файла
  sessionName?: string;    // Имя сессии (для имени файла)
}

/**
 * Логгер с выводом в файл и событиями для TUI
 * 
 * - Все логи пишутся в файл
 * - В консоль/TUI только важные события
 * - EventEmitter для интеграции с TUI
 */
export class Logger extends EventEmitter {
  private config: LoggerConfig;
  private logStream: any;
  private sessionFile: string;
  private messageCount: number = 0;
  private useTUI: boolean = false;  // Флаг: использовать ли TUI режим

  constructor(config: LoggerConfig) {
    super();
    this.config = config;
    
    // Создаём директорию для логов
    const logDir = join(process.cwd(), config.logDir);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Имя файла сессии
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.sessionFile = config.sessionName 
      ? `${config.sessionName}-${timestamp}.log`
      : `session-${timestamp}.log`;

    const logPath = join(logDir, this.sessionFile);
    this.logStream = createWriteStream(logPath, { flags: 'a' });

    // Не пишем в консоль при инициализации — TUI сам покажет
  }

  /**
   * Включить TUI режим (отключает console.log)
   */
  enableTUIMode(): void {
    this.useTUI = true;
  }

  /**
   * Логирование сообщения
   */
  log(level: LogLevel, type: LogEventType, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      data
    };

    this.messageCount++;

    // Форматирование для файла
    const fileLine = this.formatForFile(entry);
    this.logStream.write(fileLine + '\n');

    // Событие для TUI (все события)
    this.emit('log', entry);

    // В консоль только если НЕ TUI режим
    if (!this.useTUI && this.shouldLogToConsole(level)) {
      const consoleLine = this.formatForConsole(entry);
      console.log(consoleLine);
    }
  }

  /**
   * Краткий лог для TUI (без времени, только суть)
   */
  logToTUI(type: LogEventType, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      type,
      message
    };
    
    this.emit('log', entry);
  }

  /**
   * Детальный лог (только в файл)
   */
  debug(type: LogEventType, message: string, data?: any): void {
    this.log('DEBUG', type, message, data);
  }

  /**
   * Обычный лог
   */
  info(type: LogEventType, message: string): void {
    this.log('INFO', type, message);
  }

  /**
   * Предупреждение
   */
  warn(type: LogEventType, message: string): void {
    this.log('WARN', type, message);
  }

  /**
   * Ошибка
   */
  error(type: LogEventType, message: string, error?: Error): void {
    const errorMsg = error ? `${message}: ${error.message}` : message;
    this.log('ERROR', type, errorMsg, error?.stack);
  }

  /**
   * Событие драйвера
   */
  drive(message: string, data?: any): void {
    this.log('INFO', 'DRV', message, data);
  }

  /**
   * Мысль Наблюдателя
   */
  observer(message: string): void {
    this.log('INFO', 'OBS', message);
  }

  /**
   * Решение Исполнителя
   */
  executor(message: string): void {
    this.log('INFO', 'EXE', message);
  }

  /**
   * Ввод пользователя
   */
  user(message: string): void {
    this.log('INFO', 'USER', message);
  }

  /**
   * Ответ агента
   */
  agent(message: string): void {
    this.log('INFO', 'AGENT', message);
  }

  /**
   * Событие памяти
   */
  memory(message: string): void {
    this.log('INFO', 'MEM', message);
  }

  /**
   * Инициализация
   */
  init(message: string): void {
    this.log('INFO', 'INIT', message);
  }

  /**
   * Системное событие
   */
  system(message: string): void {
    this.log('INFO', 'SYS', message);
  }

  /**
   * Получение статистики
   */
  getStats(): { messageCount: number; sessionFile: string } {
    return {
      messageCount: this.messageCount,
      sessionFile: this.sessionFile
    };
  }

  /**
   * Закрытие логгера
   */
  close(): void {
    this.logStream.end();
    this.removeAllListeners();
  }

  /**
   * Проверка: нужно ли писать в консоль
   */
  private shouldLogToConsole(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const consoleIndex = levels.indexOf(this.config.consoleLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= consoleIndex;
  }

  /**
   * Форматирование для файла
   */
  private formatForFile(entry: LogEntry): string {
    const ts = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS
    return `[${ts}] [${entry.level}] [${entry.type}] ${entry.message}`;
  }

  /**
   * Форматирование для консоли (с цветами через ANSI)
   */
  private formatForConsole(entry: LogEntry): string {
    const ts = entry.timestamp.split('T')[1].split('.')[0];
    const colors = {
      'DEBUG': '\x1b[90m',   // Серый
      'INFO': '\x1b[36m',    // Голубой
      'WARN': '\x1b[33m',    // Жёлтый
      'ERROR': '\x1b[31m',   // Красный
      'EVENT': '\x1b[35m'    // Фиолетовый
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';

    const icons: Record<LogEventType, string> = {
      'INIT': '🚀',
      'DRV': '⚡',
      'EMO': '💓',
      'OBS': '💭',
      'EXE': '🎯',
      'MEM': '📚',
      'USER': '👤',
      'AGENT': '🤖',
      'SYS': '⚙️',
      'TUI': '📺',
      'REFLECT': '🤔'
    };

    const icon = icons[entry.type] || '•';
    return `${color}[${ts}]${reset} ${icon} [${entry.type}] ${entry.message}`;
  }
}

/**
 * Глобальный экземпляр логгера (singleton)
 */
let globalLogger: Logger | null = null;

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initGlobalLogger first.');
  }
  return globalLogger;
}

export function initGlobalLogger(config: LoggerConfig): Logger {
  if (globalLogger) {
    globalLogger.close();
  }
  globalLogger = new Logger(config);
  return globalLogger;
}
