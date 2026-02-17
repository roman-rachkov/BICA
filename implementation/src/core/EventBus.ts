import EventEmitter from 'eventemitter3';
import type { SystemEvent } from './types.js';

/**
 * Шина событий для коммуникации между компонентами системы
 * Использует EventEmitter3 для лёгкой и эффективной работы
 */
export class EventBus extends EventEmitter {
  /**
   * Публикация события
   */
  publish(event: SystemEvent): void {
    this.emit(event.type, event);
    this.emit('*', event); // Глобальный слушатель для всех событий
  }

  /**
   * Подписка на событие определённого типа
   * @returns функция отписки
   */
  subscribe(
    type: string,
    handler: (event: SystemEvent) => void
  ): () => void {
    this.on(type, handler);
    return () => this.off(type, handler);
  }

  /**
   * Подписка на все события
   */
  subscribeAll(
    handler: (event: SystemEvent) => void
  ): () => void {
    this.on('*', handler);
    return () => this.off('*', handler);
  }
}
