import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Pressable,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';

const MIN_LIST = 140;

function iconForTipo(slug) {
  if (!slug) return null;
  if (slug === 'platos-desayuno') return 'coffee';
  if (slug === 'plato-carta normal' || slug === 'carta-normal') return 'silverware-fork-knife';
  if (slug === 'platos-cena') return 'moon-waning-crescent';
  if (slug === 'platos-almuerzo') return 'food-apple';
  if (slug === 'platos-bar') return 'glass-cocktail';
  return null;
}

function layoutTipoMenu(usableWidth, count) {
  const n = Math.max(1, count);
  const usable = Math.max(180, usableWidth);
  let cols = 2;
  if (n === 1 || usable < 300) cols = 1;
  else if (usable >= 540 && n >= 3) cols = Math.min(3, n);
  else cols = Math.min(2, n);
  const gap = usable < 340 ? 8 : 10;
  const cardW = (usable - gap * (cols - 1)) / cols;
  return {
    cols,
    gap,
    cardW,
    iconSize: Math.round(Math.min(40, Math.max(22, cardW * 0.22))),
    fontSize: Math.round(Math.min(15, Math.max(11, cardW * 0.11))),
    minH: Math.round(Math.min(120, Math.max(72, cardW * 0.7))),
  };
}

function categoriaIcon(categoria) {
  if (categoria?.includes('Carnes') || categoria?.includes('CARNE')) return '🥩';
  if (categoria?.includes('Pescado') || categoria?.includes('PESCADO')) return '🐟';
  if (categoria?.includes('Entrada') || categoria?.includes('ENTRADA')) return '🥗';
  if (categoria?.includes('Bebida') || categoria?.includes('JUGOS') || categoria?.includes('Gaseosa')) return '🥤';
  return '🍽️';
}

/**
 * Overlay in-tree del menú de platos (no usa Modal nativo).
 * Altura de lista = overlayH - chromeH (mín. 140), medida con onLayout.
 */
export default function MenuPlatosSheet({
  visible,
  onClose,
  tiposPlatoCatalogo = [],
  tipoPlatoFiltro,
  onSelectTipo,
  onClearTipo,
  labelForTipo,
  tipoServicioModal,
  onTipoServicioChange,
  searchPlato,
  onSearchChange,
  onSearchFocus,
  onClearSearch,
  categorias = [],
  categoriaFiltro,
  onSelectCategoria,
  platosFiltrados = [],
  selectedPlatos = [],
  cantidades = {},
  onDecrementPlato,
  onAddPlato,
  listRef,
  onListScroll,
}) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = makeStyles(theme);
  const { width: winW } = useWindowDimensions();
  const [gridW, setGridW] = useState(0);

  const [overlayH, setOverlayH] = useState(0);
  const [chromeH, setChromeH] = useState(0);

  const tiposMostrados = tiposPlatoCatalogo.length > 0
    ? tiposPlatoCatalogo
    : [
        { slug: 'platos-desayuno', nombreCorto: 'DESAYUNO' },
        { slug: 'plato-carta normal', nombreCorto: 'CARTA' },
      ];
  const tipoLayout = layoutTipoMenu(gridW > 0 ? gridW : winW - 64, tiposMostrados.length);

  const onGridLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - gridW) > 1) setGridW(w);
  }, [gridW]);

  const listH = chromeH > 0
    ? Math.max(MIN_LIST, overlayH * 0.9 - chromeH)
    : MIN_LIST;

  const onOverlayLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setOverlayH(h);
  }, []);

  const onChromeLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setChromeH(h);
  }, []);

  const renderPlato = useCallback(({ item: plato }) => {
    const cantidadTotal = selectedPlatos
      .filter((p) => p._id === plato._id)
      .reduce((sum, p) => sum + (cantidades[p.instanceId || p._id] || 1), 0);
    const instanciasMesa = selectedPlatos.filter((p) => p._id === plato._id && (p.tipoServicio || 'mesa') === 'mesa');
    const instanciasLlevar = selectedPlatos.filter((p) => p._id === plato._id && p.tipoServicio === 'para_llevar');
    const cantidadMesa = instanciasMesa.reduce((sum, p) => sum + (cantidades[p.instanceId || p._id] || 1), 0);
    const cantidadLlevar = instanciasLlevar.reduce((sum, p) => sum + (cantidades[p.instanceId || p._id] || 1), 0);

    return (
      <View style={[
        styles.platoModalItem,
        tipoServicioModal === 'para_llevar' && styles.platoModalItemLlevar,
      ]}>
        <View style={styles.platoModalInfo}>
          <View style={styles.platoModalNombreContainer}>
            <Text style={styles.platoModalNombre}>{plato.nombre}</Text>
            {plato.complementos && plato.complementos.length > 0 && (
              <View style={styles.tieneComplementosBadge}>
                <MaterialCommunityIcons name="tune-variant" size={12} color={theme.colors.text.white} />
              </View>
            )}
          </View>
          <Text style={styles.platoModalPrecio}>S/. {plato.precio.toFixed(2)}</Text>
        </View>
        <View style={styles.platoModalActions}>
          <TouchableOpacity style={styles.cantidadButtonSmall} onPress={() => onDecrementPlato(plato)}>
            <MaterialCommunityIcons name="minus" size={14} color={theme.colors.text.white} />
          </TouchableOpacity>
          {cantidadLlevar > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cantidadTextSmall}>{cantidadMesa}</Text>
              <Text style={[styles.cantidadTextSmall, { color: '#8B5CF6', fontWeight: '700', marginLeft: 1 }]}>+{cantidadLlevar}</Text>
            </View>
          ) : (
            <Text style={styles.cantidadTextSmall}>{cantidadTotal || 0}</Text>
          )}
          <TouchableOpacity
            style={styles.cantidadButtonSmall}
            onPress={() => onAddPlato(plato)}
          >
            <MaterialCommunityIcons name="plus" size={14} color={theme.colors.text.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPlatoButton} onPress={() => onAddPlato(plato)}>
            <Text style={styles.addPlatoButtonText}>Agregar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [selectedPlatos, cantidades, onDecrementPlato, onAddPlato, styles, theme.colors.text.white, tipoServicioModal]);

  if (!visible) return null;

  const searchActive = (searchPlato || '').trim().length > 0;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <View style={styles.flex} onLayout={onOverlayLayout}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar menú" />
          <View style={styles.sheet}>
            <View onLayout={onChromeLayout} style={styles.chrome}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Menú</Text>
                <TouchableOpacity onPress={onClose}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>

              {!tipoPlatoFiltro ? (
                <View style={styles.tipoSelectorContainer}>
                  <Text style={styles.tipoSelectorTitle}>Selecciona el tipo de menú</Text>
                  <ScrollView
                    style={{ maxHeight: overlayH > 0 ? Math.max(180, overlayH * 0.52) : 280 }}
                    contentContainerStyle={[styles.tipoButtonsContainer, { gap: tipoLayout.gap }]}
                    onLayout={onGridLayout}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {tiposMostrados.map((t) => (
                      <TouchableOpacity
                        key={t.slug}
                        style={[
                          styles.tipoButton,
                          {
                            width: tipoLayout.cardW,
                            minHeight: tipoLayout.minH,
                          },
                        ]}
                        onPress={() => onSelectTipo(t.slug)}
                      >
                        <MaterialCommunityIcons
                          name={iconForTipo(t.slug) || 'silverware-fork-knife'}
                          size={tipoLayout.iconSize}
                          color={theme.colors.text.white}
                        />
                        <Text
                          style={[styles.tipoButtonText, { fontSize: tipoLayout.fontSize }]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.65}
                        >
                          {(t.nombreCorto || t.nombre || '').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <>
                  <View style={styles.tipoServicioRow}>
                    <TouchableOpacity style={[styles.changeTipoButton, { flex: 1, marginBottom: 0 }]} onPress={onClearTipo}>
                      <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text.white} />
                      <Text style={styles.changeTipoButtonText}>{labelForTipo(tipoPlatoFiltro) || 'Tipo'}</Text>
                    </TouchableOpacity>
                    <View style={[
                      styles.tipoServicioToggle,
                      tipoServicioModal === 'para_llevar' && { borderColor: '#8B5CF6' },
                    ]}>
                      <Text
                        style={[
                          styles.tipoServicioLabel,
                          tipoServicioModal === 'mesa' && styles.tipoServicioLabelActive,
                          { color: tipoServicioModal === 'mesa' ? '#F59E0B' : theme.colors.text.secondary },
                        ]}
                      >
                        Mesa
                      </Text>
                      <Switch
                        value={tipoServicioModal === 'para_llevar'}
                        onValueChange={(v) => onTipoServicioChange(v ? 'para_llevar' : 'mesa')}
                        trackColor={{ false: '#F59E0B', true: '#8B5CF6' }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel="Tipo de servicio: Mesa o Para llevar"
                        accessibilityHint="Cambia el destino de los platos que agregues a continuación"
                      />
                      <Text
                        style={[
                          styles.tipoServicioLabel,
                          tipoServicioModal === 'para_llevar' && styles.tipoServicioLabelActive,
                          { color: tipoServicioModal === 'para_llevar' ? '#8B5CF6' : theme.colors.text.secondary },
                        ]}
                      >
                        Para llevar
                      </Text>
                    </View>
                  </View>

                  <View style={styles.searchInputWrapper}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar plato..."
                      placeholderTextColor={theme.colors.text.light}
                      value={searchPlato}
                      onChangeText={onSearchChange}
                      onFocus={onSearchFocus}
                      accessibilityLabel={searchActive ? 'Búsqueda en todos los platos' : 'Buscar plato'}
                      accessibilityHint="Al escribir se muestran platos de todas las categorías"
                    />
                    {searchPlato.length > 0 && (
                      <TouchableOpacity
                        style={styles.searchClearButton}
                        onPress={onClearSearch}
                        accessibilityLabel="Limpiar búsqueda"
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.text.light} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView horizontal style={styles.categoriasContainer} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      style={[styles.categoriaChip, (!categoriaFiltro || searchActive) && styles.categoriaChipActive]}
                      onPress={() => onSelectCategoria(null)}
                    >
                      <Text style={[styles.categoriaChipText, (!categoriaFiltro || searchActive) && styles.categoriaChipTextActive]}>Todos</Text>
                    </TouchableOpacity>
                    {categorias.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoriaChip, categoriaFiltro === cat && !searchActive && styles.categoriaChipActive]}
                        onPress={() => onSelectCategoria(cat)}
                      >
                        <Text style={[styles.categoriaChipText, categoriaFiltro === cat && !searchActive && styles.categoriaChipTextActive]}>
                          {categoriaIcon(cat)} {cat.split('(')[0].trim()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>

            {tipoPlatoFiltro ? (
              <FlatList
                ref={listRef}
                data={platosFiltrados}
                keyExtractor={(item) => String(item._id)}
                renderItem={renderPlato}
                extraData={{ selectedPlatos, cantidades, tipoServicioModal }}
                style={{ height: listH }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScroll={onListScroll}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  <View style={styles.emptyPlatosContainer}>
                    <Text style={styles.emptyPlatosText}>No hay platos disponibles</Text>
                  </View>
                }
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 24,
  },
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.large,
  },
  chrome: {
    flexGrow: 0,
    flexShrink: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  searchInputWrapper: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    paddingRight: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  searchClearButton: {
    position: 'absolute',
    right: theme.spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  categoriasContainer: {
    marginBottom: theme.spacing.md,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 40,
  },
  categoriaChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  categoriaChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  categoriaChipTextActive: {
    color: theme.colors.text.white,
  },
  platoModalItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  platoModalItemLlevar: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  platoModalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  platoModalNombreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flex: 1,
  },
  tieneComplementosBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  platoModalNombre: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoModalPrecio: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  platoModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  addPlatoButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addPlatoButtonText: {
    color: theme.colors.text.white,
    fontWeight: '700',
    fontSize: 12,
  },
  tipoSelectorContainer: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 0,
    alignItems: 'stretch',
    width: '100%',
  },
  tipoSelectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  tipoButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  tipoButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  tipoButtonText: {
    color: theme.colors.text.white,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  changeTipoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  changeTipoButtonText: {
    color: theme.colors.text.white,
    fontWeight: '700',
    fontSize: 14,
  },
  tipoServicioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tipoServicioToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  tipoServicioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  tipoServicioLabelActive: {
    fontWeight: '700',
  },
  cantidadButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  emptyPlatosContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyPlatosText: {
    fontSize: 16,
    color: theme.colors.text.light,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
