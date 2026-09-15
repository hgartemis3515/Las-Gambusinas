import React from 'react';
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
import { useRedireccionEnvio } from '../context/RedireccionEnvioContext';
import { themeLight } from '../constants/theme';
import { REDIRECCION_ENVIO_OPCIONES } from '../utils/redireccionEnvioPrefs';

const PersonalizarRedireccionEnvioModal = ({ visible, onClose }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { destino, setDestino, reset } = useRedireccionEnvio();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface || '#fff' }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="page-next-outline" size={22} color={theme.colors.primary || '#C41E3A'} />
            <Text style={[styles.title, { color: theme.colors.text?.primary || '#111' }]}>Redirección tras enviar orden</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.text?.light || '#9CA3AF'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: theme.colors.text?.secondary || '#6B7280' }]}>
            Elige a qué pantalla ir después de crear una comanda. Por defecto va a Pendientes.
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.section}>Destino</Text>
            <View style={styles.rowWrap}>
              {REDIRECCION_ENVIO_OPCIONES.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  active={destino === o.id}
                  color={theme.colors.primary || '#C41E3A'}
                  onPress={() => setDestino(o.id)}
                />
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
      active && { borderColor: color || '#C41E3A', backgroundColor: (color || '#C41E3A') + '22' },
    ]}
  >
    <Text style={[styles.chipText, active && { color: color || '#C41E3A', fontWeight: '700' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', marginBottom: 8, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, color: '#374151' },
  reset: { alignSelf: 'center', padding: 12 },
  resetText: { color: '#6B7280', fontSize: 13 },
});

export default PersonalizarRedireccionEnvioModal;
