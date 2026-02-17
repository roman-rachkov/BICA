import neoBlessed from 'neo-blessed';
import type { LogEntry, LogEventType } from './Logger.js';
import type { DriverId, EmotionVector } from '../core/types.js';

const blessed = neoBlessed;

export interface TUIOptions {
  icons?: boolean;
}

/**
 * Менеджер TUI интерфейса на основе neo-blessed
 * Версия для Windows/PowerShell
 */
export class TUIManager {
  private screen: any;
  private systemLogBox: any;
  private llmLogBox: any;
  private statusBox: any;
  private inputBox: any;
  private headerBox: any;
  
  private systemLogLines: string[] = [];
  private llmLogLines: string[] = [];
  private maxLogLines: number = 500;
  private readonly iconsEnabled: boolean;

  private statusData: {
    emotions: EmotionVector;
    drives: Record<DriverId, { level: number; weight: number }>;
    memory: { focus: number; active: number; ltm: number };
    session: { ticks: number; depth: number; uptime: number };
  };

  private updateInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  private static SYSTEM_TYPES: LogEventType[] = ['SYS', 'DRV', 'INIT', 'MEM', 'TUI', 'EMO', 'REFLECT'];
  private static LLM_TYPES: LogEventType[] = ['OBS', 'EXE', 'USER', 'AGENT'];
  constructor(options: TUIOptions = {}) {
    this.iconsEnabled = options.icons === true;
    this.screen = blessed.screen({
      smartCSR: true,
      useBCE: true,
      dockBorders: false,
      resizeTimeout: 300,
      program: blessed.program(),
      title: 'BICA Agent',
      fullUnicode: true,
      autoPadding: true
    });

    this.statusData = {
      emotions: { valence: 0, arousal: 0.3, dominance: 0.5 },
      drives: {
        curiosity: { level: 0, weight: 1 },
        safety: { level: 0, weight: 1 },
        social: { level: 0, weight: 1 },
        achievement: { level: 0, weight: 1 },
        comfort: { level: 0, weight: 1 }
      },
      memory: { focus: 0, active: 0, ltm: 0 },
      session: { ticks: 0, depth: 0, uptime: 0 }
    };

    this.createLayout();
    this.setupEventHandlers();
  }

  private createLayout(): void {
    if (this.headerBox) {
      this.screen.remove(this.headerBox);
      this.screen.remove(this.systemLogBox);
      this.screen.remove(this.llmLogBox);
      this.screen.remove(this.statusBox);
      this.screen.remove(this.inputBox);
    }
  
    const width = Math.max(this.screen.width || 80, 80);
    const height = Math.max(this.screen.height || 24, 24);

    // Header
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: width,
      height: 3,
      content: this.getHeaderContent(),
      tags: true,
      border: { type: 'line', fg: 'cyan' },
      style: { fg: 'white', bg: 'blue' }
    });
    this.screen.append(this.headerBox);

    const mainTop = 3;
    const mainHeight = height - mainTop - 3;

    const systemWidth = Math.floor(width * 0.25);
    const statusWidth = Math.floor(width * 0.30);
    const llmWidth = width - systemWidth - statusWidth;

    // System Log — С БОРОДЕРОМ
    this.systemLogBox = blessed.box({
      top: mainTop,
      left: 0,
      width: systemWidth,
      height: mainHeight,
      label: this.iconsEnabled ? ' 📋 System ' : ' System ',
      tags: true,
      content: '',
      scrollable: true,
      alwaysScroll: true,
      border: { type: 'line', fg: 'cyan' },
      padding: { top: 0, left: 1, right: 1, bottom: 0 },
      style: { fg: 'white', bg: 'black' }
    });
    this.screen.append(this.systemLogBox);

    // LLM Log
    this.llmLogBox = blessed.box({
      top: mainTop,
      left: systemWidth,
      width: llmWidth,
      height: mainHeight,
      label: this.iconsEnabled ? ' 💭 LLM ' : ' LLM ',
      tags: true,
      content: '',
      scrollable: true,
      alwaysScroll: true,
      border: { type: 'line', fg: 'cyan' },
      padding: { top: 0, left: 1, right: 1, bottom: 0 },
      style: { fg: 'white', bg: 'black' }
    });
    this.screen.append(this.llmLogBox);

    // Status
    this.statusBox = blessed.box({
      top: mainTop,
      left: systemWidth + llmWidth,
      width: statusWidth,
      height: mainHeight,
      label: this.iconsEnabled ? ' 📊 Status ' : ' Status ',
      tags: true,
      content: this.getStatusContent(),
      border: { type: 'line', fg: 'cyan' },
      padding: { top: 0, left: 1, right: 1, bottom: 0 },
      style: { fg: 'white', bg: 'black' }
    });
    this.screen.append(this.statusBox);

    // Input
    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: width,
      height: 3,
      label: this.iconsEnabled ? ' 👤 Ввод: ' : ' Ввод: ',
      tags: true,
      border: { type: 'line', fg: 'green' },
      style: { fg: 'white', bg: 'black' },
      inputOnFocus: true,
      keys: true
    });
    this.screen.append(this.inputBox);

    // Страховка: когда фокус в textbox, Ctrl+C/Ctrl+Q может не всплыть до screen
    this.inputBox.key(['C-c', 'C-q'], () => {
      this.emitExit();
    });

    this.screen.render();

    setTimeout(() => {
      this.inputBox.focus();
    }, 100);
  }

  private setupEventHandlers(): void {
    // Resize
    this.screen.on('resize', () => {
      this.createLayout();
    });

    // Ctrl+C и Ctrl+Q — выход (глобальный обработчик)
    this.screen.key(['C-c', 'C-q'], () => {
      this.emitExit();
    });

    // Низкоуровневый перехват из program для терминалов, где screen.key не срабатывает стабильно
    this.screen.program.key(['C-c', 'C-q'], () => {
      this.emitExit();
    });

    // Дополнительно: process.on для Windows
    process.on('SIGINT', () => {
      this.emitExit();
    });

    // Ctrl+L очистка
    this.screen.key(['C-l'], () => {
      this.clearLogs();
    });

    // PageUp/PageDown
    this.screen.key(['pageup'], () => {
      this.systemLogBox.setScrollPerc(Math.max(0, this.systemLogBox.getScrollPerc() - 10));
      this.llmLogBox.setScrollPerc(Math.max(0, this.llmLogBox.getScrollPerc() - 10));
      this.screen.render();
    });

    this.screen.key(['pagedown'], () => {
      this.systemLogBox.setScrollPerc(Math.min(100, this.systemLogBox.getScrollPerc() + 10));
      this.llmLogBox.setScrollPerc(Math.min(100, this.llmLogBox.getScrollPerc() + 10));
      this.screen.render();
    });

    // Ввод — ТОЛЬКО ОДИН обработчик
    this.inputBox.on('submit', (value: string) => {
      const text = value.trim();
      if (text) {
        this.emitInput(text);
      }
      this.inputBox.clearValue();
      this.inputBox.focus();
    });
  }

  addLogEntry(entry: LogEntry): void {
    if (!this.systemLogBox || !this.llmLogBox) return;

    const icon = this.iconsEnabled ? this.getIconForType(entry.type) : '';
    const color = this.getColorForType(entry.type);
    const ts = entry.timestamp.split('T')[1].split('.')[0];

    const iconPart = icon ? `${icon} ` : '';
    const line = `{${color}-fg}[${ts}]{/${color}-fg} ${iconPart}{bold}[${entry.type}]{/bold} ${entry.message}`;
    
    if (TUIManager.SYSTEM_TYPES.includes(entry.type)) {
      this.systemLogLines.push(line);
      if (this.systemLogLines.length > this.maxLogLines) {
        this.systemLogLines.shift();
      }
      this.systemLogBox.setContent(this.systemLogLines.join('\n'));
      this.systemLogBox.setScrollPerc(100);
    }

    if (TUIManager.LLM_TYPES.includes(entry.type)) {
      this.llmLogLines.push(line);
      if (this.llmLogLines.length > this.maxLogLines) {
        this.llmLogLines.shift();
      }
      this.llmLogBox.setContent(this.llmLogLines.join('\n'));
      this.llmLogBox.setScrollPerc(100);
    }

    this.screen.render();
  }

  updateStatus(data: Partial<typeof this.statusData>): void {
    if (data.emotions) this.statusData.emotions = data.emotions;
    if (data.drives) this.statusData.drives = data.drives;
    if (data.memory) this.statusData.memory = data.memory;
    if (data.session) this.statusData.session = data.session;
    
    this.statusData.session.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    this.statusBox.setContent(this.getStatusContent());
    this.screen.render();
  }

  clearLogs(): void {
    this.systemLogLines = [];
    this.llmLogLines = [];
    this.systemLogBox.setContent('');
    this.llmLogBox.setContent('');
    this.screen.render();
  }

  startAutoUpdate(intervalMs: number = 500): void {
    if (this.updateInterval) clearInterval(this.updateInterval);
    
    this.updateInterval = setInterval(() => {
      this.statusData.session.uptime = Math.floor((Date.now() - this.startTime) / 1000);
      this.statusBox.setContent(this.getStatusContent());
      this.headerBox.setContent(this.getHeaderContent());
      this.screen.render();
    }, intervalMs);
  }

  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // onInput не используется — обработчик только в setupEventHandlers
  onInput(_callback: (text: string) => void): void {}

  destroy(): void {
    this.stopAutoUpdate();
    this.screen.destroy();
  }

  private emitExit() { this.screen.emit('exit'); }
  private emitInput(value: string) { this.screen.emit('input', value); }

  private getHeaderContent(): string {
    const uptime = this.formatUptime(this.statusData.session.uptime);
    return ` BICA Agent v0.2 | Алекс | ${uptime} | {green-fg}Running{/green-fg} `;
  }

  private getStatusContent(): string {
    const { emotions, drives, memory, session } = this.statusData;

    const emotionBars = [
      this.createBar('V', emotions.valence, -1, 1),
      this.createBar('A', emotions.arousal, 0, 1),
      this.createBar('D', emotions.dominance, 0, 1)
    ].join('\n');

    const driveBars = Object.entries(drives)
      .map(([id, data]) => {
        const level = typeof data === 'number' ? data : (data.level || 0);
        return `  ${id.padEnd(11)}: ${this.createBar('', level, 0, 1)} ${Math.round(level * 100)}%`;
      })
      .join('\n');

    return `
{cyan-fg}═══ Emotions ═══{/cyan-fg}
${emotionBars}

{cyan-fg}═══ Drives ═══{/cyan-fg}
${driveBars}

{cyan-fg}═══ Memory ═══{/cyan-fg}
  Focus:  ${memory.focus}/5
  Active: ${memory.active}/15
  LTM:    ${memory.ltm}

{cyan-fg}═══ Session ═══{/cyan-fg}
  Ticks:   ${session.ticks}
  Depth:   ${session.depth}
  Uptime:  ${this.formatUptime(session.uptime)}
`.trim();
  }

  private createBar(label: string, value: number, min: number, max: number): string {
    const normalized = (value - min) / (max - min);
    const filled = Math.round(normalized * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    if (label) return `  ${label}: ${bar} ${value.toFixed(2)}`;
    return bar;
  }

  private formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private getIconForType(type: LogEventType): string {
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
    return icons[type] || '•';
  }

  private getColorForType(type: LogEventType): string {
    const colors: Record<LogEventType, string> = {
      'INIT': 'green', 'DRV': 'yellow', 'EMO': 'magenta', 'OBS': 'cyan',
      'EXE': 'blue', 'MEM': 'gray', 'USER': 'white', 'AGENT': 'green',
      'SYS': 'red', 'TUI': 'white', 'REFLECT': 'magenta'
    };
    return colors[type] || 'white';
  }
}
