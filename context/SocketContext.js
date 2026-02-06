import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import useSocketMozos from '../hooks/useSocketMozos';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socketStatus, setSocketStatus] = useState({ connected: false, status: 'desconectado' });
  
  // Callbacks globales para eventos WebSocket
  const [eventHandlers, setEventHandlers] = useState({
    onMesaActualizada: null,
    onComandaActualizada: null,
    onNuevaComanda: null
  });

  // Wrapper para manejar múltiples suscriptores
  // Usar useRef para evitar recrear callbacks y causar desconexiones
  const eventHandlersRef = useRef(eventHandlers);
  
  useEffect(() => {
    eventHandlersRef.current = eventHandlers;
  }, [eventHandlers]);

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

  const handleSocketStatus = useCallback((status) => {
    setSocketStatus(status);
    
    // Si se reconectó, procesar queue offline si existe
    if (status.connected && status.status === 'conectado') {
      // Importar dinámicamente para evitar problemas de circular dependencies
      import('../utils/offlineQueue').then(module => {
        const offlineQueue = module.default;
        offlineQueue.processQueue({
          'comanda-actualizada': handleComandaActualizada,
          'mesa-actualizada': handleMesaActualizada,
          'nueva-comanda': handleNuevaComanda
        }).catch(error => {
          console.error('Error procesando queue offline:', error);
        });
      });
    }
  }, [handleComandaActualizada, handleMesaActualizada, handleNuevaComanda]);

  // Hook WebSocket global - se mantiene activo en todas las pantallas
  // Los callbacks usan useRef para evitar recrear el hook y causar desconexiones
  const socketHookResult = useSocketMozos({
    onMesaActualizada: handleMesaActualizada,
    onComandaActualizada: handleComandaActualizada,
    onNuevaComanda: handleNuevaComanda,
    onSocketStatus: handleSocketStatus
  });
  
  const { connected, connectionStatus, reconnectAttempts, socket } = socketHookResult;

  // Función para suscribirse a eventos desde cualquier pantalla
  const subscribeToEvents = useCallback((handlers) => {
    setEventHandlers(prev => ({
      ...prev,
      ...handlers
    }));
  }, []);

  // 🔥 ESTÁNDAR INDUSTRIA: Join/Leave rooms por mesa
  const joinMesa = useCallback((mesaId) => {
    if (socket && connected) {
      socket.emit('join-mesa', mesaId);
      console.log(`📌 [MOZOS] Uniéndose a room mesa-${mesaId}`);
    } else {
      console.warn('⚠️ [MOZOS] Socket no conectado, no se puede unir a mesa');
    }
  }, [socket, connected]);

  const leaveMesa = useCallback((mesaId) => {
    if (socket && connected) {
      socket.emit('leave-mesa', mesaId);
      console.log(`📌 [MOZOS] Saliendo de room mesa-${mesaId}`);
    }
  }, [socket, connected]);

  return (
    <SocketContext.Provider value={{
      connected,
      connectionStatus,
      reconnectAttempts,
      socket,
      socketStatus,
      subscribeToEvents,
      joinMesa,
      leaveMesa
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

