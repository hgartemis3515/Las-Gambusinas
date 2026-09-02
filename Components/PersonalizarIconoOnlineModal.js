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
import { themeLight } from '../constants/theme';

const PRESETS = [
  { label: 'Baja', value: 0.25 },
  { label: 'Media', value: 0.55 },
  { label: 'Alta', value: 0.8 },
  { label: 'Opaca', value: 1 },
];

function OpacitySlider({ value, onChange, trackColor, fillColor, thumbColor }) {
  const widthRef = useRef(1);

  const applyX = useCallback(
    (locationX) => {
      const t = Math.max(0, Math.min(1, locationX / widthRef.current));
      onChange(0.1 + t * 0.9);
    },
    [onChange]
  );

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
            width: `${((value - 0.1) / 0.9) * 100}%`,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            left: `${((value - 0.1) / 0.9) * 100}%`,
          },
        ]}
      />
    </View>
  );
}

export default function PersonalizarIconoOnlineModal({ visible, onClose }) {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { opacity, setOpacity } = useOnlineBadge();
  const { mostrarAviso, setMostrarAviso } = useAvisoPlatoAgregado();
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
          <OpacitySlider
            value={opacity}
            onChange={setOpacity}
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
  reset: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetText: {
    fontSize: 13,
  },
});
