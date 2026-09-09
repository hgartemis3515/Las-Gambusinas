import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useBotonEnviarOrden } from '../context/BotonEnviarOrdenContext';

/**
 * Icono "E" = Enviar orden. Color/tamaño/visibilidad en Personalizar.
 */
export default function BotonEnviarOrden({ onPress, disabled = false, accessibilityLabel = 'Enviar orden' }) {
  const { visible, estilo, iconSize } = useBotonEnviarOrden();
  if (!visible || typeof onPress !== 'function') return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[estilo, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text style={[styles.letter, { fontSize: iconSize, lineHeight: iconSize + 2 }]}>E</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  letter: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
});
