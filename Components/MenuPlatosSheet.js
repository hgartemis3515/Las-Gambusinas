import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';
import { CAT_FAVORITOS } from '../helpers/platosFavoritosMozo';
import { ordenarCategoriasMozo, infoCategoriaPorNombre } from '../utils/ordenCategoriaMozo';
import PlatoBuscadorCard from './PlatoBuscadorCard';
import BotonEnviarOrden from './BotonEnviarOrden';
import BotonSumarBusqueda from './BotonSumarBusqueda';
import { useBotonEnviarOrden } from '../context/BotonEnviarOrdenContext';
import { useBotonesMenuOrden } from '../context/BotonesMenuOrdenContext';
import { useDensidadOrdenes } from '../context/DensidadOrdenesContext';
import { useOrdenesAcciones } from '../context/OrdenesAccionesContext';
import { estiloBotonCerrarMenu } from '../utils/botonesMenuOrden';
import { CATEGORIA_ETIQUETA_CODIGO, CATEGORIA_ETIQUETA_NOMBRE } from '../utils/ordenesAccionesPrefs';
import { estiloChipCategoria, layoutCuadrosCategoria } from '../utils/densidadOrdenes';
import { urlMediaServidor } from '../utils/mediaUrl';

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

function CategoriaFiltroCard({ width, uri, codigo, label, selected, onPress, theme, placeholderIcon, imgH, fontSize, codeFontSize, iconSize }) {
  const [fail, setFail] = useState(false);
  useEffect(() => { setFail(false); }, [uri]);
  const showImg = Boolean(uri) && !fail;
  const code = String(codigo || '').trim();
  const cardW = Number(width) || 110;
  const hImg = imgH != null ? imgH : Math.round(cardW * 0.72);
  const fSize = fontSize != null ? fontSize : Math.max(10, Math.round(12 * (cardW / 110)));
  const cSize = codeFontSize != null ? codeFontSize : Math.max(11, Math.round(15 * (cardW / 110)));
  const iSize = iconSize != null ? iconSize : Math.max(20, Math.round(28 * (cardW / 110)));
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: cardW,
        borderRadius: 12,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
      accessibilityRole="button"
      accessibilityLabel={code ? `${code} ${label}` : label}
    >
      <View
        style={{
          width: '100%',
          height: hImg,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showImg ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setFail(true)}
          />
        ) : (
          <MaterialCommunityIcons
            name={placeholderIcon || 'silverware-fork-knife'}
            size={iSize}
            color={theme.colors.text.light}
          />
        )}
        {code ? (
          <View
            style={{
              position: 'absolute',
              left: 6,
              top: 6,
              backgroundColor: 'rgba(0,0,0,0.75)',
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: cSize }}>
              {code}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={{
          paddingHorizontal: 6,
          paddingVertical: 6,
          fontSize: fSize,
          fontWeight: '700',
          textAlign: 'center',
          color: selected ? theme.colors.primary : theme.colors.text.primary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
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
  tipoServicioFijo = false,
  modoExtraLlevar = false,
  searchPlato,
  onSearchChange,
  onSearchFocus,
  onClearSearch,
  categorias = [],
  categoriasInfo = [],
  categoriaFiltro,
  onSelectCategoria,
  platosFiltrados = [],
  selectedPlatos = [],
  cantidades = {},
  onDecrementPlato,
  onAddPlato,
  onPressG,
  onPressV,
  favoritoIds = [],
  onToggleFavorito,
  listRef,
  onListScroll,
  numeroMesa = null,
  onEnviarOrden = null,
  enviandoOrden = false,
}) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = makeStyles(theme);
  const { size: sizeEnviar } = useBotonEnviarOrden();
  const { cerrarColor } = useBotonesMenuOrden();
  const { gapCategorias, chipCategoriaEscala, cuadroCategoriaEscala } = useDensidadOrdenes();
  const { categoriaEtiqueta, setCategoriaEtiqueta, mostrarBuscarCategorias } = useOrdenesAcciones();
  const chipEstilo = estiloChipCategoria(chipCategoriaEscala);
  const estiloCerrar = estiloBotonCerrarMenu(sizeEnviar, cerrarColor);
  const { width: winW } = useWindowDimensions();
  const [gridW, setGridW] = useState(0);
  const [filtroCatOpen, setFiltroCatOpen] = useState(false);
  const [filtroCatQ, setFiltroCatQ] = useState('');

  const catsFiltro = useMemo(() => {
    const names = ordenarCategoriasMozo(categorias || [], categoriasInfo, tipoPlatoFiltro);
    return names.map((nombre) => {
      const info = infoCategoriaPorNombre(categoriasInfo, nombre);
      return {
        nombre,
        codigoMozo: String(info.codigoMozo || '').toUpperCase(),
        imagenUrl: info.imagenUrl || '',
      };
    });
  }, [categorias, categoriasInfo, tipoPlatoFiltro]);

  const catsFiltroVisibles = useMemo(() => {
    const q = String(filtroCatQ || '').trim().toLowerCase();
    if (!q) return catsFiltro;
    const qU = q.toUpperCase();
    return catsFiltro.filter(
      (c) => c.nombre.toLowerCase().includes(q) || (c.codigoMozo || '').includes(qU)
    );
  }, [catsFiltro, filtroCatQ]);

  const [filtroGridW, setFiltroGridW] = useState(0);
  const filtroLayout = useMemo(
    () => layoutCuadrosCategoria(
      filtroGridW > 0 ? filtroGridW : Math.max(160, Math.min(winW, 560) - 48),
      cuadroCategoriaEscala
    ),
    [filtroGridW, winW, cuadroCategoriaEscala]
  );

  useEffect(() => {
    if (!tipoPlatoFiltro) setFiltroCatOpen(false);
  }, [tipoPlatoFiltro]);

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
    const instanciasLlevar = selectedPlatos.filter((p) => p._id === plato._id && (p.tipoServicio === 'para_llevar' || p.tipoServicio === 'extra_llevar'));
    const cantidadMesa = instanciasMesa.reduce((sum, p) => sum + (cantidades[p.instanceId || p._id] || 1), 0);
    const cantidadLlevar = instanciasLlevar.reduce((sum, p) => sum + (cantidades[p.instanceId || p._id] || 1), 0);
    const esFav = favoritoIds.includes(String(plato._id));

    return (
      <PlatoBuscadorCard
        plato={plato}
        cantidadTotal={cantidadTotal}
        cantidadMesa={cantidadMesa}
        cantidadLlevar={cantidadLlevar}
        esLlevar={tipoServicioModal === 'para_llevar' || tipoServicioModal === 'extra_llevar'}
        esFav={esFav}
        onToggleFavorito={onToggleFavorito}
        onAdd={onAddPlato}
        onDecrement={onDecrementPlato}
        onPressG={onPressG}
        onPressV={onPressV}
      />
    );
  }, [selectedPlatos, cantidades, onDecrementPlato, onAddPlato, onPressG, onPressV, onToggleFavorito, favoritoIds, tipoServicioModal]);

  const searchActive = (searchPlato || '').trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
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
                <View style={styles.headerTitleRow}>
                  <Text style={styles.modalTitle}>Menú</Text>
                  {numeroMesa ? (
                    <Text style={styles.mesaNumeroHeader} numberOfLines={1}>
                      {numeroMesa}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.headerActions}>
                  <BotonSumarBusqueda onPress={onClearSearch} />
                  <BotonEnviarOrden onPress={onEnviarOrden} disabled={enviandoOrden} />
                  <TouchableOpacity
                    onPress={onClose}
                    style={estiloCerrar}
                    accessibilityLabel="Cerrar menú"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close" size={Math.round(sizeEnviar * 0.62)} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
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
                      (tipoServicioModal === 'para_llevar' || tipoServicioModal === 'extra_llevar') && { borderColor: '#8B5CF6' },
                      tipoServicioFijo && { opacity: 0.95 },
                    ]}>
                      {modoExtraLlevar ? (
                        <Text
                          style={[
                            styles.tipoServicioLabel,
                            styles.tipoServicioLabelActive,
                            { color: '#8B5CF6' },
                          ]}
                        >
                          EXTRA LLEVAR
                        </Text>
                      ) : (
                        <>
                      {!tipoServicioFijo && (
                      <Text
                        style={[
                          styles.tipoServicioLabel,
                          tipoServicioModal === 'mesa' && styles.tipoServicioLabelActive,
                          { color: tipoServicioModal === 'mesa' ? '#F59E0B' : theme.colors.text.secondary },
                        ]}
                      >
                        Mesa
                      </Text>
                      )}
                      <Switch
                        value={tipoServicioModal === 'para_llevar'}
                        onValueChange={(v) => {
                          if (tipoServicioFijo) return;
                          onTipoServicioChange(v ? 'para_llevar' : 'mesa');
                        }}
                        disabled={tipoServicioFijo}
                        trackColor={{ false: '#F59E0B', true: '#8B5CF6' }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel="Tipo de servicio: Mesa o Para llevar"
                        accessibilityHint="Cambia el destino de todos los platos de la orden"
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
                        </>
                      )}
                    </View>
                  </View>

                  {!filtroCatOpen ? (
                  <>
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
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.text.light} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.searchFilterBtn}
                      onPress={() => {
                        setFiltroCatQ('');
                        setFiltroCatOpen(true);
                      }}
                      accessibilityLabel="Categorías en cuadros"
                    >
                      <MaterialCommunityIcons name="filter-variant" size={22} color={theme.colors.text.white} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    style={styles.categoriasContainer}
                    contentContainerStyle={[styles.categoriasContent, { gap: gapCategorias }]}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoriaChip,
                        {
                          paddingHorizontal: chipEstilo.paddingHorizontal,
                          paddingVertical: chipEstilo.paddingVertical,
                          borderRadius: chipEstilo.borderRadius,
                          minHeight: chipEstilo.minHeight,
                        },
                        (!categoriaFiltro || searchActive) && styles.categoriaChipActive,
                      ]}
                      onPress={() => onSelectCategoria(null)}
                    >
                      <Text style={[
                        styles.categoriaChipText,
                        { fontSize: chipEstilo.fontSize },
                        (!categoriaFiltro || searchActive) && styles.categoriaChipTextActive,
                      ]}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.categoriaChip,
                        styles.categoriaChipFavorito,
                        {
                          paddingHorizontal: chipEstilo.paddingHorizontal,
                          paddingVertical: chipEstilo.paddingVertical,
                          borderRadius: chipEstilo.borderRadius,
                          minHeight: chipEstilo.minHeight,
                          gap: chipEstilo.gap,
                        },
                        categoriaFiltro === CAT_FAVORITOS && !searchActive && styles.categoriaChipFavoritoActive,
                      ]}
                      onPress={() => onSelectCategoria(CAT_FAVORITOS)}
                      accessibilityRole="button"
                      accessibilityLabel="Favoritos"
                    >
                      <MaterialCommunityIcons
                        name={categoriaFiltro === CAT_FAVORITOS && !searchActive ? 'star' : 'star-outline'}
                        size={chipEstilo.iconSize}
                        color={categoriaFiltro === CAT_FAVORITOS && !searchActive ? '#1A1A1A' : '#FFC107'}
                      />
                      <Text
                        style={[
                          styles.categoriaChipText,
                          { fontSize: chipEstilo.fontSize },
                          categoriaFiltro === CAT_FAVORITOS && !searchActive && styles.categoriaChipFavoritoTextActive,
                        ]}
                      >
                        Favoritos
                      </Text>
                    </TouchableOpacity>
                    {catsFiltro.map((c) => {
                      const cat = c.nombre;
                      const infoCat = c;
                      const codigoCat = (infoCat?.codigoMozo || '').trim();
                      const uriCat = urlMediaServidor(infoCat?.imagenUrl);
                      const nombreCat = cat.split('(')[0].trim();
                      const etiqueta = categoriaEtiqueta === CATEGORIA_ETIQUETA_CODIGO
                        ? (codigoCat ? '' : nombreCat)
                        : `${uriCat || codigoCat ? '' : categoriaIcon(cat) + ' '}${nombreCat}`.trim();
                      const thumb = Math.max(18, (chipEstilo.minHeight || 28) - 8);
                      return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoriaChip,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: chipEstilo.paddingHorizontal,
                            paddingVertical: chipEstilo.paddingVertical,
                            borderRadius: chipEstilo.borderRadius,
                            minHeight: chipEstilo.minHeight,
                          },
                          categoriaFiltro === cat && !searchActive && styles.categoriaChipActive,
                        ]}
                        onPress={() => onSelectCategoria(cat)}
                      >
                        {codigoCat ? (
                          <Text
                            style={[
                              styles.categoriaChipText,
                              { fontSize: chipEstilo.fontSize, fontWeight: '800' },
                              categoriaFiltro === cat && !searchActive && styles.categoriaChipTextActive,
                            ]}
                          >
                            {codigoCat}
                          </Text>
                        ) : null}
                        {uriCat ? (
                          <Image
                            source={{ uri: uriCat }}
                            style={{ width: thumb, height: thumb, borderRadius: 6 }}
                            resizeMode="cover"
                          />
                        ) : null}
                        {etiqueta ? (
                        <Text style={[
                          styles.categoriaChipText,
                          { fontSize: chipEstilo.fontSize },
                          categoriaFiltro === cat && !searchActive && styles.categoriaChipTextActive,
                        ]}>
                          {etiqueta}
                        </Text>
                        ) : null}
                      </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  </>
                  ) : null}
                </>
              )}
            </View>

            {tipoPlatoFiltro ? (
              filtroCatOpen ? (
                <View style={[styles.filtroPanel, { height: listH, backgroundColor: theme.colors.surface }]}>
                  <View style={styles.filtroHeader}>
                    <Text style={[styles.filtroTitle, { color: theme.colors.text.primary }]}>Categorías</Text>
                    <View style={styles.filtroToggleRow}>
                      {[
                        { label: 'Nombre', value: CATEGORIA_ETIQUETA_NOMBRE },
                        { label: 'Código', value: CATEGORIA_ETIQUETA_CODIGO },
                      ].map((p) => {
                        const active = categoriaEtiqueta === p.value;
                        return (
                          <TouchableOpacity
                            key={p.value}
                            onPress={() => setCategoriaEtiqueta(p.value)}
                            style={[
                              styles.filtroToggleChip,
                              {
                                borderColor: active ? theme.colors.primary : theme.colors.border,
                                backgroundColor: active ? theme.colors.primary + '22' : theme.colors.background,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Mostrar ${p.label.toLowerCase()} de categoría`}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? theme.colors.primary : theme.colors.text.secondary }}>
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      onPress={() => setFiltroCatOpen(false)}
                      style={styles.filtroCloseBtn}
                      accessibilityLabel="Cerrar categorías"
                    >
                      <Text style={styles.filtroCloseTxt}>X</Text>
                    </TouchableOpacity>
                  </View>
                  {mostrarBuscarCategorias ? (
                    <TextInput
                      style={[styles.filtroSearch, { color: theme.colors.text.primary, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                      placeholder="Buscar categoría..."
                      placeholderTextColor={theme.colors.text.light}
                      value={filtroCatQ}
                      onChangeText={setFiltroCatQ}
                      autoCorrect={false}
                    />
                  ) : null}
                  <ScrollView keyboardShouldPersistTaps="handled" style={styles.filtroList}>
                    <View
                      style={[styles.filtroGrid, { gap: filtroLayout.gap }]}
                      onLayout={(e) => {
                        const w = e.nativeEvent.layout.width;
                        if (w > 0 && Math.abs(w - filtroGridW) > 1) setFiltroGridW(w);
                      }}
                    >
                      {!filtroCatQ.trim() ? (
                        <CategoriaFiltroCard
                          width={filtroLayout.cardW}
                          imgH={filtroLayout.imgH}
                          fontSize={filtroLayout.fontSize}
                          codeFontSize={filtroLayout.codeFontSize}
                          iconSize={filtroLayout.iconSize}
                          uri=""
                          codigo=""
                          label="Favoritos"
                          selected={categoriaFiltro === CAT_FAVORITOS}
                          onPress={() => {
                            onSelectCategoria(CAT_FAVORITOS);
                            setFiltroCatOpen(false);
                          }}
                          theme={theme}
                          placeholderIcon="star"
                        />
                      ) : null}
                      {catsFiltroVisibles.map((c) => (
                        <CategoriaFiltroCard
                          key={c.nombre}
                          width={filtroLayout.cardW}
                          imgH={filtroLayout.imgH}
                          fontSize={filtroLayout.fontSize}
                          codeFontSize={filtroLayout.codeFontSize}
                          iconSize={filtroLayout.iconSize}
                          uri={urlMediaServidor(c.imagenUrl)}
                          codigo={c.codigoMozo}
                          label={String(c.nombre || '').split('(')[0].trim()}
                          selected={categoriaFiltro === c.nombre && !searchActive}
                          onPress={() => {
                            onSelectCategoria(c.nombre);
                            setFiltroCatOpen(false);
                          }}
                          theme={theme}
                        />
                      ))}
                    </View>
                    {catsFiltroVisibles.length === 0 ? (
                      <Text style={[styles.emptyPlatosText, { padding: 16 }]}>Sin coincidencias</Text>
                    ) : null}
                  </ScrollView>
                </View>
              ) : (
              <FlatList
                ref={listRef}
                data={platosFiltrados}
                keyExtractor={(item) => String(item._filaBuscadorKey || item._id)}
                renderItem={renderPlato}
                extraData={{ selectedPlatos, cantidades, tipoServicioModal, favoritoIds }}
                style={{ height: listH }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScroll={onListScroll}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  <View style={styles.emptyPlatosContainer}>
                    <Text style={styles.emptyPlatosText}>
                      {categoriaFiltro === CAT_FAVORITOS && !searchActive
                        ? 'No tienes platos favoritos. Toca la estrella debajo del nombre.'
                        : 'No hay platos disponibles'}
                    </Text>
                  </View>
                }
              />
              )
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
    </Modal>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
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
    maxHeight: '92%',
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
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  mesaNumeroHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  searchInputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    paddingRight: 84,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  searchClearButton: {
    position: 'absolute',
    right: 42,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  searchFilterBtn: {
    position: 'absolute',
    right: 2,
    top: 2,
    bottom: 2,
    width: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriasContainer: {
    marginBottom: 6,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 32,
  },
  categoriasContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  categoriaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    marginRight: 0,
    borderWidth: 1,
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
  categoriaChipFavorito: {
    minWidth: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  categoriaChipFavoritoActive: {
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  },
  categoriaChipFavoritoTextActive: {
    color: '#1A1A1A',
  },
  favoritoToggle: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
    paddingVertical: 2,
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
  filtroPanel: {
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  filtroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filtroTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  filtroToggleRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  filtroToggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filtroCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtroCloseTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  filtroSearch: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  filtroList: {
    flex: 1,
  },
  filtroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
});
