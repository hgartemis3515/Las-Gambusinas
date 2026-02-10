import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import moment from 'moment-timezone';
import BadgeEstadoPlato from './BadgeEstadoPlato';

/**
 * Header personalizado para ComandaDetalleScreen
 * Elimina el espacio negro del header del Stack Navigator
 */
const HeaderComandaDetalle = ({ mesa, comanda, onSync, navigation }) => {
  const mozoNombre = comanda?.mozos?.name || 'Desconocido';
  const fechaComanda = comanda?.createdAt 
    ? moment(comanda.createdAt).tz("America/Lima").format("DD/MM/YYYY, h:mm:ss a")
    : 'Fecha no disponible';
  
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Mesa {mesa?.nummesa || 'N/A'} - Comanda #{comanda?.comandaNumber || 'N/A'}
          </Text>
          <TouchableOpacity onPress={onSync} style={styles.syncButton}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Mozo: {mozoNombre}</Text>
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


