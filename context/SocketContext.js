import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useSocketMozos from '../hooks/useSocketMozos';
import { registerPushAfterLogin } from '../services/pushNotifications';
import apiConfig from '../config/apiConfig';
import {
  subscribeSessionCleared,
  logoutForInvalidToken,
  isJwtExpired,
} from '../utils/authSession';
import { msUntilJwtExpiry } from '../utils/jwtExpiry';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socketStatus, setSocketStatus] = useState({ connected: false, status: 'desconectado' });
  const [authToken, setAuthToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true); // Nuevo: estado de carga inicial
  const [configReady, setConfigReady] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  
  // Varias pantallas (Inicio, Pendientes, Pagos) pueden escuchar a la vez.
  // El último subscribe ya no pisa ni anula a las demás al hacer blur.
  const subscribersRef = useRef([]);

  const dispatchSocketEvent = useCallback((key, payload) => {
    for (const handlers of subscribersRef.current) {
      const fn = handlers?.[key];
      if (typeof fn === 'function') fn(payload);
    }
  }, []);

  // Obtener token de AsyncStorage al iniciar
  useEffect(() => {
    let mounted = true;

    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userRaw = await AsyncStorage.getItem('user');
        if (mounted) {
          if (token && !isJwtExpired(token)) {
            console.log('🔐 [MOZOS] Token JWT cargado desde AsyncStorage');
            setAuthToken(token);
            if (userRaw) {
              try {
                const user = JSON.parse(userRaw);
                if (user?._id) {
                  registerPushAfterLogin(user._id).catch(() => {});
                }
              } catch (_) {}
            }
          } else {
            if (token) {
              logoutForInvalidToken();
            }
            setAuthToken(null);
          }
          setIsLoadingToken(false);
        }
      } catch (error) {
        console.error('❌ [MOZOS] Error cargando token:', error);
        if (mounted) setIsLoadingToken(false);
      }
    };

    loadToken();

    const unsubSession = subscribeSessionCleared(() => {
      if (mounted) setAuthToken(null);
    });

    // Escuchar cambios en el token (para cuando se hace login/logout)
    const checkTokenInterval = setInterval(loadToken, 5000);

    return () => {
      mounted = false;
      unsubSession();
      clearInterval(checkTokenInterval);
    };
  }, []);

  useEffect(() => {
    let unsub = () => {};
    let mounted = true;
    apiConfig.whenReady().then(() => {
      if (!mounted) return;
      setConfigReady(true);
      unsub = apiConfig.subscribe(() => {
        setReconnectNonce((n) => n + 1);
      });
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const handleMesaActualizada = useCallback((mesa) => {
    dispatchSocketEvent('onMesaActualizada', mesa);
  }, [dispatchSocketEvent]);

  const handleComandaActualizada = useCallback((comanda) => {
    dispatchSocketEvent('onComandaActualizada', comanda);
  }, [dispatchSocketEvent]);

  const handleNuevaComanda = useCallback((comanda) => {
    dispatchSocketEvent('onNuevaComanda', comanda);
  }, [dispatchSocketEvent]);

  const handleMesasJuntadas = useCallback((data) => {
    dispatchSocketEvent('onMesasJuntadas', data);
  }, [dispatchSocketEvent]);

  const handleMesasSeparadas = useCallback((data) => {
    dispatchSocketEvent('onMesasSeparadas', data);
  }, [dispatchSocketEvent]);

  const handleMapaActualizado = useCallback((data) => {
    dispatchSocketEvent('onMapaActualizado', data);
  }, [dispatchSocketEvent]);

  const handleCatalogoMesasAreas = useCallback((data) => {
    dispatchSocketEvent('onCatalogoMesasAreas', data);
  }, [dispatchSocketEvent]);

  const handleReservaCambio = useCallback((data) => {
    dispatchSocketEvent('onReservaCambio', data);
  }, [dispatchSocketEvent]);

  const handleSocketStatus = useCallback((status) => {
    setSocketStatus(status);

    // Si se reconectó, procesar queue offline solo si wsURL usa IP/host válida (no demo)
    if (status.connected && status.status === 'conectado') {
      import('../apiConfig').then(({ isWsUrlValidForOfflineQueue }) => {
        if (!isWsUrlValidForOfflineQueue()) return;
        return import('../utils/offlineQueue').then(module => {
          const offlineQueue = module.default;
          return offlineQueue.processQueue({
            'comanda-actualizada': handleComandaActualizada,
            'mesa-actualizada': handleMesaActualizada,
            'nueva-comanda': handleNuevaComanda
          });
        }).catch(error => {
          console.error('Error procesando queue offline:', error);
        });
      });
    }
  }, [handleComandaActualizada, handleMesaActualizada, handleNuevaComanda]);

  // Hook WebSocket global - se mantiene activo en todas las pantallas
  // Los callbacks usan useRef para evitar recrear el hook y causar desconexiones
  // IMPORTANTE: Se pasa el token JWT para autenticación
  // OPTIMIZADO: No pasar token hasta que termine la carga inicial para evitar warning
  const socketHookResult = useSocketMozos({
    onMesaActualizada: handleMesaActualizada,
    onComandaActualizada: handleComandaActualizada,
    onNuevaComanda: handleNuevaComanda,
    onSocketStatus: handleSocketStatus,
    onMesasJuntadas: handleMesasJuntadas,
    onMesasSeparadas: handleMesasSeparadas,
    onMapaActualizado: handleMapaActualizado,
    onCatalogoMesasAreas: handleCatalogoMesasAreas,
    onReservaCambio: handleReservaCambio,
    token: (!configReady || isLoadingToken) ? null : authToken,
    reconnectNonce
  });
  
  const { connected, connectionStatus, reconnectAttempts, socket, trackRoom, untrackRoom, authError } = socketHookResult;

  const subscribeToEvents = useCallback((handlers) => {
    if (!handlers || typeof handlers !== 'object') return () => {};
    subscribersRef.current = [...subscribersRef.current, handlers];
    return () => {
      subscribersRef.current = subscribersRef.current.filter((h) => h !== handlers);
    };
  }, []);

  // 🔥 ESTÁNDAR INDUSTRIA: Join/Leave rooms por mesa con tracking
  const joinMesa = useCallback((mesaId) => {
    if (socket && connected) {
      socket.emit('join-mesa', mesaId);
      if (trackRoom) trackRoom(mesaId);
      console.log(`📌 [MOZOS] Uniéndose a room mesa-${mesaId}`);
    } else {
      console.warn('⚠️ [MOZOS] Socket no conectado, no se puede unir a mesa');
    }
  }, [socket, connected, trackRoom]);

  const leaveMesa = useCallback((mesaId) => {
    if (socket && connected) {
      socket.emit('leave-mesa', mesaId);
      if (untrackRoom) untrackRoom(mesaId);
      console.log(`📌 [MOZOS] Saliendo de room mesa-${mesaId}`);
    }
  }, [socket, connected, untrackRoom]);

  // Función para actualizar el token (llamar desde Login después de autenticar)
  const updateToken = useCallback((newToken) => {
    setAuthToken(newToken);
    setIsLoadingToken(false); // Token disponible, listo para conectar
  }, []);

  const reconnectSocket = useCallback(() => {
    setReconnectNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !authToken) return;
      if (isJwtExpired(authToken)) {
        logoutForInvalidToken();
        return;
      }
      if (socket?.connected) return;
      console.log('🔄 [MOZOS] App en primer plano — reconectando socket');
      if (socket) {
        try {
          socket.auth = { token: authToken };
          socket.io.reconnection(true);
          socket.connect();
        } catch (_) {
          setReconnectNonce((n) => n + 1);
        }
      } else {
        setReconnectNonce((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, [authToken, socket]);

  useEffect(() => {
    if (!authToken) return;
    const ms = msUntilJwtExpiry(authToken);
    if (ms <= 0) {
      logoutForInvalidToken();
      return;
    }
    const t = setTimeout(() => logoutForInvalidToken(), ms + 400);
    return () => clearTimeout(t);
  }, [authToken]);

  useEffect(() => {
    if (!authToken || connected || isLoadingToken || !configReady) return;
    if (isJwtExpired(authToken)) {
      logoutForInvalidToken();
      return;
    }
    const t = setTimeout(() => {
      console.log('🔄 [MOZOS] Watchdog 15s offline con sesión — recrear socket');
      setReconnectNonce((n) => n + 1);
    }, 15000);
    return () => clearTimeout(t);
  }, [authToken, connected, isLoadingToken, configReady]);

  return (
    <SocketContext.Provider value={{
      connected,
      connectionStatus,
      reconnectAttempts,
      socket,
      socketStatus,
      subscribeToEvents,
      joinMesa,
      leaveMesa,
      authError,
      updateToken,
      reconnectSocket,
      authToken,
      isLoadingToken,
      handleMesasJuntadas,
      handleMesasSeparadas,
      handleMapaActualizado
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

