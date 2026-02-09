import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Componente para renderizar una fila compacta de plato en la tabla
 * Diseño: Fila continua sin espacios, fondo de color según estado
 */
const FilaPlatoCompacta = ({ 
  plato, 
  onMarcarEntregado,
  estilos 
}) => {
  const subtotal = (plato.precio * plato.cantidad).toFixed(2);
  const puedeMarcarEntregado = plato.estado === 'recoger';
  const nombrePlato = plato.plato?.nombre || 'Plato desconocido';
  
  return (
    <View
      style={[
        styles.fila,
        {
          backgroundColor: estilos.fondo,
          borderLeftWidth: 4,
          borderLeftColor: estilos.borde
        }
      ]}
    >
      {/* Nombre del plato (40%) */}
      <View style={styles.columnaNombre}>
        <Text style={styles.nombre} numberOfLines={1}>
          {nombrePlato}
        </Text>
      </View>
      
      {/* Cantidad (10%) */}
      <View style={styles.columnaCantidad}>
        <Text style={styles.cantidad}>x{plato.cantidad || 1}</Text>
      </View>
      
      {/* Precio (25%) */}
      <View style={styles.columnaPrecio}>
        <Text style={styles.precio}>S/. {subtotal}</Text>
      </View>
      
      {/* Badge y acción (25%) */}
      <View style={styles.columnaAccion}>
        {puedeMarcarEntregado ? (
          <TouchableOpacity
            style={styles.checkboxButton}
            onPress={() => onMarcarEntregado && onMarcarEntregado(plato)}
          >
            <MaterialCommunityIcons name="checkbox-blank-outline" size={20} color="#F59E0B" />
            <View style={[styles.badge, { backgroundColor: estilos.badgeFondo }]}>
              <Text style={[styles.badgeText, { color: estilos.badgeTexto }]}>
                {estilos.textoEstado}
              </Text>
            </View>
          </TouchableOpacity>
        ) : plato.estado === 'entregado' ? (
          <View style={styles.entregadoContainer}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
            <View style={[styles.badge, { backgroundColor: estilos.badgeFondo }]}>
              <Text style={[styles.badgeText, { color: estilos.badgeTexto }]}>
                {estilos.textoEstado}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: estilos.badgeFondo }]}>
            <Text style={[styles.badgeText, { color: estilos.badgeTexto }]}>
              {estilos.textoEstado}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  columnaNombre: {
    flex: 0.4,
    paddingRight: 8,
  },
  columnaCantidad: {
    flex: 0.1,
    alignItems: 'center',
  },
  columnaPrecio: {
    flex: 0.25,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  columnaAccion: {
    flex: 0.25,
    alignItems: 'flex-end',
  },
  nombre: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  cantidad: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  precio: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  checkboxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entregadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

export default FilaPlatoCompacta;

