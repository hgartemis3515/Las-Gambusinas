import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { io } from 'socket.io-client';
import moment from 'moment-timezone';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWebSocketURL } from '../apiConfig';
import {
  showLocalPush,
  isComandaListaEnCocina,
  shouldNotifyMozoAsignado,
  notifyPlatoListoLocal,
  notifyPlatoSalioLocal,
} from '../services/pushNotifications';
import configuracionService from '../services/configuracionService';

/**
 * Hook personalizado para manejar conexión Socket.io con namespace /mozos
 * OPTIMIZADO: Heartbeat, reconexión automática, persistencia, autenticación JWT
 * @param {Function} onMesaActualizada - Callback cuando se actualiza una mesa
 * @param {Function} onComandaActualizada - Callback cuando se actualiza una comanda
 * @param {Function} onNuevaComanda - Callback cuando llega nueva comanda
 * @param {Function} onSocketStatus - Callback para cambios de estado de conexión
 * @param {string} token - Token JWT para autenticación Socket.io (obligatorio)
 * @param {number} reconnectNonce - Incrementar para forzar recrear el cliente (cambio de IP)
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
  onReservaCambio,
  token, // Token JWT para autenticación
  reconnectNonce = 0
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
  const mozoPersonalRoomRef = useRef(null);

  const joinMozoPersonalRoom = async (sock) => {
    try {
      const userRaw = await AsyncStorage.getItem('user');
      if (!userRaw) return;
      const user = JSON.parse(userRaw);
      const mozoId = user?._id?.toString();
      if (!mozoId || !sock?.connected) return;
      if (mozoPersonalRoomRef.current === mozoId) return;
      sock.emit('join-mozo-personal', mozoId);
      mozoPersonalRoomRef.current = mozoId;
      console.log(`📌 [MOZOS] Room personal mozo-${mozoId}`);
    } catch (_) {}
  };

  useEffect(() => {
    // VALIDACIÓN: Token es obligatorio para conectar
    if (!token) {
      // No mostrar warning si estamos esperando el token (carga inicial)
      // Solo log simple, no usar console.warn para evitar LogBox
      console.log('⏳ [MOZOS] Esperando token JWT para conectar Socket.io...');
      
      // Desconectar socket existente si hay uno
      if (socketRef.current) {
        console.log('[MOZOS] Desconectando socket existente por falta de token');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      setConnected(false);
      setConnectionStatus('desconectado');
      setAuthError(null);
      authFailedRef.current = false;
      return;
    }

    // Si el token cambió, permitir reintentar auth
    if (authFailedRef.current) {
      console.log('[MOZOS] Autenticación previamente fallida, reintentando con token/URL nuevos');
      authFailedRef.current = false;
      setAuthError(null);
    }

    // Obtener URL del servidor desde configuración dinámica (http(s), no ws://)
    const serverUrl = getWebSocketURL();
    
    const wsURL = `${serverUrl}/mozos`;
    console.log('🔌 [MOZOS] Conectando a Socket.io:', wsURL, 'con token JWT');

    // Crear conexión Socket.io al namespace /mozos con backoff exponencial
    // OPTIMIZADO: Configuración bulletproof para conexión permanente
    // IMPORTANTE: Enviar token en auth para autenticación
    setConnected(false);
    setConnectionStatus('reconectando');
    if (onSocketStatus) {
      onSocketStatus({ connected: false, status: 'reconectando' });
    }

    const socket = io(wsURL, {
      // Igual que App Cocina: websocket primero; polling solo como fallback de engine.io
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: initialDelay,
      reconnectionDelayMax: maxDelay,
      reconnectionAttempts: maxReconnectAttempts,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: false,
      pingTimeout: 60000,
      pingInterval: 25000,
      randomizationFactor: 0.5,
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
      joinMozoPersonalRoom(socket);
      
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
      setConnectionStatus(reason === 'io client disconnect' ? 'desconectado' : 'reconectando');
      
      // Guardar estado
      AsyncStorage.setItem('socketConnected', 'false').catch(() => {});
      
      // Notificar cambio de estado
      if (onSocketStatus) {
        onSocketStatus({
          connected: false,
          status: reason === 'io client disconnect' ? 'desconectado' : 'reconectando',
          reason
        });
      }
    });

    // Eventos de Manager (Socket.io v3+): reconnect_* ya no se escuchan en socket.on
    socket.io.on('reconnect_attempt', (attemptNumber) => {
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

    socket.io.on('reconnect', (attemptNumber) => {
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
      
      rejoinRooms();
      joinMozoPersonalRoom(socket);
      
      AsyncStorage.setItem('socketConnected', 'true').catch(() => {});
      AsyncStorage.setItem('socketReconnects', '0').catch(() => {});
      
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
        // websocket error en Expo Go suele ser transitorio; polling reconecta
        const transient = /websocket|transport|xhr poll|timeout/i.test(errorMsg);
        if (transient) {
          console.warn(`⚠️ [MOZOS] Socket transport: ${errorMsg} (reintentando…)`);
        } else {
          console.error('❌ [MOZOS] Error de conexión Socket.io:', errorMsg);
        }
        setConnectionStatus('reconectando');
        
        if (onSocketStatus) {
          onSocketStatus({ connected: false, status: 'reconectando', error: errorMsg });
        }
      }
      
      // Socket.io ya tiene reconexión automática con backoff exponencial
    });

    socket.io.on('reconnect_failed', () => {
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
      } else if (onMesaActualizada && (data.mesaId || data._id) && data.estado) {
        onMesaActualizada({ _id: data.mesaId || data._id, estado: data.estado, nummesa: data.nummesa });
      }
    });

    // Evento: Comanda actualizada
    socket.on('comanda-actualizada', (data) => {
      console.log('📥 [MOZOS] Comanda actualizada recibida:', data.comandaId, 'Comanda completa:', !!data.comanda);

      // Solo cuando cocina dejó todos los platos en "recoger" (no al marcar entregado)
      if (data.estadoNuevo === 'recoger' && data.comanda && isComandaListaEnCocina(data.comanda)) {
        shouldNotifyMozoAsignado({ comanda: data.comanda }).then((ok) => {
          if (!ok) return;
          const mesaNumero = data.comanda?.mesas?.nummesa || data.comanda?.mesas?.numero || data.mesaNumero || '';
          const comandaNumber = data.comanda?.comandaNumber || '?';
          showLocalPush(
            '✅ Comanda Lista',
            `Comanda #${comandaNumber}${mesaNumero ? ` de Mesa ${mesaNumero}` : ''} completa para recoger.`,
            { mesaId: data.comanda?.mesas?._id, mesaNumero, type: 'comanda-lista', comandaId: data.comandaId },
            'plato-listo-heads-up',
            'comanda',
            { comanda: data.comanda }
          );
        });
      }
      
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

    // FASE 5: Evento batch de platos actualizados (múltiples platos en un solo evento)
    socket.on('plato-actualizado-batch', (data) => {
      console.log('📥 FASE5: [MOZOS] Batch de platos actualizados recibido:', data.comandaId, 'Platos:', data.platos?.length);

      if (onSocketStatus) {
        setConnectionStatus('online-active');
        onSocketStatus({ connected: true, status: 'online-active' });
        setTimeout(() => {
          setConnectionStatus('conectado');
          onSocketStatus({ connected: true, status: 'conectado' });
        }, 2000);
      }

      // Local si cocina manda varios platos a recoger/salio en un batch (Honor no recibe FCM)
      if (Array.isArray(data.platos)) {
        for (const p of data.platos) {
          const payload = {
            ...data,
            platoId: p.platoId,
            nuevoEstado: p.nuevoEstado,
            estadoAnterior: p.estadoAnterior,
          };
          if (p.nuevoEstado === 'recoger') notifyPlatoListoLocal(payload);
          if (p.nuevoEstado === 'salio') notifyPlatoSalioLocal(payload);
        }
      }

      // Refrescar comandas si aplica
      if (onComandaActualizada) {
        onComandaActualizada({
          tipo: 'plato-actualizado-batch',
          comandaId: data.comandaId,
          platos: data.platos,
          mesaId: data.mesaId,
          timestamp: data.timestamp,
        });
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

      // Local siempre: Honor/Huawei no entrega FCM de forma fiable. También en ComandaDetalle.
      if (data.nuevoEstado === 'recoger') {
        notifyPlatoListoLocal(data);
      }
      // SALIO: notificación local cuando el plato sale de cocina (listo para entregar al comensal)
      if (data.nuevoEstado === 'salio') {
        notifyPlatoSalioLocal(data);
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

    socket.on('configuracion-moneda-actualizada', (data) => {
      const igv = data?.configuracion?.igvPorcentaje;
      console.log('💰 [MOZOS] Configuración de moneda/IGV actualizada:', igv);
      configuracionService.aplicarConfigRemota().catch((e) => {
        console.warn('⚠️ [MOZOS] No se pudo recargar configuración de moneda:', e?.message);
      });
    });

    // ========== PLAN_PLANTILLA_COMANDAS: Eventos de aprobación y reporte ==========

    // Evento: Ticket de aprobación nuevo (mesa pasa a pendiente_aprobar)
    socket.on('ticket-aprobacion-nuevo', (data) => {
      console.log('🎫 [MOZOS] Ticket de aprobación nuevo:', data.ticketNumber, 'Mesa:', data.numMesa);
      const origen = String(data?.origen || data?.ticket?.origen || '').toLowerCase();
      if (origen === 'alta_comanda') {
        // Caja ve el ticket PENDIENTE; la mesa sigue en pedido/reservado.
      } else if (origen === 'forzado' || data?.ticket?.pagoForzado) {
        if (onMesaActualizada && data.mesaId) {
          onMesaActualizada({
            _id: data.mesaId,
            estado: data.estadoMesa && data.estadoMesa !== 'pagado' ? data.estadoMesa : 'pedido',
            nummesa: data.numMesa,
          });
        }
        if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
      } else if (onMesaActualizada && data.mesaId) {
        // Refrescar mesas para que InicioScreen muestre verde claro
        onMesaActualizada({ _id: data.mesaId, estado: 'pendiente_aprobar', nummesa: data.numMesa });
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

    // Evento: Comanda aprobada por cocina (mesa pasa a pagado, verde oscuro)
    socket.on('comanda-aprobada', (data) => {
      console.log('✅ [MOZOS] Comanda aprobada:', data.ticketNumber, 'Mesa:', data.numMesa);
      const forzado = data?.pagoForzado || data?.origen === 'forzado' || data?.ticket?.pagoForzado;
      const estadoMesa = forzado
        ? (data.mesaEstado && data.mesaEstado !== 'pagado' ? data.mesaEstado : 'pedido')
        : (data.mesaEstado || data.estadoMesa || 'pagado');
      if (onMesaActualizada && data.mesaId) {
        onMesaActualizada({ _id: data.mesaId, estado: estadoMesa, nummesa: data.numMesa });
      }
      if (onComandaActualizada) {
        onComandaActualizada({ _id: 'refresh', status: estadoMesa });
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

    // Evento: Mesa reportada por cocina (mesa en rojo)
    socket.on('mesa-reportada', (data) => {
      console.log('🔴 [MOZOS] Mesa reportada:', data.numMesa, 'Motivo:', data.motivo);
      if (onMesaActualizada && data.mesa) {
        onMesaActualizada(data.mesa);
      } else if (onMesaActualizada && data.mesaId) {
        onMesaActualizada({
          _id: data.mesaId,
          estado: 'reportado',
          nummesa: data.numMesa,
          motivoReporte: data.motivo,
        });
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

    socket.on('ticket-ppa-creado', (data) => {
      if (data?.origen === 'reserva') {
        const mesaId = data.mesaId || data.ticket?.mesa;
        if (onMesaActualizada && mesaId) {
          onMesaActualizada({
            _id: mesaId,
            estado: data.estadoMesa || 'pendiente_aprobar',
            nummesa: data.nummesa || data.ticket?.numMesa,
          });
        }
        if (onReservaCambio) onReservaCambio(data);
        return;
      }
      if (data?.pagoForzado || data?.origen === 'forzado') {
        const mesaId = data.mesaId || data.mesa || data.ticket?.mesa;
        if (onMesaActualizada && mesaId) {
          onMesaActualizada({
            _id: mesaId,
            estado: data.estadoMesa && data.estadoMesa !== 'pagado' && data.estadoMesa !== 'pendiente_pago'
              ? data.estadoMesa
              : 'pedido',
            nummesa: data.nummesa || data.ticket?.numMesa,
          });
        }
        if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
        return;
      }
      if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
    });

    socket.on('reserva-creada', (data) => {
      const reserva = data?.reserva || data;
      const mesa = reserva?.mesa;
      if (onMesaActualizada && mesa) {
        const mesaId = mesa._id || mesa;
        const estado = mesa.estado || 'pendiente_aprobar';
        onMesaActualizada({
          _id: mesaId,
          estado,
          nummesa: mesa.nummesa,
        });
      }
      if (onReservaCambio) onReservaCambio(data);
    });

    socket.on('reserva-actualizada', (data) => {
      if (onReservaCambio) onReservaCambio(data);
    });

    socket.on('reserva-cancelada', (data) => {
      if (onReservaCambio) onReservaCambio(data);
    });

    socket.on('reserva-programada', (data) => {
      if (onReservaCambio) onReservaCambio(data);
    });

    socket.on('ticket-ppa-aprobado', (data) => {
      if (data?.pagoForzado || data?.origen === 'forzado') {
        if (onMesaActualizada && (data.mesa || data.mesaId)) {
          onMesaActualizada({
            _id: data.mesa || data.mesaId,
            estado: data.estadoMesa && data.estadoMesa !== 'pagado' ? data.estadoMesa : 'pedido',
            nummesa: data.nummesa,
          });
        }
        if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
        if (onReservaCambio) onReservaCambio(data);
        return;
      }
      if (onMesaActualizada && data?.mesa && data.estadoMesa) {
        onMesaActualizada({
          _id: data.mesa,
          estado: data.estadoMesa,
          nummesa: data.nummesa,
        });
      }
      if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
      if (onReservaCambio) onReservaCambio(data);
    });

    socket.on('ticket-ppa-rechazado', (data) => {
      if (data?.origen === 'reserva') {
        Alert.alert('Reserva rechazada', data.message || data.motivo || 'Cocina rechazó la reserva. La mesa volvió a libre.');
      }
      if (onMesaActualizada && data?.mesa) {
        onMesaActualizada({ _id: data.mesa, estado: 'libre', nummesa: data.nummesa });
      }
      if (onComandaActualizada) onComandaActualizada({ _id: 'refresh' });
      if (onReservaCambio) onReservaCambio(data);
    });

    // ========== FIN EVENTOS PLAN_PLANTILLA_COMANDAS ==========

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

    // Recrear el cliente al cambiar JWT, IP o nonce de reconexión
    return () => {
      console.log('🧹 [MOZOS] Cerrando socket anterior (token/URL/reconexión)');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      try {
        socket.io.off('reconnect_attempt');
        socket.io.off('reconnect');
        socket.io.off('reconnect_failed');
        socket.removeAllListeners();
        socket.disconnect();
      } catch (_) {}
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      mozoPersonalRoomRef.current = null;
    };
  }, [token, reconnectNonce]); // Recrear al cambiar JWT, IP o pedido explícito de reconexión

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

