import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import moment from 'moment-timezone';

/**
 * Hook personalizado para manejar conexión Socket.io con namespace /mozos
 * @param {Function} onMesaActualizada - Callback cuando se actualiza una mesa
 * @param {Function} onComandaActualizada - Callback cuando se actualiza una comanda
 * @param {Function} onNuevaComanda - Callback cuando llega nueva comanda
 * @param {Function} onSocketStatus - Callback para cambios de estado de conexión
 * @returns {Object} { socket, connected, connectionStatus, reconnectAttempts }
 */
const useSocketMozos = ({
  onMesaActualizada,
  onComandaActualizada,
  onNuevaComanda,
  onSocketStatus
}) => {
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('desconectado'); // 'conectado', 'desconectado', 'reconectando'
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 2000; // 2 segundos
  const lastReconnectTimeRef = useRef(null);

  // Obtener URL del servidor desde apiConfig
  const getServerUrl = () => {
    // Intentar obtener desde variable de entorno o usar default
    // En React Native, podemos usar una constante
    const defaultUrl = 'http://192.168.18.11:3000';
    // Extraer base URL si viene con /api
    return defaultUrl;
  };

  useEffect(() => {
    const serverUrl = getServerUrl();
    
    console.log('🔌 [MOZOS] Conectando a Socket.io:', `${serverUrl}/mozos`);

    // Crear conexión Socket.io al namespace /mozos
    const socket = io(`${serverUrl}/mozos`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      timeout: 20000,
      // Opciones para evitar desconexiones temporales
      forceNew: false, // Reutilizar conexión existente
      autoConnect: true, // Conectar automáticamente
      closeOnBeforeunload: false // No cerrar al navegar
    });

    socketRef.current = socket;

    // Evento: Conexión establecida
    socket.on('connect', () => {
      const reconnectTime = lastReconnectTimeRef.current 
        ? Math.round((Date.now() - lastReconnectTimeRef.current) / 1000)
        : 0;
      
      if (reconnectAttemptsRef.current > 0) {
        console.log(`✅ [MOZOS] Socket reconectado después de ${reconnectTime}s (intento ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
      } else {
        console.log('✅ [MOZOS] Socket conectado:', socket.id);
      }
      
      setConnected(true);
      setConnectionStatus('conectado');
      setReconnectAttempts(0);
      reconnectAttemptsRef.current = 0;
      lastReconnectTimeRef.current = null;
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: true, status: 'conectado' });
      }
    });

    // Evento: Desconexión
    socket.on('disconnect', (reason) => {
      console.warn('❌ [MOZOS] Socket desconectado:', reason);
      setConnected(false);
      setConnectionStatus('desconectado');
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: false, status: 'desconectado' });
      }
    });

    // Evento: Intentando reconectar
    socket.on('reconnect_attempt', (attemptNumber) => {
      reconnectAttemptsRef.current = attemptNumber;
      setReconnectAttempts(attemptNumber);
      setConnectionStatus('reconectando');
      
      if (!lastReconnectTimeRef.current) {
        lastReconnectTimeRef.current = Date.now();
      }
      
      console.log(`🔄 [MOZOS] Intentando reconectar... (${attemptNumber}/${maxReconnectAttempts})`);
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: false, status: 'reconectando', attempts: attemptNumber });
      }
    });

    // Evento: Reconexión exitosa
    socket.on('reconnect', (attemptNumber) => {
      const reconnectTime = lastReconnectTimeRef.current 
        ? Math.round((Date.now() - lastReconnectTimeRef.current) / 1000)
        : 0;
      
      console.log(`✅ [MOZOS] Socket reconectado después de ${reconnectTime}s (intento ${attemptNumber}/${maxReconnectAttempts})`);
      setConnected(true);
      setConnectionStatus('conectado');
      setReconnectAttempts(0);
      reconnectAttemptsRef.current = 0;
      lastReconnectTimeRef.current = null;
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: true, status: 'conectado' });
      }
    });

    // Evento: Error de conexión
    socket.on('connect_error', (error) => {
      console.error('❌ [MOZOS] Error de conexión Socket.io:', error.message);
      setConnectionStatus('desconectado');
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: false, status: 'desconectado', error: error.message });
      }
    });

    // Evento: Reconexión fallida
    socket.on('reconnect_failed', () => {
      console.error('❌ [MOZOS] Reconexión fallida después de', maxReconnectAttempts, 'intentos');
      setConnectionStatus('desconectado');
      setReconnectAttempts(maxReconnectAttempts);
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: false, status: 'desconectado', failed: true });
      }
    });

    // Evento: Mesa actualizada
    socket.on('mesa-actualizada', (data) => {
      console.log('📥 [MOZOS] Mesa actualizada recibida:', data.mesaId);
      
      if (onMesaActualizada && data.mesa) {
        onMesaActualizada(data.mesa);
      }
    });

    // Evento: Comanda actualizada
    socket.on('comanda-actualizada', (data) => {
      console.log('📥 [MOZOS] Comanda actualizada recibida:', data.comandaId, 'Comanda completa:', !!data.comanda);
      
      if (onComandaActualizada) {
        if (data.comanda) {
          // Si viene la comanda completa, usarla directamente
          onComandaActualizada(data.comanda);
        } else if (data.comandaId) {
          // Si no viene la comanda completa, notificar con el ID
          // El handler debería hacer un fetch si es necesario
          onComandaActualizada({ _id: data.comandaId });
        }
      }
    });

    // 🔥 EVENTO CRÍTICO: Comanda revertida - Soluciona el problema de desincronización
    // ESTÁNDAR INDUSTRIA: El evento incluye tanto comanda como mesa para evitar condición de carrera
    socket.on('comanda-revertida', (data) => {
      console.log('🔄 [MOZOS] Comanda revertida recibida:', data.comandaId, 'Status:', data.comanda?.status, 'Mesa:', data.mesa?.nummesa, 'Estado mesa:', data.mesa?.estado);
      
      // Actualizar comanda
      if (onComandaActualizada && data.comanda) {
        onComandaActualizada(data.comanda);
      }
      
      // CRÍTICO: Actualizar mesa directamente del evento (evita condición de carrera)
      if (onMesaActualizada && data.mesa) {
        onMesaActualizada(data.mesa);
        console.log(`✅ [MOZOS] Mesa ${data.mesa.nummesa} actualizada desde evento comanda-revertida: ${data.mesa.estado}`);
      }
    });

    // Evento: Nueva comanda
    socket.on('nueva-comanda', (data) => {
      console.log('📥 [MOZOS] Nueva comanda recibida:', data.comanda?.comandaNumber);
      
      if (onNuevaComanda && data.comanda) {
        onNuevaComanda(data.comanda);
      }
    });

    // Evento: Estado de socket (heartbeat)
    socket.on('socket-status', (data) => {
      if (data.connected !== undefined) {
        setConnected(data.connected);
        setConnectionStatus(data.connected ? 'conectado' : 'desconectado');
      }
    });

    // Cleanup - NO desconectar el socket ya que está en contexto global
    // El socket se mantiene activo en todas las pantallas
    // IMPORTANTE: No hacer cleanup del socket aquí porque está en contexto global
    // Solo limpiar timeouts si existen
    return () => {
      console.log('🧹 [MOZOS] Limpiando listeners (socket se mantiene activo en contexto global)');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // NO desconectar el socket - debe mantenerse activo
      // socket.disconnect(); // NO hacer esto - el socket es global
    };
  }, []); // Solo ejecutar una vez al montar - el socket vive en el contexto

  return {
    socket: socketRef.current,
    connected,
    connectionStatus,
    reconnectAttempts
  };
};

export default useSocketMozos;

