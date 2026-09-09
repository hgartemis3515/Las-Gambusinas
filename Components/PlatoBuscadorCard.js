import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBotonCantidadPlato } from '../context/BotonCantidadPlatoContext';
import { themeLight } from '../constants/theme';
import { platoMuestraBotonG, platoMuestraBotonV } from '../utils/platoBuscador';

/**
 * Cuadro de plato en buscadores de mozos: SUMAR es - # +, G guarniciones, V variación de nombre.
 */
export default function PlatoBuscadorCard({
  plato,
  cantidadTotal = 0,
  cantidadMesa = 0,
  cantidadLlevar = 0,
  esLlevar = false,
  esFav = false,
  onToggleFavorito,
  onAdd,
  onDecrement,
  onPressG,
  onPressV,
}) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = makeStyles(theme);
  const { estilo: estiloQty, iconSize: iconSizeQty } = useBotonCantidadPlato();
  const muestraG = platoMuestraBotonG(plato);
  const muestraV = platoMuestraBotonV(plato);

  return (
    <View style={[styles.card, esLlevar && styles.cardLlevar]}>
      <View style={styles.topRow}>
        <Text style={styles.nombre} numberOfLines={2}>{plato?.nombre}</Text>
        <Text style={styles.precio}>S/. {Number(plato?.precio || 0).toFixed(2)}</Text>
      </View>
      {onToggleFavorito ? (
        <TouchableOpacity
          style={styles.fav}
          onPress={() => onToggleFavorito(plato)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={esFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <MaterialCommunityIcons
            name={esFav ? 'star' : 'star-outline'}
            size={22}
            color={esFav ? '#FFC107' : '#9E9E9E'}
          />
        </TouchableOpacity>
      ) : null}
      <View style={styles.bottomRow}>
        <View style={styles.gvRow}>
          {muestraG ? (
            <TouchableOpacity
              style={styles.btnG}
              onPress={() => onPressG?.(plato)}
              accessibilityRole="button"
              accessibilityLabel="Guarniciones"
            >
              <Text style={styles.gvLetter}>G</Text>
            </TouchableOpacity>
          ) : null}
          {muestraV ? (
            <TouchableOpacity
              style={styles.btnV}
              onPress={() => onPressV?.(plato)}
              accessibilityRole="button"
              accessibilityLabel="Variación por nombre"
            >
              <Text style={styles.gvLetter}>V</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={[styles.qtyBtn, estiloQty]}
            onPress={() => onDecrement?.(plato)}
            accessibilityLabel="Quitar un plato"
          >
            <MaterialCommunityIcons name="minus" size={iconSizeQty} color={theme.colors.text.white} />
          </TouchableOpacity>
          {cantidadLlevar > 0 ? (
            <View style={styles.qtySplit}>
              <Text style={styles.qtyText}>{cantidadMesa}</Text>
              <Text style={styles.qtyLlevar}>+{cantidadLlevar}</Text>
            </View>
          ) : (
            <Text style={styles.qtyText}>{cantidadTotal || 0}</Text>
          )}
          <TouchableOpacity
            style={[styles.qtyBtn, estiloQty]}
            onPress={() => onAdd?.(plato)}
            accessibilityLabel="Sumar un plato"
          >
            <MaterialCommunityIcons name="plus" size={iconSizeQty} color={theme.colors.text.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: theme.borderRadius?.md || 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardLlevar: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  nombre: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  precio: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  fav: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  gvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnG: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnV: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gvLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  qtySplit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyLlevar: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    marginLeft: 2,
  },
});
