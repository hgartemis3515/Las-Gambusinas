import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Switch,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useOnlineBadge, DEFAULT_ONLINE_BADGE_OPACITY } from '../context/OnlineBadgeContext';
import { useAvisoPlatoAgregado } from '../context/AvisoPlatoAgregadoContext';
import { useOmitirConfirmacionPago } from '../context/OmitirConfirmacionPagoContext';
import { useBotonCantidadPlato } from '../context/BotonCantidadPlatoContext';
import { useBotonEnviarOrden } from '../context/BotonEnviarOrdenContext';
import { useBotonesMenuOrden } from '../context/BotonesMenuOrdenContext';
import { useAbrirMenuNuevaOrden } from '../context/AbrirMenuNuevaOrdenContext';
import { themeLight } from '../constants/theme';
import {
  BOTON_CANTIDAD_SIZE_MIN,
  BOTON_CANTIDAD_SIZE_MAX,
  BOTON_CANTIDAD_SIZE_PRESETS,
  BOTON_CANTIDAD_COLOR_PRESETS,
  BOTON_CANTIDAD_SIZE_DEFAULT,
  BOTON_CANTIDAD_COLOR_DEFAULT,
  ESTILO_CANTIDAD_STEPPER,
  ESTILO_CANTIDAD_AGREGAR,
  ESTILO_CANTIDAD_DEFAULT,
} from '../utils/botonCantidadPlato';
import {
  BOTON_ENVIAR_SIZE_MIN,
  BOTON_ENVIAR_SIZE_MAX,
  BOTON_ENVIAR_SIZE_PRESETS,
  BOTON_ENVIAR_COLOR_PRESETS,
  BOTON_ENVIAR_SIZE_DEFAULT,
  BOTON_ENVIAR_COLOR_DEFAULT,
  BOTON_ENVIAR_VISIBLE_DEFAULT,
} from '../utils/botonEnviarOrden';
import {
  BOTON_CERRAR_COLOR_DEFAULT,
  BOTON_SUMAR_COLOR_DEFAULT,
  BOTON_CAMBIAR_COLOR_DEFAULT,
  BOTON_CAMBIAR_VISIBLE_DEFAULT,
  estiloBotonCerrarMenu,
  estiloBotonSumarBusqueda,
} from '../utils/botonesMenuOrden';

const PRESETS = [
  { label: 'Baja', value: 0.25 },
  { label: 'Media', value: 0.55 },
  { label: 'Alta', value: 0.8 },
  { label: 'Opaca', value: 1 },
];

function ValueSlider({ value, onChange, min, max, trackColor, fillColor, thumbColor }) {
  const widthRef = useRef(1);
  const span = max - min || 1;

  const applyX = useCallback(
    (locationX) => {
      const t = Math.max(0, Math.min(1, locationX / widthRef.current));
      onChange(min + t * span);
    },
    [onChange, min, span]
  );

  const pct = ((value - min) / span) * 100;

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width || 1;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => applyX(e.nativeEvent.locationX)}
      onResponderMove={(e) => applyX(e.nativeEvent.locationX)}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: `${pct}%`,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            left: `${pct}%`,
          },
        ]}
      />
    </View>
  );
}

function ColorSwatches({ value, onChange, presets }) {
  return (
    <View style={styles.colorRow}>
      {presets.map((p) => {
        const active = String(value || '').toUpperCase() === p.value.toUpperCase();
        return (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.colorSwatch,
              { backgroundColor: p.value },
              active && styles.colorSwatchActive,
            ]}
            onPress={() => onChange(p.value)}
            accessibilityLabel={p.label}
            activeOpacity={0.8}
          >
            {active ? (
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function PersonalizarIconoOnlineModal({ visible, onClose }) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { opacity, setOpacity } = useOnlineBadge();
  const { mostrarAviso, setMostrarAviso } = useAvisoPlatoAgregado();
  const { omitirConfirmacionPago, setOmitirConfirmacionPago } = useOmitirConfirmacionPago();
  const { abrirMenuNuevaOrden, setAbrirMenuNuevaOrden } = useAbrirMenuNuevaOrden();
  const {
    size: qtySize,
    color: qtyColor,
    setSize: setQtySize,
    setColor: setQtyColor,
    reset: resetQty,
    estilo: estiloQty,
    iconSize: iconSizeQty,
    estiloAgregar,
    setEstiloAgregar,
  } = useBotonCantidadPlato();
  const {
    size: enviarSize,
    color: enviarColor,
    visible: enviarVisible,
    setSize: setEnviarSize,
    setColor: setEnviarColor,
    setVisible: setEnviarVisible,
    reset: resetEnviar,
    estilo: estiloEnviar,
    iconSize: iconSizeEnviar,
  } = useBotonEnviarOrden();
  const {
    cerrarColor,
    sumarColor,
    cambiarColor,
    cambiarVisible,
    setCerrarColor,
    setSumarColor,
    setCambiarColor,
    setCambiarVisible,
    reset: resetMenuOrden,
    estiloCambiar,
  } = useBotonesMenuOrden();
  const pct = Math.round(opacity * 100);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              Personalizar
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Aviso al agregar platos
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            Al buscar un plato y tocar Agregar o +, puede salir una nota tipo «Papa a la huancaína agregado». Desactívala para elegir más rápido.
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                Mostrar nota al agregar
              </Text>
              <Text style={[styles.switchHint, { color: theme.colors.text.secondary }]}>
                {mostrarAviso ? 'Se muestra el aviso' : 'Sin aviso: el plato entra directo'}
              </Text>
            </View>
            <Switch
              value={mostrarAviso}
              onValueChange={setMostrarAviso}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
              thumbColor={mostrarAviso ? theme.colors.primary : theme.colors.text.light}
              accessibilityLabel="Mostrar nota al agregar un plato"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Confirmación de pago
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            Tras Continuar en Información de pago sale «Confirmar Pago» (NO / SÍ). Actívalo para cobrar al tocar Continuar, sin ese paso extra.
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                Omitir Confirmación Pago
              </Text>
              <Text style={[styles.switchHint, { color: theme.colors.text.secondary }]}>
                {omitirConfirmacionPago
                  ? 'Continuar cobra de inmediato'
                  : 'Se pide confirmar con NO / SÍ'}
              </Text>
            </View>
            <Switch
              value={omitirConfirmacionPago}
              onValueChange={setOmitirConfirmacionPago}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
              thumbColor={omitirConfirmacionPago ? theme.colors.primary : theme.colors.text.light}
              accessibilityLabel="Omitir confirmación de pago"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Nueva orden
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            Con una mesa marcada en Inicio, Nueva orden selecciona esa mesa en Órdenes y abre el menú para elegir el tipo (desayuno, carta…).
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                Abrir menú al crear orden
              </Text>
              <Text style={[styles.switchHint, { color: theme.colors.text.secondary }]}>
                {abrirMenuNuevaOrden
                  ? 'Nueva orden abre el menú de tipos'
                  : 'Solo va a Órdenes con la mesa'}
              </Text>
            </View>
            <Switch
              value={abrirMenuNuevaOrden}
              onValueChange={setAbrirMenuNuevaOrden}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
              thumbColor={abrirMenuNuevaOrden ? theme.colors.primary : theme.colors.text.light}
              accessibilityLabel="Abrir menú al crear una nueva orden"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Botones − y +
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            Estilo 1: restar/sumar sobre lo que ya está en la orden. Estilo 2 (por defecto): elegís cuántos con −/+ (siempre desde 1) y tocás Agregar. El − también quita platos ya agregados; el precio y el 2x se actualizan con lo ya pedido.
          </Text>
          <View style={styles.estiloRow}>
            <TouchableOpacity
              style={[
                styles.estiloChip,
                {
                  borderColor: estiloAgregar === ESTILO_CANTIDAD_STEPPER ? qtyColor : theme.colors.border,
                  backgroundColor: estiloAgregar === ESTILO_CANTIDAD_STEPPER ? qtyColor + '22' : theme.colors.background,
                },
              ]}
              onPress={() => setEstiloAgregar(ESTILO_CANTIDAD_STEPPER)}
            >
              <Text style={[styles.chipText, { color: estiloAgregar === ESTILO_CANTIDAD_STEPPER ? qtyColor : theme.colors.text.secondary }]}>
                Estilo 1 · − 0 +
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.estiloChip,
                {
                  borderColor: estiloAgregar === ESTILO_CANTIDAD_AGREGAR ? qtyColor : theme.colors.border,
                  backgroundColor: estiloAgregar === ESTILO_CANTIDAD_AGREGAR ? qtyColor + '22' : theme.colors.background,
                },
              ]}
              onPress={() => setEstiloAgregar(ESTILO_CANTIDAD_AGREGAR)}
            >
              <Text style={[styles.chipText, { color: estiloAgregar === ESTILO_CANTIDAD_AGREGAR ? qtyColor : theme.colors.text.secondary }]}>
                Estilo 2 · − 1 + Agregar
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewQtyWrap} pointerEvents="none">
            <View style={[styles.previewQtyBtn, estiloQty]}>
              <MaterialCommunityIcons name="minus" size={iconSizeQty} color="#FFFFFF" />
            </View>
            <Text style={[styles.previewQtyNum, { color: theme.colors.text.primary }]}>2</Text>
            <View style={[styles.previewQtyBtn, estiloQty]}>
              <MaterialCommunityIcons name="plus" size={iconSizeQty} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.rowLabel}>
            <Text style={[styles.label, { color: theme.colors.text.primary }]}>
              Tamaño
            </Text>
            <Text style={[styles.pct, { color: theme.colors.primary }]}>{qtySize} px</Text>
          </View>
          <ValueSlider
            value={qtySize}
            onChange={setQtySize}
            min={BOTON_CANTIDAD_SIZE_MIN}
            max={BOTON_CANTIDAD_SIZE_MAX}
            trackColor={theme.colors.border}
            fillColor={qtyColor}
            thumbColor={qtyColor}
          />
          <View style={styles.presets}>
            {BOTON_CANTIDAD_SIZE_PRESETS.map((p) => {
              const active = qtySize === p.value;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? qtyColor + '22' : theme.colors.background,
                      borderColor: active ? qtyColor : theme.colors.border,
                    },
                  ]}
                  onPress={() => setQtySize(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? qtyColor : theme.colors.text.secondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.label, { color: theme.colors.text.primary, marginTop: 16, marginBottom: 10 }]}>
            Color
          </Text>
          <View style={styles.colorRow}>
            {BOTON_CANTIDAD_COLOR_PRESETS.map((p) => {
              const active = qtyColor.toUpperCase() === p.value.toUpperCase();
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: p.value },
                    active && styles.colorSwatchActive,
                  ]}
                  onPress={() => setQtyColor(p.value)}
                  accessibilityLabel={p.label}
                  activeOpacity={0.8}
                >
                  {active ? (
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {(qtySize !== BOTON_CANTIDAD_SIZE_DEFAULT ||
            qtyColor.toUpperCase() !== BOTON_CANTIDAD_COLOR_DEFAULT ||
            estiloAgregar !== ESTILO_CANTIDAD_DEFAULT) && (
            <TouchableOpacity
              style={[styles.reset, { borderColor: theme.colors.border }]}
              onPress={resetQty}
            >
              <Text style={[styles.resetText, { color: theme.colors.text.secondary }]}>
                Restaurar tamaño y color por defecto
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Botón E (enviar orden)
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            En el menú, a la izquierda de la X. Por defecto rojo. Hace lo mismo que Enviar Orden.
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                Mostrar botón E
              </Text>
              <Text style={[styles.switchHint, { color: theme.colors.text.secondary }]}>
                {enviarVisible ? 'Visible en menú y guarniciones' : 'Oculto'}
              </Text>
            </View>
            <Switch
              value={enviarVisible}
              onValueChange={setEnviarVisible}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
              thumbColor={enviarVisible ? theme.colors.primary : theme.colors.text.light}
              accessibilityLabel="Mostrar botón E de enviar orden"
            />
          </View>
          <View style={styles.previewQtyWrap} pointerEvents="none">
            <View style={[styles.previewQtyBtn, estiloEnviar]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: iconSizeEnviar }}>E</Text>
            </View>
          </View>
          <View style={styles.rowLabel}>
            <Text style={[styles.label, { color: theme.colors.text.primary }]}>
              Tamaño
            </Text>
            <Text style={[styles.pct, { color: theme.colors.primary }]}>{enviarSize} px</Text>
          </View>
          <ValueSlider
            value={enviarSize}
            onChange={setEnviarSize}
            min={BOTON_ENVIAR_SIZE_MIN}
            max={BOTON_ENVIAR_SIZE_MAX}
            trackColor={theme.colors.border}
            fillColor={enviarColor}
            thumbColor={enviarColor}
          />
          <View style={styles.presets}>
            {BOTON_ENVIAR_SIZE_PRESETS.map((p) => {
              const active = enviarSize === p.value;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? enviarColor + '22' : theme.colors.background,
                      borderColor: active ? enviarColor : theme.colors.border,
                    },
                  ]}
                  onPress={() => setEnviarSize(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? enviarColor : theme.colors.text.secondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.label, { color: theme.colors.text.primary, marginTop: 16, marginBottom: 10 }]}>
            Color
          </Text>
          <View style={styles.colorRow}>
            {BOTON_ENVIAR_COLOR_PRESETS.map((p) => {
              const active = enviarColor.toUpperCase() === p.value.toUpperCase();
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: p.value },
                    active && styles.colorSwatchActive,
                  ]}
                  onPress={() => setEnviarColor(p.value)}
                  accessibilityLabel={p.label}
                  activeOpacity={0.8}
                >
                  {active ? (
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {(enviarSize !== BOTON_ENVIAR_SIZE_DEFAULT ||
            enviarColor.toUpperCase() !== BOTON_ENVIAR_COLOR_DEFAULT.toUpperCase() ||
            enviarVisible !== BOTON_ENVIAR_VISIBLE_DEFAULT) && (
            <TouchableOpacity
              style={[styles.reset, { borderColor: theme.colors.border }]}
              onPress={resetEnviar}
            >
              <Text style={[styles.resetText, { color: theme.colors.text.secondary }]}>
                Restaurar botón E por defecto
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Botón X (cerrar menú)
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            A la derecha de E. Por defecto azul. El tamaño sigue al botón E.
          </Text>
          <View style={styles.previewQtyWrap} pointerEvents="none">
            <View style={[styles.previewQtyBtn, estiloBotonCerrarMenu(enviarSize, cerrarColor)]}>
              <MaterialCommunityIcons name="close" size={iconSizeEnviar} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.label, { color: theme.colors.text.primary, marginBottom: 10 }]}>
            Color
          </Text>
          <ColorSwatches value={cerrarColor} onChange={setCerrarColor} presets={BOTON_ENVIAR_COLOR_PRESETS} />

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Botón Sumar
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            A la izquierda de E. Limpia el buscador del menú. Por defecto verde.
          </Text>
          <View style={styles.previewQtyWrap} pointerEvents="none">
            <View style={[styles.previewQtyBtn, estiloBotonSumarBusqueda(enviarSize, sumarColor)]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: Math.max(11, iconSizeEnviar - 6) }}>Sumar</Text>
            </View>
          </View>
          <Text style={[styles.label, { color: theme.colors.text.primary, marginBottom: 10 }]}>
            Color
          </Text>
          <ColorSwatches value={sumarColor} onChange={setSumarColor} presets={BOTON_ENVIAR_COLOR_PRESETS} />

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Botón Cambiar
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            En la lista de platos de Órdenes, pegado a la izquierda de Mesa/Llevar. Quita ese plato y abre el tipo de carta para agregar otro. Por defecto rojo.
          </Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                Mostrar botón Cambiar
              </Text>
              <Text style={[styles.switchHint, { color: theme.colors.text.secondary }]}>
                {cambiarVisible ? 'Visible a la izquierda de Mesa/Llevar' : 'Oculto'}
              </Text>
            </View>
            <Switch
              value={cambiarVisible}
              onValueChange={setCambiarVisible}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
              thumbColor={cambiarVisible ? theme.colors.primary : theme.colors.text.light}
              accessibilityLabel="Mostrar botón Cambiar"
            />
          </View>
          <View style={styles.previewQtyWrap} pointerEvents="none">
            <View style={[styles.previewQtyBtn, estiloCambiar]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>Cambiar</Text>
            </View>
          </View>
          <Text style={[styles.label, { color: theme.colors.text.primary, marginBottom: 10 }]}>
            Color
          </Text>
          <ColorSwatches value={cambiarColor} onChange={setCambiarColor} presets={BOTON_ENVIAR_COLOR_PRESETS} />
          {(cerrarColor.toUpperCase() !== BOTON_CERRAR_COLOR_DEFAULT
            || sumarColor.toUpperCase() !== BOTON_SUMAR_COLOR_DEFAULT
            || cambiarColor.toUpperCase() !== BOTON_CAMBIAR_COLOR_DEFAULT
            || cambiarVisible !== BOTON_CAMBIAR_VISIBLE_DEFAULT) && (
            <TouchableOpacity
              style={[styles.reset, { borderColor: theme.colors.border }]}
              onPress={resetMenuOrden}
            >
              <Text style={[styles.resetText, { color: theme.colors.text.secondary }]}>
                Restaurar X, Sumar y Cambiar por defecto
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Icono ONLINE
          </Text>
          <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
            Ajusta la transparencia. El icono no bloquea botones detrás.
          </Text>

          <View style={styles.previewWrap}>
            <View style={[styles.previewBadge, { opacity }]} pointerEvents="none">
              <View style={styles.previewDot} />
              <Text style={styles.previewText}>ONLINE</Text>
            </View>
          </View>

          <View style={styles.rowLabel}>
            <Text style={[styles.label, { color: theme.colors.text.primary }]}>
              Transparencia
            </Text>
            <Text style={[styles.pct, { color: theme.colors.primary }]}>{pct}%</Text>
          </View>
          <ValueSlider
            value={opacity}
            onChange={setOpacity}
            min={0.1}
            max={1}
            trackColor={theme.colors.border}
            fillColor={theme.colors.primary}
            thumbColor={theme.colors.primary}
          />

          <View style={styles.presets}>
            {PRESETS.map((p) => {
              const active = Math.abs(opacity - p.value) < 0.04;
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? theme.colors.primary + '22'
                        : theme.colors.background,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => setOpacity(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.colors.primary : theme.colors.text.secondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.reset, { borderColor: theme.colors.border }]}
            onPress={() => setOpacity(DEFAULT_ONLINE_BADGE_OPACITY)}
          >
            <Text style={[styles.resetText, { color: theme.colors.text.secondary }]}>
              Restaurar transparencia por defecto
            </Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  previewText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  pct: {
    fontSize: 15,
    fontWeight: '700',
  },
  track: {
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 6,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    top: 3,
  },
  presets: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  estiloRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  estiloChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  reset: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetText: {
    fontSize: 13,
  },
  previewQtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
    minHeight: 56,
  },
  previewQtyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewQtyNum: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: '#111827',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
});
