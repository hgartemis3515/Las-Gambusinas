import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBotonCantidadPlato } from '../context/BotonCantidadPlatoContext';
import { themeLight } from '../constants/theme';
import { platoMuestraBotonG, platoMuestraBotonV } from '../utils/platoBuscador';
import { ESTILO_CANTIDAD_AGREGAR } from '../utils/botonCantidadPlato';

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
  const { estilo: estiloQty, iconSize: iconSizeQty, estiloAgregar } = useBotonCantidadPlato();
  const muestraG = platoMuestraBotonG(plato);
  const muestraV = platoMuestraBotonV(plato);
  const modoAgregar = estiloAgregar === ESTILO_CANTIDAD_AGREGAR;
  const [qtyAdd, setQtyAdd] = useState(1);
  const [agregarFlash, setAgregarFlash] = useState(false);
  useEffect(() => {
    setQtyAdd(1);
    setAgregarFlash(false);
  }, [plato?._id, plato?.nombreMostrado]);
  useEffect(() => {
    if (!agregarFlash) return undefined;
    const t = setTimeout(() => setAgregarFlash(false), 1400);
    return () => clearTimeout(t);
  }, [agregarFlash]);
  const nQty = Math.max(0, Number(cantidadTotal) || 0);
  const precioUnit = Number(plato?.precio || 0);
  const nPrecio = nQty > 0 ? nQty : 1;
  const precioMostrar = precioUnit * nPrecio;
  const agregarHecho = modoAgregar && (nQty > 0 || agregarFlash);
  const nombreVisible = plato?.nombreMostrado || plato?.nombre;

  return (
    <View style={[styles.card, esLlevar && styles.cardLlevar]}>
      <View style={styles.topRow}>
        <View style={styles.nombreWrap}>
          <Text style={styles.nombre} numberOfLines={2}>{nombreVisible}</Text>
          {plato?.codigo ? (
            <Text style={styles.codigo}>{String(plato.codigo).toUpperCase()}</Text>
          ) : null}
        </View>
        <View style={styles.precioRow}>
          <Text style={styles.precio}>S/. {precioMostrar.toFixed(2)}</Text>
          {nQty > 0 ? <Text style={styles.precioMult}>{nQty}x</Text> : null}
        </View>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.gvRow}>
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
          {modoAgregar ? (
            <>
              <TouchableOpacity
                style={[styles.qtyBtn, estiloQty]}
                onPress={() => setQtyAdd((n) => Math.max(1, n - 1))}
                accessibilityLabel="Quitar uno a agregar"
              >
                <MaterialCommunityIcons name="minus" size={iconSizeQty} color={theme.colors.text.white} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qtyAdd}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, estiloQty]}
                onPress={() => setQtyAdd((n) => Math.min(99, n + 1))}
                accessibilityLabel="Sumar uno a agregar"
              >
                <MaterialCommunityIcons name="plus" size={iconSizeQty} color={theme.colors.text.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAgregar, agregarHecho && styles.btnAgregarHecho]}
                onPress={() => {
                  const n = Math.max(1, Math.min(99, qtyAdd));
                  setAgregarFlash(true);
                  onAdd?.(plato, n);
                  setQtyAdd(1);
                }}
                accessibilityLabel={`Agregar ${qtyAdd} a la orden`}
              >
                <Text style={styles.btnAgregarText}>Agregar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
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
                onPress={() => onAdd?.(plato, 1)}
                accessibilityLabel="Sumar un plato"
              >
                <MaterialCommunityIcons name="plus" size={iconSizeQty} color={theme.colors.text.white} />
              </TouchableOpacity>
            </>
          )}
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
  nombreWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 8,
  },
  nombre: {
    flex: undefined,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  codigo: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  precioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  precio: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  precioMult: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  btnAgregarHecho: {
    backgroundColor: '#00C851',
  },
  fav: {
    paddingVertical: 2,
    paddingRight: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnG: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnV: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gvLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnAgregar: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAgregarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
