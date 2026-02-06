/**
 * Sistema de queue offline para eventos Socket.io
 * Almacena eventos cuando está offline y los procesa al reconectar
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@socket_offline_queue';
const MAX_QUEUE_SIZE = 100;

class OfflineQueue {
  constructor() {
    this.queue = [];
    this.listeners = [];
    this.isProcessing = false;
  }

  /**
   * Agregar evento a la queue
   */
  async addEvent(eventType, eventData) {
    try {
      const event = {
        type: eventType,
        data: eventData,
        timestamp: Date.now()
      };

      // Cargar queue existente
      const existingQueue = await this.loadQueue();
      
      // Agregar nuevo evento
      existingQueue.push(event);
      
      // Limitar tamaño de queue
      if (existingQueue.length > MAX_QUEUE_SIZE) {
        existingQueue.shift(); // Eliminar el más antiguo
      }
      
      // Guardar queue
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existingQueue));
      this.queue = existingQueue;
      
      console.log(`📦 [OFFLINE QUEUE] Evento agregado: ${eventType} (${existingQueue.length} en queue)`);
    } catch (error) {
      console.error('❌ [OFFLINE QUEUE] Error agregando evento:', error);
    }
  }

  /**
   * Cargar queue desde AsyncStorage
   */
  async loadQueue() {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
        return this.queue;
      }
      return [];
    } catch (error) {
      console.error('❌ [OFFLINE QUEUE] Error cargando queue:', error);
      return [];
    }
  }

  /**
   * Procesar todos los eventos en la queue
   */
  async processQueue(handlers) {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const queue = await this.loadQueue();
      
      if (queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`🔄 [OFFLINE QUEUE] Procesando ${queue.length} evento(s) pendiente(s)`);

      // Procesar eventos en orden
      for (const event of queue) {
        const handler = handlers[event.type];
        if (handler) {
          try {
            await handler(event.data);
            console.log(`✅ [OFFLINE QUEUE] Evento procesado: ${event.type}`);
          } catch (error) {
            console.error(`❌ [OFFLINE QUEUE] Error procesando evento ${event.type}:`, error);
          }
        }
      }

      // Limpiar queue después de procesar
      await AsyncStorage.removeItem(QUEUE_KEY);
      this.queue = [];
      
      console.log(`✅ [OFFLINE QUEUE] Queue procesada y limpiada`);
    } catch (error) {
      console.error('❌ [OFFLINE QUEUE] Error procesando queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Limpiar queue
   */
  async clearQueue() {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
      this.queue = [];
      console.log('🧹 [OFFLINE QUEUE] Queue limpiada');
    } catch (error) {
      console.error('❌ [OFFLINE QUEUE] Error limpiando queue:', error);
    }
  }

  /**
   * Obtener tamaño de queue
   */
  async getQueueSize() {
    const queue = await this.loadQueue();
    return queue.length;
  }
}

// Singleton
const offlineQueue = new OfflineQueue();

export default offlineQueue;


