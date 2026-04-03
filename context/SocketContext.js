import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useSocketMozos from '../hooks/useSocketMozos';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socketStatus, setSocketStatus] = useState({ connected: false, status: 'desconectado' });
  const [authToken, setAuthToken] = useState(null);
  
  // Callbacks globales para eventos WebSocket
  const [eventHandlers, setEventHandlers] = useState({
    onMesaActualizada: null,
    onComandaActualizada: null,
    onNuevaComanda: null,
    onMesasJuntadas: null,
    onMesasSeparadas: null,
    onMapaActualizado: null,
    onCatalogoMesasAreas: null
  });

  // Wrapper para manejar múltiples suscriptores
  // Usar useRef para evitar recrear callbacks y causar desconexiones
  const eventHandlersRef = useRef(eventHandlers);
  
  useEffect(() => {
    eventHandlersRef.current = eventHandlers;
  }, [eventHandlers]);

  // Obtener token de AsyncStorage al iniciar
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          console.log('🔐 [MOZOS] Token JWT cargado desde AsyncStorage');
          setAuthToken(token);
        } else {
          console.log('⚠️ [MOZOS] No hay token JWT guardado');
        }
      } catch (error) {
        console.error('❌ [MOZOS] Error cargando token:', error);
      }
    };
    
    loadToken();
    
    // Escuchar cambios en el token (para cuando se hace login/logout)
    const checkTokenInterval = setInterval(loadToken, 5000);
    
    return () => clearInterval(checkTokenInterval);
  }, []);

  const handleMesaActualizada = useCallback((mesa) => {
    if (eventHandlersRef.current.onMesaActualizada) {
      eventHandlersRef.current.onMesaActualizada(mesa);
    }
  }, []);

  const handleComandaActualizada = useCallback((comanda) => {
    if (eventHandlersRef.current.onComandaActualizada) {
      eventHandlersRef.current.onComandaActualizada(comanda);
    }
  }, []);

  const handleNuevaComanda = useCallback((comanda) => {
    if (eventHandlersRef.current.onNuevaComanda) {
      eventHandlersRef.current.onNuevaComanda(comanda);
    }
  }, []);

  const handleMesasJuntadas = useCallback((data) => {
    if (eventHandlersRef.current.onMesasJuntadas) {
      eventHandlersRef.current.onMesasJuntadas(data);
    }
  }, []);

  const handleMesasSeparadas = useCallback((data) => {
    if (eventHandlersRef.current.onMesasSeparadas) {
      eventHandlersRef.current.onMesasSeparadas(data);
    }
  }, []);

  const handleMapaActualizado = useCallback((data) => {
    if (eventHandlersRef.current.onMapaActualizado) {
      eventHandlersRef.current.onMapaActualizado(data);
    }
  }, []);

  const handleCatalogoMesasAreas = useCallback((data) => {
    if (eventHandlersRef.current.onCatalogoMesasAreas) {
      eventHandlersRef.current.onCatalogoMesasAreas(data);
    }
  }, []);

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
  const socketHookResult = useSocketMozos({
    onMesaActualizada: handleMesaActualizada,
    onComandaActualizada: handleComandaActualizada,
    onNuevaComanda: handleNuevaComanda,
    onSocketStatus: handleSocketStatus,
    onMesasJuntadas: handleMesasJuntadas,
    onMesasSeparadas: handleMesasSeparadas,
    onMapaActualizado: handleMapaActualizado,
    onCatalogoMesasAreas: handleCatalogoMesasAreas,
    token: authToken // Token JWT para autenticación
  });
  
  const { connected, connectionStatus, reconnectAttempts, socket, trackRoom, untrackRoom, authError } = socketHookResult;

  // Función para suscribirse a eventos desde cualquier pantalla
  const subscribeToEvents = useCallback((handlers) => {
    setEventHandlers(prev => ({
      ...prev,
      ...handlers
    }));
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
  }, []);

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
      authToken,
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

