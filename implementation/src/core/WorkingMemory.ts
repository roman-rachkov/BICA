import type { WorkingMemoryItem, MemoryItemType, MemorySource, Sentiment } from './types.js';

/**
 * Рабочая память с двумя уровнями: Focus и Active
 * Focus — текущий фокус внимания (последние N элементов)
 * Active — активный контекст (более старые, но ещё релевантные элементы)
 */
export class WorkingMemory {
  private focus: WorkingMemoryItem[] = [];
  private active: WorkingMemoryItem[] = [];
  
  private maxFocusSize: number;
  private maxActiveSize: number;
  private decayHalfLifeTicks: number;
  private maxAgeMs: number;
  private ticks: number = 0;

  constructor(
    maxFocusSize: number = 5,
    maxActiveSize: number = 15,
    decayHalfLifeTicks: number = 100,
    maxAgeMs: number = 3600000 // 1 час
  ) {
    this.maxFocusSize = maxFocusSize;
    this.maxActiveSize = maxActiveSize;
    this.decayHalfLifeTicks = decayHalfLifeTicks;
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * Добавление элемента в рабочую память
   * @returns ID добавленного элемента
   */
  add(item: Omit<WorkingMemoryItem, 'id'>): string {
    const id = this.generateId();
    const newItem: WorkingMemoryItem = { 
      ...item, 
      id,
      tags: item.tags || [],
      reflectionDepth: item.reflectionDepth || 0
    };
    
    // Добавляем в Focus
    this.focus.unshift(newItem);
    
    // Обрезаем до максимального размера
    if (this.focus.length > this.maxFocusSize) {
      const moved = this.focus.pop();
      if (moved) {
        this.active.unshift(moved);
      }
    }
    
    // Обрезаем Active
    if (this.active.length > this.maxActiveSize) {
      this.active.pop();
    }
    
    return id;
  }

  /**
   * Получение элементов из Focus
   */
  getFocus(limit?: number): WorkingMemoryItem[] {
    const items = limit ? this.focus.slice(0, limit) : [...this.focus];
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Получение элементов из Active
   */
  getActive(limit?: number): WorkingMemoryItem[] {
    const items = limit ? this.active.slice(0, limit) : [...this.active];
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Получение всех элементов рабочей памяти
   */
  getAll(): WorkingMemoryItem[] {
    return [...this.focus, ...this.active];
  }

  /**
   * Получение текущей глубины рефлексии (максимальная из Focus)
   */
  getCurrentReflectionDepth(): number {
    if (this.focus.length === 0) return 0;
    const maxDepth = Math.max(...this.focus.map(item => item.reflectionDepth || 0));
    return maxDepth;
  }

  /**
   * Decay важности элементов
   * Уменьшает важность в 2 раза каждые decayHalfLifeTicks тиков
   */
  decay(): void {
    this.ticks++;
    const decayFactor = Math.pow(0.5, 1 / this.decayHalfLifeTicks);
    
    // Decay в Focus
    this.focus = this.focus
      .map(item => ({
        ...item,
        importance: item.importance * decayFactor
      }))
      .filter(item => item.importance > 0.1);
    
    // Decay в Active
    this.active = this.active
      .map(item => ({
        ...item,
        importance: item.importance * decayFactor
      }))
      .filter(item => item.importance > 0.1);
    
    // Перемещаем элементы из Focus в Active если Focus переполнен
    while (this.focus.length > this.maxFocusSize) {
      const moved = this.focus.pop();
      if (moved) {
        this.active.unshift(moved);
      }
    }
    
    // Обрезаем Active
    if (this.active.length > this.maxActiveSize) {
      this.active = this.active.slice(0, this.maxActiveSize);
    }
  }

  /**
   * Удаление старых элементов
   */
  cleanup(): void {
    const now = Date.now();
    this.focus = this.focus.filter(item => now - item.timestamp < this.maxAgeMs);
    this.active = this.active.filter(item => now - item.timestamp < this.maxAgeMs);
  }

  /**
   * Очистка всей рабочей памяти
   */
  clear(): void {
    this.focus = [];
    this.active = [];
    this.ticks = 0;
  }

  /**
   * Получение размера Focus
   */
  getFocusSize(): number {
    return this.focus.length;
  }

  /**
   * Получение размера Active
   */
  getActiveSize(): number {
    return this.active.length;
  }

  /**
   * Генерация уникального ID
   */
  private generateId(): string {
    return `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
