import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import moment from 'moment-timezone';
import BadgeEstadoPlato from './BadgeEstadoPlato';

/**
 * Header personalizado para ComandaDetalleScreen
 * FASE 4.1: Incluye indicador de estado online/offline
 * Elimina el espacio negro del header del Stack Navigator
 */
const HeaderComandaDetalle = ({ mesa, comanda, onSync, navigation, connectionStatus = 'desconectado', isConnected = false, reconnectAttempts = 0 }) => {
  const mozoNombre = comanda?.mozos?.name || 'Desconocido';
  const fechaComanda = comanda?.createdAt 
    ? moment(comanda.createdAt).tz("America/Lima").format("DD/MM/YYYY, h:mm:ss a")
    : 'Fecha no disponible';
  
  // FASE 4.1: Animación de parpadeo para estado 'online-active'
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  React.useEffect(() => {
    if (connectionStatus === 'online-active') {
      // Parpadeo rápido cuando recibe actualizaciones
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
  
  // FASE 4.1: Obtener configuración de estado de conexión
  const getStatusConfig = () => {
    if (isConnected && connectionStatus === 'online-active') {
      return {
        color: '#10B981',
        text: '✨ LIVE',
        bgColor: 'rgba(16, 185, 129, 0.2)'
      };
    } else if (isConnected && connectionStatus === 'conectado') {
      return {
        color: '#10B981',
        text: '🟢 ONLINE',
        bgColor: 'rgba(16, 185, 129, 0.15)'
      };
    } else if (connectionStatus === 'reconectando') {
      return {
        color: '#F59E0B',
        text: reconnectAttempts > 0 ? `🟡 CONECTANDO (${reconnectAttempts})` : '🟡 CONECTANDO',
        bgColor: 'rgba(245, 158, 11, 0.15)'
      };
    } else {
      return {
        color: '#EF4444',
        text: '🔴 OFFLINE Polling',
        bgColor: 'rgba(239, 68, 68, 0.15)'
      };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={[styles.header, { borderBottomColor: statusConfig.color, borderBottomWidth: 2 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Comanda #{comanda?.comandaNumber || 'N/A'}
          </Text>
          {/* FASE 4.1: Indicador de estado online/offline con animación */}
          <Animated.View 
            style={[
              styles.statusIndicator, 
              { 
                backgroundColor: statusConfig.bgColor,
                transform: [{ scale: pulseAnim }]
              }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </Animated.View>
          <TouchableOpacity onPress={onSync} style={styles.syncButton}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Mozo: {mozoNombre}</Text>
          <Text style={styles.headerText}> • </Text>
          <Text style={styles.headerText}>Mesa: {mesa?.nummesa || 'N/A'}</Text>
          <Text style={styles.headerText}> • </Text>
          <Text style={styles.headerText}>{fechaComanda}</Text>
          <Text style={styles.headerText}> • </Text>
          <BadgeEstadoPlato estado={comanda?.status || 'pedido'} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#DC2626', // Rojo corporativo
  },
  header: {
    backgroundColor: '#DC2626',
    padding: 12,
    paddingTop: 8,
    paddingBottom: 10,
    // FASE 4.1: Header sticky
    position: 'sticky',
    top: 0,
    zIndex: 100,
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  // FASE 4.1: Estilos para indicador de estado
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  syncButton: {
    padding: 6,
  },
  headerText: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.95,
  },
});

export default HeaderComandaDetalle;


