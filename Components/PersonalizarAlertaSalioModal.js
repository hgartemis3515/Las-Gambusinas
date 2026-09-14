import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAlertaSalio } from '../context/AlertaSalioContext';
import { themeLight } from '../constants/theme';
import {
  ALERTA_SALIO_ESTILOS,
  ALERTA_SALIO_COLORES,
  ALERTA_SALIO_VELOCIDAD,
} from '../utils/alertaSalioPrefs';

const PersonalizarAlertaSalioModal = ({ visible, onClose }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { prefs, setPrefs, reset } = useAlertaSalio();
  const pal = ALERTA_SALIO_COLORES[prefs.color] || ALERTA_SALIO_COLORES.naranja;
  const ms = ALERTA_SALIO_VELOCIDAD[prefs.velocidad]?.ms || 750;
  const apagado = prefs.estilo === 'apagado';

  const [flashHi, setFlashHi] = useState(false);
  useEffect(() => {
    if (apagado || !visible) return;
    const interval = setInterval(() => setFlashHi((v) => !v), Math.max(200, Math.round(ms / 2)));
    return () => clearInterval(interval);
  }, [apagado, visible, ms]);

  const previewBg = apagado ? pal.lo : (flashHi ? pal.hi : pal.lo);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface || '#fff' }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="alert" size={22} color="#EA580C" />
            <Text style={[styles.title, { color: theme.colors.text?.primary || '#111' }]}>Alerta platos Salió</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.text?.light || '#9CA3AF'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: theme.colors.text?.secondary || '#6B7280' }]}>
            El recuadro del plato en Salió (listo para entregar) destella con el color de alerta. El texto no se anima. Se detiene al entregar.
          </Text>
          <ScrollView style={{ maxHeight: 460 }}>
            <View
              style={[
                styles.preview,
                { backgroundColor: previewBg, borderLeftColor: pal.chip },
              ]}
            >
              <Text style={styles.previewName}>Ceviche</Text>
              <Text style={styles.previewTimer}>⏱ 02:15</Text>
            </View>

            <Text style={styles.section}>Animación</Text>
            <View style={styles.rowWrap}>
              {ALERTA_SALIO_ESTILOS.map((e) => (
                <Chip key={e.id} label={e.label} active={prefs.estilo === e.id} onPress={() => setPrefs({ estilo: e.id })} />
              ))}
            </View>
            <Text style={styles.section}>Color</Text>
            <View style={styles.rowWrap}>
              {Object.values(ALERTA_SALIO_COLORES).map((c) => (
                <Chip key={c.id} label={c.label} active={prefs.color === c.id} color={c.chip} onPress={() => setPrefs({ color: c.id })} />
              ))}
            </View>
            <Text style={styles.section}>Velocidad</Text>
            <View style={styles.rowWrap}>
              {Object.values(ALERTA_SALIO_VELOCIDAD).map((v) => (
                <Chip key={v.id} label={v.label} active={prefs.velocidad === v.id} onPress={() => setPrefs({ velocidad: v.id })} />
              ))}
            </View>
            <TouchableOpacity style={styles.reset} onPress={reset}>
              <Text style={styles.resetText}>Restablecer</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Chip = ({ label, active, onPress, color }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.chip,
      active && { borderColor: color || '#EA580C', backgroundColor: (color || '#EA580C') + '22' },
    ]}
  >
    <Text style={[styles.chipText, active && { color: color || '#EA580C', fontWeight: '700' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  preview: {
    borderLeftWidth: 6,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 52,
  },
  previewName: { fontWeight: '700', fontSize: 15, color: '#111827' },
  previewTimer: { fontWeight: '700', fontSize: 13, color: '#9A3412' },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', marginBottom: 8, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, color: '#374151' },
  reset: { alignSelf: 'center', padding: 12 },
  resetText: { color: '#6B7280', fontSize: 13 },
});

export default PersonalizarAlertaSalioModal;
