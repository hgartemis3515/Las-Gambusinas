import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';

const FALLBACK = [
  { slug: 'platos-desayuno', nombreCorto: 'DESAYUNO' },
  { slug: 'plato-carta normal', nombreCorto: 'CARTA' },
];

function iconForTipo(slug) {
  if (slug === 'platos-desayuno') return 'coffee';
  if (slug === 'plato-carta normal' || slug === 'carta-normal') return 'silverware-fork-knife';
  if (slug === 'platos-cena') return 'moon-waning-crescent';
  if (slug === 'platos-almuerzo') return 'food-apple';
  if (slug === 'platos-bar') return 'glass-cocktail';
  return 'silverware-fork-knife';
}

/** Selector de tipo de menú in-modal (Alert.alert no se ve encima de otro Modal en Android). */
export default function SelectorTipoMenu({ tipos = [], onSelect, onCancel }) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const lista = tipos.length > 0 ? tipos : FALLBACK;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.colors?.text?.primary || '#1A1A1A' }]}>
        Selecciona el tipo de menú
      </Text>
      {lista.map((t) => (
        <TouchableOpacity
          key={t.slug}
          style={[styles.btn, { backgroundColor: theme.colors?.primary || '#C41E3A' }]}
          onPress={() => onSelect(t.slug)}
        >
          <MaterialCommunityIcons
            name={iconForTipo(t.slug)}
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.btnText}>
            {(t.nombreCorto || t.nombre || t.slug || '').toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
      {onCancel ? (
        <TouchableOpacity style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
});
