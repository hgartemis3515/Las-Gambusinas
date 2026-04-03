import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import moment from 'moment-timezone';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketURL } from '../apiConfig';

/**
 * Hook personalizado para manejar conexión Socket.io con namespace /mozos
 * OPTIMIZADO: Heartbeat, reconexión automática, persistencia, autenticación JWT
 * @param {Function} onMesaActualizada - Callback cuando se actualiza una mesa
 * @param {Function} onComandaActualizada - Callback cuando se actualiza una comanda
 * @param {Function} onNuevaComanda - Callback cuando llega nueva comanda
 * @param {Function} onSocketStatus - Callback para cambios de estado de conexión
 * @param {string} token - Token JWT para autenticación Socket.io (obligatorio)
 * @returns {Object} { socket, connected, connectionStatus, reconnectAttempts, authError }
 */
const useSocketMozos = ({
  onMesaActualizada,
  onComandaActualizada,
  onNuevaComanda,
  onSocketStatus,
  onMesasJuntadas,
  onMesasSeparadas,
  onMapaActualizado,
  onCatalogoMesasAreas,
  token // Token JWT para autenticación
}) => {
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('desconectado'); // 'conectado', 'desconectado', 'reconectando', 'auth_error'
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [authError, setAuthError] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const lastPingRef = useRef(null);
  const roomsJoinedRef = useRef(new Set()); // Track rooms joined for rejoin on reconnect
  const authFailedRef = useRef(false); // Flag para no reintentar tras error de auth
  const maxReconnectAttempts = 10;
  const initialDelay = 1000; // 1 segundo inicial
  const maxDelay = 5000; // 5 segundos máximo (más agresivo)
  const heartbeatInterval = 25000; // 25 segundos (menor que timeout de 30s del servidor)
  const lastReconnectTimeRef = useRef(null);

  useEffect(() => {
    // VALIDACIÓN: Token es obligatorio para conectar
    if (!token) {
      console.warn('⚠️ [MOZOS] No hay token JWT, no se puede conectar a Socket.io');
      
      // Desconectar socket existente si hay uno
      if (socketRef.current) {
        console.log('[MOZOS] Desconectando socket existente por falta de token');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      setConnectionStatus('desconectado');
      setAuthError(null);
      authFailedRef.current = false;
      return;
    }

    // Si ya falló la autenticación, no reintentar
    if (authFailedRef.current) {
      console.log('[MOZOS] Autenticación previamente fallida, no reintentando');
      return;
    }

    // Obtener URL del servidor desde configuración dinámica
    const serverUrl = getWebSocketURL();
    
    const wsURL = `${serverUrl}/mozos`;
    console.log('🔌 [MOZOS] Conectando a Socket.io:', wsURL, 'con token JWT');

    // Crear conexión Socket.io al namespace /mozos con backoff exponencial
    // OPTIMIZADO: Configuración bulletproof para conexión permanente
    // IMPORTANTE: Enviar token en auth para autenticación
    const socket = io(wsURL, {
      transports: ['websocket', 'polling'], // WebSocket primero, polling fallback
      reconnection: true,
      reconnectionDelay: initialDelay, // Delay inicial 1s
      reconnectionDelayMax: maxDelay, // Delay máximo 5s (más agresivo)
      reconnectionAttempts: maxReconnectAttempts, // 10 intentos
      timeout: 20000, // 20s timeout inicial
      // Opciones para evitar desconexiones temporales
      forceNew: false, // Reutilizar conexión existente
      autoConnect: true, // Conectar automáticamente
      closeOnBeforeunload: false, // No cerrar al navegar
      // Opciones adicionales para estabilidad
      upgrade: true, // Permitir upgrade de polling a websocket
      rememberUpgrade: true, // Recordar preferencia de transporte
      // Ping/pong para mantener conexión viva
      pingTimeout: 60000, // 60s timeout ping (mayor que heartbeat 25s)
      pingInterval: 25000, // 25s intervalo ping (igual que heartbeat)
      // 🔥 MEJORADO: Opciones para evitar desconexiones durante operaciones HTTP
      allowUpgrades: true, // Permitir upgrades de transporte
      // Configuración para manejar mejor los "transport error"
      randomizationFactor: 0.5, // Factor de aleatoriedad en backoff (0-1)
      // Aumentar tolerancia a errores temporales
      reconnectionDelayFactor: 1.5, // Factor de incremento en backoff (más conservador)
      // 🔥 AUTENTICACIÓN JWT: Enviar token en el handshake
      auth: {
        token: token
      }
    });

    socketRef.current = socket;

    // 🔥 Función para iniciar heartbeat
    const startHeartbeat = () => {
      // Limpiar heartbeat anterior si existe
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Heartbeat cada 25 segundos
      heartbeatIntervalRef.current = setInterval(() => {
        if (socket && socket.connected) {
          const pingTime = Date.now();
          socket.emit('heartbeat-ping', { timestamp: pingTime });
          lastPingRef.current = pingTime;
          console.log('💓 [MOZOS] Heartbeat enviado');
          
          // Guardar último ping en AsyncStorage
          AsyncStorage.setItem('socketLastPing', pingTime.toString()).catch(() => {});
        }
      }, heartbeatInterval);
    };

    // 🔥 Función para rejoin rooms después de reconexión
    const rejoinRooms = () => {
      if (socket && socket.connected && roomsJoinedRef.current.size > 0) {
        console.log(`🔄 [MOZOS] Rejoin ${roomsJoinedRef.current.size} rooms después de reconexión`);
        roomsJoinedRef.current.forEach(mesaId => {
          socket.emit('join-mesa', mesaId);
          console.log(`📌 [MOZOS] Rejoin room mesa-${mesaId}`);
        });
      }
    };

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
      
      // Iniciar heartbeat
      startHeartbeat();
      
      // Rejoin rooms si había alguno
      rejoinRooms();
      
      // Guardar estado de conexión
      AsyncStorage.setItem('socketConnected', 'true').catch(() => {});
      AsyncStorage.setItem('socketReconnects', '0').catch(() => {});
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: true, status: 'conectado' });
      }
    });

    // Evento: Desconexión
    socket.on('disconnect', (reason) => {
      // 🔥 MEJORADO: Manejo inteligente de desconexiones
      // "transport error" es común durante operaciones HTTP y se reconecta automáticamente
      // No mostrar como error crítico si se reconecta rápidamente
      
      const isTransportError = reason === 'transport error' || reason === 'transport close';
      const isTemporaryDisconnect = isTransportError || reason === 'ping timeout';
      
      if (isTemporaryDisconnect) {
        // Desconexión temporal (común durante operaciones HTTP)
        // Solo log en desarrollo, no como warning crítico
        if (__DEV__) {
          console.log(`🔄 [MOZOS] Desconexión temporal: ${reason} (reconexión automática en curso)`);
        }
      } else {
        // Desconexión no esperada, mostrar warning
        console.warn(`❌ [MOZOS] Socket desconectado: ${reason}`);
      }
      
      // Detener heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      setConnected(false);
      setConnectionStatus('desconectado');
      
      // Guardar estado
      AsyncStorage.setItem('socketConnected', 'false').catch(() => {});
      
      // Solo cambiar a "reconectando" si no es un disconnect manual
      if (reason !== 'io client disconnect') {
        // Socket.io manejará la reconexión automáticamente
        setConnectionStatus('reconectando');
      }
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: false, status: 'desconectado', reason });
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
      
      // Guardar intentos de reconexión
      AsyncStorage.setItem('socketReconnects', attemptNumber.toString()).catch(() => {});
      
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
      
      // Reiniciar heartbeat
      startHeartbeat();
      
      // Rejoin rooms
      rejoinRooms();
      
      // Guardar estado
      AsyncStorage.setItem('socketConnected', 'true').catch(() => {});
      AsyncStorage.setItem('socketReconnects', '0').catch(() => {});
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({ connected: true, status: 'conectado' });
      }
    });

    // Evento: Error de conexión
    socket.on('connect_error', (error) => {
      const errorMsg = error.message || '';
      
      // Detectar errores de autenticación
      const isAuthError = errorMsg.includes('Autenticación') || 
                          errorMsg.includes('Token') || 
                          errorMsg.includes('permisos');
      
      if (isAuthError) {
        console.error('❌ [MOZOS] Error de autenticación Socket.io:', errorMsg);
        setAuthError(errorMsg);
        setConnectionStatus('auth_error');
        setConnected(false);
        authFailedRef.current = true;
        
        // Desconectar y no reintentar
        socket.disconnect();
        
        if (onSocketStatus) {
          onSocketStatus({ connected: false, status: 'auth_error', error: errorMsg });
        }
      } else {
        console.error('❌ [MOZOS] Error de conexión Socket.io:', errorMsg);
        setConnectionStatus('desconectado');
        
        if (onSocketStatus) {
          onSocketStatus({ connected: false, status: 'desconectado', error: errorMsg });
        }
      }
      
      // Socket.io ya tiene reconexión automática con backoff exponencial
      // No necesitamos hacer nada adicional aquí
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

    // FASE 4: Evento granular de plato actualizado (solo datos mínimos)
    socket.on('plato-actualizado', (data) => {
      console.log('📥 FASE4: [MOZOS] Plato actualizado granular recibido:', {
        comandaId: data.comandaId,
        platoId: data.platoId,
        nuevoEstado: data.nuevoEstado,
        estadoAnterior: data.estadoAnterior,
        mesaId: data.mesaId
      });
      
      // FASE 4: Notificar cambio de estado para parpadeo del indicador
      if (onSocketStatus) {
        // Cambiar temporalmente a 'online-active' para parpadeo
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        // Volver a 'conectado' después de 2 segundos
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
      
      // Pasar el evento al handler si existe (para actualización granular)
      if (onComandaActualizada) {
        // Pasar datos granulares para actualización selectiva
        onComandaActualizada({
          tipo: 'plato-actualizado-granular',
          comandaId: data.comandaId,
          platoId: data.platoId,
          nuevoEstado: data.nuevoEstado,
          estadoAnterior: data.estadoAnterior,
          mesaId: data.mesaId,
          timestamp: data.timestamp
        });
      }
    });

    // 🔥 NUEVO: Evento de plato anulado por cocina
    socket.on('plato-anulado', (data) => {
      console.log('❌ [MOZOS] Plato anulado por cocina:', data.platoAnulado?.nombre, 'Comanda:', data.comandaId);
      
      // Notificar cambio de estado para parpadeo del indicador
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
      
      // Pasar el evento al handler
      if (onComandaActualizada && data.comanda) {
        onComandaActualizada({
          tipo: 'plato-anulado',
          comandaId: data.comandaId,
          comanda: data.comanda,
          platoAnulado: data.platoAnulado,
          auditoria: data.auditoria,
          timestamp: data.timestamp
        });
      }
    });

    // 🔥 NUEVO: Evento de comanda completamente anulada por cocina
    socket.on('comanda-anulada', (data) => {
      console.log('❌ [MOZOS] Comanda anulada por cocina:', data.comandaNumber, 'Total:', data.totalAnulado);
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
      
      // Actualizar comanda
      if (onComandaActualizada && data.comanda) {
        onComandaActualizada({
          tipo: 'comanda-anulada',
          comandaId: data.comandaId,
          comanda: data.comanda,
          platosAnulados: data.platosAnulados,
          totalAnulado: data.totalAnulado,
          motivoGeneral: data.motivoGeneral,
          timestamp: data.timestamp
        });
      }
      
      // Actualizar mesa si viene el dato
      if (onMesaActualizada && data.mesaId) {
        // La mesa debería actualizarse después de refrescar
        console.log(`✅ [MOZOS] Mesa ${data.numMesa} afectada por anulación de comanda`);
      }
    });

    // Evento: Estado de socket (heartbeat del servidor)
    socket.on('socket-status', (data) => {
      if (data.connected !== undefined) {
        setConnected(data.connected);
        setConnectionStatus(data.connected ? 'conectado' : 'desconectado');
      }
    });

    // 🔥 Evento: Heartbeat respuesta del servidor
    socket.on('heartbeat-pong', (data) => {
      if (lastPingRef.current && data.timestamp) {
        const latency = Date.now() - lastPingRef.current;
        console.log(`💓 [MOZOS] Heartbeat recibido (latencia: ${latency}ms)`);
      }
    });

    // ========== EVENTOS DE JUNTAR/SEPARAR MESAS ==========

    // Evento: Mesas juntadas
    socket.on('mesas-juntadas', (data) => {
      console.log('🔗 [MOZOS] Mesas juntadas recibido:', {
        mesaPrincipal: data.mesaPrincipal?.nummesa,
        totalMesas: data.totalMesas,
        mozoId: data.mozoId
      });
      
      // Notificar cambio de estado para parpadeo del indicador
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
      
      // Actualizar la mesa principal si el handler existe
      if (onMesaActualizada && data.mesaPrincipal) {
        onMesaActualizada(data.mesaPrincipal);
      }
      
      // Actualizar mesas secundarias
      if (onMesaActualizada && data.mesasSecundarias) {
        data.mesasSecundarias.forEach(mesa => {
          onMesaActualizada(mesa);
        });
      }
    });

    // Evento: Mesas separadas
    socket.on('mesas-separadas', (data) => {
      console.log('🔗 [MOZOS] Mesas separadas recibido:', {
        mesaPrincipal: data.mesaPrincipal?.nummesa,
        mesasLiberadas: data.totalMesasLiberadas,
        mozoId: data.mozoId
      });
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
      
      // Actualizar todas las mesas afectadas
      if (onMesaActualizada && data.mesaPrincipal) {
        onMesaActualizada(data.mesaPrincipal);
      }
      
      if (onMesaActualizada && data.mesasSecundarias) {
        data.mesasSecundarias.forEach(mesa => {
          onMesaActualizada(mesa);
        });
      }
    });

    // ========== FIN EVENTOS JUNTAR/SEPARAR ==========

    // Catálogo mesas/áreas (admin areas.html / mesas.html)
    socket.on('catalogo-mesas-areas-actualizado', (data) => {
      console.log('📋 [MOZOS] Catálogo mesas/áreas actualizado:', data?.razon, data?.timestamp);
      if (onCatalogoMesasAreas) {
        onCatalogoMesasAreas(data);
      }
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
    });

    // ========== EVENTO DE MAPA ACTUALIZADO ==========
    
    // Evento: Mapa de mesas actualizado (admin guardó cambios)
    socket.on('mapa-actualizado', (data) => {
      console.log('🗺️ [MOZOS] Mapa actualizado recibido:', {
        areaId: data.areaId,
        timestamp: data.timestamp
      });
      
      // Notificar cambio para que InicioScreen recargue el mapa
      if (onMapaActualizado && data.areaId) {
        onMapaActualizado(data);
      }
      
      // Notificar cambio de estado visual
      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }
    });

    // ========== FIN EVENTO MAPA ==========

    // Cleanup - NO desconectar el socket ya que está en contexto global
    // El socket se mantiene activo en todas las pantallas
    // IMPORTANTE: No hacer cleanup del socket aquí porque está en contexto global
    // Solo limpiar timeouts e intervals si existen
    return () => {
      console.log('🧹 [MOZOS] Limpiando listeners (socket se mantiene activo en contexto global)');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      // NO desconectar el socket - debe mantenerse activo
      // socket.disconnect(); // NO hacer esto - el socket es global
    };
  }, [token]); // Reconectar cuando el token cambie

  // 🔥 Función para trackear rooms (usada por SocketContext)
  const trackRoom = (mesaId) => {
    if (mesaId) {
      roomsJoinedRef.current.add(mesaId);
    }
  };

  const untrackRoom = (mesaId) => {
    if (mesaId) {
      roomsJoinedRef.current.delete(mesaId);
    }
  };

  return {
    socket: socketRef.current,
    connected,
    connectionStatus,
    reconnectAttempts,
    authError,
    trackRoom,
    untrackRoom
  };
};

export default useSocketMozos;

