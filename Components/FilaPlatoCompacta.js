import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Componente para renderizar una fila compacta de plato en la tabla
 * Diseño: Fila continua sin espacios, fondo de color según estado
 * 🔥 NUEVO: Soporte para platos anulados por cocina
 * 🔥 NUEVO: Soporte para selección de platos a entregar
 */
const FilaPlatoCompacta = ({ 
  plato, 
  onMarcarEntregado,
  onToggleSeleccion,
  seleccionado = false,
  estilos 
}) => {
  const subtotal = (plato.precio * plato.cantidad).toFixed(2);
  const puedeMarcarEntregado = plato.estado === 'recoger' && !plato.anulado;
  const nombrePlato = plato.plato?.nombre || 'Plato desconocido';
  
  // 🔥 NUEVO: Estilos especiales para plato anulado
  const esAnulado = plato.anulado === true;
  
  // Estilos anulados
  const estilosAnulado = {
    fondo: '#FEE2E2', // bg-red-100
    borde: '#EF4444', // border-red-500
    badgeFondo: '#EF4444',
    badgeTexto: '#FFFFFF',
    textoEstado: 'ANULADO'
  };
  
  const estilosAplicar = esAnulado ? estilosAnulado : estilos;
  
  // 🔥 NUEVO: Handler para toggle de selección
  const handleToggle = () => {
    if (onToggleSeleccion && puedeMarcarEntregado) {
      onToggleSeleccion(plato);
    }
  };
  
  return (
    <View
      style={[
        styles.fila,
        {
          backgroundColor: estilosAplicar.fondo,
          borderLeftWidth: 4,
          borderLeftColor: estilosAplicar.borde,
          // 🔥 NUEVO: Opacidad reducida para platos anulados
          opacity: esAnulado ? 0.6 : 1,
        }
      ]}
    >
      {/* Nombre del plato (40%) */}
      <View style={styles.columnaNombre}>
        <Text 
          style={[
            styles.nombre, 
            esAnulado && styles.nombreAnulado
          ]} 
          numberOfLines={1}
        >
          {nombrePlato}
        </Text>
        {/* Complementos seleccionados */}
        {plato.complementosSeleccionados && plato.complementosSeleccionados.length > 0 && !esAnulado && (
          <View style={{ marginTop: 2, paddingLeft: 0 }}>
            {plato.complementosSeleccionados.map((comp, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 11,
                  color: '#6B7280',
                  fontStyle: 'italic',
                  lineHeight: 16,
                }}
              >
                · {Array.isArray(comp.opcion) ? comp.opcion.join(', ') : comp.opcion} x{comp.cantidad || 1}
              </Text>
            ))}
          </View>
        )}
        {/* 🔥 NUEVO: Mostrar razón de anulación */}
        {esAnulado && plato.anuladoRazon && (
          <Text style={styles.razonAnulacion}>
            ❌ {plato.anuladoRazon}
          </Text>
        )}
      </View>
      
      {/* Cantidad (10%) */}
      <View style={styles.columnaCantidad}>
        <Text style={[styles.cantidad, esAnulado && styles.textoTachado]}>
          x{plato.cantidad || 1}
        </Text>
      </View>
      
      {/* Precio (25%) */}
      <View style={styles.columnaPrecio}>
        <Text style={[styles.precio, esAnulado && styles.textoTachado]}>
          S/. {subtotal}
        </Text>
      </View>
      
      {/* Badge y acción (25%) */}
      <View style={styles.columnaAccion}>
        {/* 🔥 NUEVO: Badge especial para plato anulado */}
        {esAnulado ? (
          <View style={styles.anuladoContainer}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
            <View style={[styles.badge, { backgroundColor: estilosAplicar.badgeFondo }]}>
              <Text style={[styles.badgeText, { color: estilosAplicar.badgeTexto }]}>
                ANULADO
              </Text>
            </View>
          </View>
        ) : puedeMarcarEntregado ? (
          <TouchableOpacity
            style={styles.checkboxButton}
            onPress={handleToggle}
          >
            {/* 🔥 NUEVO: Checkbox que refleja estado de selección */}
            <MaterialCommunityIcons 
              name={seleccionado ? "checkbox-marked" : "checkbox-blank-outline"} 
              size={20} 
              color={seleccionado ? "#10B981" : "#F59E0B"} 
            />
            <View style={[styles.badge, { backgroundColor: estilosAplicar.badgeFondo }]}>
              <Text style={[styles.badgeText, { color: estilosAplicar.badgeTexto }]}>
                {estilosAplicar.textoEstado}
              </Text>
            </View>
          </TouchableOpacity>
        ) : plato.estado === 'entregado' ? (
          <View style={styles.entregadoContainer}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
            <View style={[styles.badge, { backgroundColor: estilosAplicar.badgeFondo }]}>
              <Text style={[styles.badgeText, { color: estilosAplicar.badgeTexto }]}>
                {estilosAplicar.textoEstado}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: estilosAplicar.badgeFondo }]}>
            <Text style={[styles.badgeText, { color: estilosAplicar.badgeTexto }]}>
              {estilosAplicar.textoEstado}
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
  nombreAnulado: {
    textDecorationLine: 'line-through',
    color: '#991B1B',
  },
  textoTachado: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  razonAnulacion: {
    fontSize: 11,
    color: '#DC2626',
    fontStyle: 'italic',
    marginTop: 2,
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
  anuladoContainer: {
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


