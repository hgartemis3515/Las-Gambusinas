import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BadgeEstadoPlato from './BadgeEstadoPlato';

/**
 * Componente para mostrar un plato con su estado individual
 * Incluye checkbox para marcar como entregado o seleccionar para eliminar
 */
const PlatoItemConEstado = ({ 
  plato, 
  onMarcarEntregado, 
  seleccionable = false,
  seleccionado = false,
  onSeleccionar 
}) => {
  const subtotal = ((plato.precio || plato.plato?.precio || 0) * (plato.cantidad || 1)).toFixed(2);
  const puedeMarcarEntregado = plato.estado === 'recoger' || plato.estado === 'en_espera';
  const nombrePlato = plato.plato?.nombre || plato.nombre || 'Plato desconocido';
  
  return (
    <View style={styles.container}>
      {/* Checkbox si es seleccionable (para eliminar) */}
      {seleccionable && (
        <TouchableOpacity 
          onPress={() => onSeleccionar && onSeleccionar(plato)}
          style={styles.checkboxContainer}
        >
          <MaterialCommunityIcons 
            name={seleccionado ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={seleccionado ? '#10B981' : '#9CA3AF'}
          />
        </TouchableOpacity>
      )}
      
      {/* Checkbox para marcar como entregado */}
      {puedeMarcarEntregado && !seleccionable && (
        <TouchableOpacity 
          onPress={() => onMarcarEntregado && onMarcarEntregado(plato)}
          style={styles.checkboxContainer}
        >
          <MaterialCommunityIcons 
            name="checkbox-blank-outline"
            size={24}
            color="#F59E0B"
          />
        </TouchableOpacity>
      )}
      
      {/* Icono de entregado si ya está entregado */}
      {plato.estado === 'entregado' && !seleccionable && (
        <View style={styles.checkboxContainer}>
          <MaterialCommunityIcons 
            name="check-circle"
            size={24}
            color="#10B981"
          />
        </View>
      )}
      
      {/* Información del plato */}
      <View style={styles.info}>
        <Text style={styles.nombre}>{nombrePlato}</Text>
        <Text style={styles.cantidad}>x{plato.cantidad || 1}</Text>
      </View>
      
      {/* Precio */}
      <Text style={styles.precio}>S/. {subtotal}</Text>
      
      {/* Badge de estado */}
      <BadgeEstadoPlato estado={plato.estado} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  info: {
    flex: 1,
    marginHorizontal: 8
  },
  nombre: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2
  },
  cantidad: {
    fontSize: 14,
    color: '#6B7280'
  },
  precio: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 12,
    minWidth: 70,
    textAlign: 'right'
  }
});

export default PlatoItemConEstado;

