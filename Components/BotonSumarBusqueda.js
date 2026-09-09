import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useBotonEnviarOrden } from '../context/BotonEnviarOrdenContext';
import { useBotonesMenuOrden } from '../context/BotonesMenuOrdenContext';
import { estiloBotonSumarBusqueda } from '../utils/botonesMenuOrden';

/**
 * Limpia el buscador del menú de platos. Color en Personalizar; el tamaño sigue al botón E.
 */
export default function BotonSumarBusqueda({ onPress, accessibilityLabel = 'Más, limpiar buscador' }) {
  const { size, iconSize } = useBotonEnviarOrden();
  const { sumarColor } = useBotonesMenuOrden();
  if (typeof onPress !== 'function') return null;

  const estilo = estiloBotonSumarBusqueda(size, sumarColor);
  const plus = Math.max(22, iconSize + 2);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={estilo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text style={[styles.letter, { fontSize: plus, lineHeight: plus }]}>+</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  letter: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
