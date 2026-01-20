import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Componente para mostrar el estado de conexión WebSocket
 * @param {boolean} isConnected - Estado de conexión
 * @param {string} connectionStatus - Estado detallado ('conectado', 'desconectado', 'reconectando')
 * @param {number} reconnectAttempts - Número de intentos de reconexión
 */
export default function SocketStatus({ 
  isConnected, 
  connectionStatus = 'desconectado',
  reconnectAttempts = 0 
}) {
  const getStatusColor = () => {
    if (isConnected && connectionStatus === 'conectado') {
      return '#0f0'; // Verde
    } else if (connectionStatus === 'reconectando') {
      return '#ffa500'; // Naranja
    } else {
      return '#f00'; // Rojo
    }
  };

  const getStatusText = () => {
    if (isConnected && connectionStatus === 'conectado') {
      return '🟢 ONLINE';
    } else if (connectionStatus === 'reconectando') {
      return `🟠 RECONECTANDO (${reconnectAttempts})`;
    } else {
      return '🔴 OFFLINE';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: getStatusColor(), marginLeft: 6 }]}>
        {getStatusText()}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});

