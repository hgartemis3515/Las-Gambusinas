import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

/**
 * Componente OPTIMIZADO para mostrar el estado de conexión WebSocket
 * Status visual permanente: 🟢 Online | 🟡 Conectando | 🔴 Offline
 * @param {boolean} isConnected - Estado de conexión
 * @param {string} connectionStatus - Estado detallado ('conectado', 'desconectado', 'reconectando')
 * @param {number} reconnectAttempts - Número de intentos de reconexión
 */
export default function SocketStatus({ 
  isConnected, 
  connectionStatus = 'desconectado',
  reconnectAttempts = 0 
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // FASE 4: Animación de pulso cuando está conectando o recibiendo actualizaciones
  useEffect(() => {
    if (connectionStatus === 'reconectando') {
      // Pulso lento cuando está reconectando
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (connectionStatus === 'online-active') {
      // FASE 4: Pulso rápido cuando recibe actualizaciones (parpadeo)
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 4 } // Parpadear 4 veces (2 segundos)
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [connectionStatus, pulseAnim]);

  const getStatusConfig = () => {
    // FASE 4: Estado 'online-active' para parpadeo cuando recibe actualizaciones
    if (isConnected && connectionStatus === 'online-active') {
      return {
        color: '#10B981', // Verde más suave
        bgColor: 'rgba(16, 185, 129, 0.25)', // Más intenso cuando está activo
        text: '✨ LIVE',
        indicator: '#10B981'
      };
    } else if (isConnected && connectionStatus === 'conectado') {
      return {
        color: '#10B981', // Verde más suave
        bgColor: 'rgba(16, 185, 129, 0.15)',
        text: '🟢 ONLINE',
        indicator: '#10B981'
      };
    } else if (connectionStatus === 'reconectando') {
      return {
        color: '#F59E0B', // Amarillo/Naranja
        bgColor: 'rgba(245, 158, 11, 0.15)',
        text: reconnectAttempts > 0 ? `🟡 CONECTANDO (${reconnectAttempts})` : '🟡 CONECTANDO',
        indicator: '#F59E0B'
      };
    } else {
      return {
        color: '#EF4444', // Rojo
        bgColor: 'rgba(239, 68, 68, 0.15)',
        text: '🔴 OFFLINE',
        indicator: '#EF4444'
      };
    }
  };

  const status = getStatusConfig();

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.indicatorContainer,
          { 
            backgroundColor: status.bgColor,
            transform: [{ scale: pulseAnim }]
          }
        ]}
      >
        <View style={[styles.indicator, { backgroundColor: status.indicator }]} />
      </Animated.View>
      <Text style={[styles.text, { color: status.color }]}>
        {status.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 9999, // Muy alto para estar siempre visible sobre todo
    elevation: 9999, // Para Android
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Más opaco para mejor visibilidad
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  indicatorContainer: {
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

