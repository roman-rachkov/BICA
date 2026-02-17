#!/usr/bin/env node

import { BicameralEngine } from './engine/BicameralEngine.js';
import { ConfigLoader } from './config/ConfigLoader.js';
import { initGlobalLogger, getGlobalLogger, TUIManager } from './utils/index.js';
import type { LogEntry } from './utils/index.js';

/**
 * Консольный интерфейс для BICA MVP
 * Версия 3: TUI с 3 панелями + логирование в файл
 */

const VERSION = '0.2.0';

async function main() {
  // Загрузка конфигурации (ДО логгера и TUI)
  let configPath: string | undefined = undefined;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Использование: bica [options]

Опции:
  -c, --config <path>  Путь к файлу конфигурации (JSON)
  -h, --help           Показать эту справку
  -v, --version        Показать версию
      `.trim());
      return;
    } else if (args[i] === '--version' || args[i] === '-v') {
      console.log(`BICA MVP v${VERSION}`);
      return;
    }
  }

  let config;
  try {
    config = ConfigLoader.loadWithEnv(configPath);
  } catch (error) {
    console.error(`Ошибка загрузки конфигурации: ${(error as Error).message}`);
    return;
  }

  // СНАЧАЛА создаём TUI
  const tui = new TUIManager({
    icons: config.tui?.icons === true
  });

  // ПОТОМ инициализируем логгер с TUI режимом
  const logger = initGlobalLogger({
    logDir: './logs',
    consoleLevel: 'INFO',
    fileLevel: 'DEBUG',
    sessionName: 'bica'
  });
  
  const globalLogger = getGlobalLogger();
  globalLogger.enableTUIMode();  // Отключаем console.log
  globalLogger.on('log', (entry: LogEntry) => {
    tui.addLogEntry(entry);
  });

  // Теперь логи идут в TUI
  logger.init('Запуск BICA Agent v' + VERSION);
  logger.info('SYS', `Конфигурация загружена: ${configPath || 'default'}`);
  logger.info('SYS', `Агент: ${config.agentName}`);
  logger.info('SYS', `LLM: ${config.llm.provider} @ ${config.llm.baseURL}`);

  // Создание и запуск движка
  const engine = new BicameralEngine(config, globalLogger);

  logger.info('INIT', 'Инициализация движка...');

  try {
    await engine.start();
    logger.info('INIT', 'Движок запущен');
  } catch (error) {
    logger.error('SYS', 'Ошибка запуска движка', error as Error);
    tui.destroy();
    return;
  }

  // Обновление статуса TUI
  tui.startAutoUpdate(500);

  // Периодическое обновление статуса (тик, память)
  const statusInterval = setInterval(async () => {
    const state = engine.getState();
    const stats = await engine.getStats();
    
    // Получаем веса драйверов
    const drivesWithWeights = {
      curiosity: { level: state.drives.curiosity, weight: 1 },
      safety: { level: state.drives.safety, weight: 1 },
      social: { level: state.drives.social, weight: 1 },
      achievement: { level: state.drives.achievement, weight: 1 },
      comfort: { level: state.drives.comfort, weight: 1 }
    };
    
    tui.updateStatus({
      emotions: state.emotions,
      drives: drivesWithWeights,
      memory: {
        focus: state.workingMemory.filter(w => w.importance > 5).length,
        active: state.workingMemory.length,
        ltm: stats.memoryStats.episodeCount
      },
      session: {
        ticks: stats.tickCount,
        depth: state.reflectionDepth || 0
      }
    } as any);
  }, 1000);

  // Обработчик выхода
  let isExiting = false;
  const cleanup = async () => {
    if (isExiting) return;
    isExiting = true;

    logger.info('SYS', 'Завершение работы...');

    tui.stopAutoUpdate();
    if (statusInterval) {
      clearInterval(statusInterval);
    }

    try {
      await engine.stop();
      logger.info('SYS', 'Движок остановлен');
    } catch (e) {
      // Игнорируем ошибки при остановке
    }

    const stats = globalLogger.getStats();
    logger.info('SYS', `Всего логов: ${stats.messageCount}`);
    logger.info('SYS', `Лог файл: ${stats.sessionFile}`);

    globalLogger.close();
    tui.destroy();

    process.exit(0);
  };

  // Обработчик ввода от TUI — используем screen.emit('input')
  const tuiScreen = (tui as any).screen;
  tuiScreen.on('input', async (text: string) => {
    if (!text.trim()) return;

    // Обработка команд
    if (text.startsWith('/')) {
      const command = text.toLowerCase().trim();

      switch (command) {
        case '/help':
        case '/h':
        case '/?':
          logger.info('SYS', 'Команды: /help, /status, /stats, /config, /clear, /exit');
          break;

        case '/status': {
          const state = engine.getState();
          logger.info('SYS', `Эмоции: V=${state.emotions.valence.toFixed(2)}, A=${state.emotions.arousal.toFixed(2)}, D=${state.emotions.dominance.toFixed(2)}`);
          // Обновляем статус в TUI
          const drivesWithWeights = {
            curiosity: { level: state.drives.curiosity, weight: 1 },
            safety: { level: state.drives.safety, weight: 1 },
            social: { level: state.drives.social, weight: 1 },
            achievement: { level: state.drives.achievement, weight: 1 },
            comfort: { level: state.drives.comfort, weight: 1 }
          };
          tui.updateStatus({
            emotions: state.emotions,
            drives: drivesWithWeights,
            session: { depth: state.reflectionDepth || 0 }
          } as any);
          break;
        }

        case '/stats': {
          const stats = await engine.getStats();
          logger.info('SYS', `Тики: ${stats.tickCount}, WM: ${stats.workingMemorySize}, LTM: ${stats.memoryStats.episodeCount}`);
          // Обновляем память в TUI
          tui.updateStatus({
            memory: {
              focus: stats.workingMemorySize, // Приблизительно
              active: 0,
              ltm: stats.memoryStats.episodeCount
            }
          } as any);
          break;
        }

        case '/exit':
        case '/quit':
        case '/bye':
          await cleanup();
          break;

        default:
          logger.warn('SYS', `Неизвестная команда: ${command}`);
      }
    } else {
      // Обычное сообщение
      logger.user(text);

      try {
        const response = await engine.handleMessage(text);
        if (response) {
          logger.agent(response);
        }
        // Обновляем статус после ответа
        const state = engine.getState();
        const drivesWithWeights = {
          curiosity: { level: state.drives.curiosity, weight: 1 },
          safety: { level: state.drives.safety, weight: 1 },
          social: { level: state.drives.social, weight: 1 },
          achievement: { level: state.drives.achievement, weight: 1 },
          comfort: { level: state.drives.comfort, weight: 1 }
        };
        tui.updateStatus({
          emotions: state.emotions,
          drives: drivesWithWeights,
          session: { depth: state.reflectionDepth || 0 }
        } as any);
      } catch (error) {
        logger.error('AGENT', 'Ошибка обработки сообщения', error as Error);
      }
    }
  });

  // Обработчик выхода из TUI
  tuiScreen.on('exit', async () => {
    await cleanup();
  });

  // Резервный путь завершения: сигналы ОС
  process.on('SIGINT', async () => {
    await cleanup();
  });
  process.on('SIGTERM', async () => {
    await cleanup();
  });

  logger.info('INIT', 'Агент готов к работе. Введите сообщение или /help');
}

// Запуск с обработкой ошибок
main().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
