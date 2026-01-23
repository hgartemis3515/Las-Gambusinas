import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Componente para mostrar platos con soporte para platos eliminados (rojo tachado)
 * Inspirado en Toast POS, Lightspeed, Square Restaurant
 */
const PlatoItem = ({ 
  plato, 
  cantidad, 
  historialPlatos = [], 
  showPrecio = true,
  showCantidad = true,
  style = {},
  textStyle = {}
}) => {
  // Verificar si el plato está eliminado en el historial
  const platoId = plato?.platoId || plato?.plato?._id || plato?._id;
  const ultimoHistorial = historialPlatos.find(h => 
    h.platoId === platoId || 
    h.platoId?.toString() === platoId?.toString()
  );
  
  const esEliminado = ultimoHistorial?.estado?.includes('eliminado') || 
                      plato?.estado === 'eliminado' ||
                      plato?.estado === 'eliminado-completo';
  
  const nombrePlato = plato?.nombre || 
                      plato?.plato?.nombre || 
                      plato?.nombreOriginal || 
                      'Plato desconocido';
  
  const precioPlato = plato?.precio || 
                      plato?.plato?.precio || 
                      0;
  
  const cantidadPlato = cantidad || 
                        plato?.cantidad || 
                        plato?.cantidadOriginal || 
                        1;
  
  const subtotal = precioPlato * cantidadPlato;
  const motivo = ultimoHistorial?.motivo || 'Plato eliminado';

  return (
    <View style={[
      styles.platoContainer,
      esEliminado && styles.platoEliminado,
      style
    ]}>
      <View style={styles.platoInfo}>
        <View style={styles.platoHeader}>
          <Text style={[
            styles.platoNombre,
            esEliminado && styles.textoTachadoRojo,
            textStyle
          ]}>
            {nombrePlato}
          </Text>
          {esEliminado && (
            <MaterialCommunityIcons 
              name="close-circle" 
              size={16} 
              color="#DC2626" 
              style={styles.iconoEliminado}
            />
          )}
        </View>
        
        <View style={styles.platoDetails}>
          {showCantidad && (
            <Text style={[
              styles.platoCantidad,
              esEliminado && styles.textoTachadoRojo
            ]}>
              x{cantidadPlato}
            </Text>
          )}
          {showPrecio && (
            <Text style={[
              styles.platoPrecio,
              esEliminado && styles.textoTachadoRojo
            ]}>
              S/. {subtotal.toFixed(2)}
            </Text>
          )}
        </View>
        
        {esEliminado && motivo && (
          <Text style={styles.motivoEliminacion}>
            ❌ {motivo}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  platoContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  platoEliminado: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
    opacity: 0.8,
  },
  platoInfo: {
    flex: 1,
  },
  platoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  platoNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  textoTachadoRojo: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    textDecorationColor: '#DC2626',
    color: '#DC2626',
    opacity: 0.7,
  },
  iconoEliminado: {
    marginLeft: 8,
  },
  platoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  platoCantidad: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  platoPrecio: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  motivoEliminacion: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default PlatoItem;

