import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';
import { useApodosMesa } from '../context/ApodosMesaContext';
import { numeroMesaLabel, apodoDeMesa, APODO_MESA_MAX } from '../utils/apodosMesa';
import axios from '../config/axiosConfig';
import { apiConfig } from '../apiConfig';

function ordenarMesas(list) {
  return [...(list || [])].sort((a, b) => {
    const na = parseInt(String(a.nummesa ?? '').replace(/\D/g, ''), 10);
    const nb = parseInt(String(b.nummesa ?? '').replace(/\D/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.nummesa || '').localeCompare(String(b.nummesa || ''), 'es', { numeric: true });
  });
}

const PersonalizarMesasModal = ({ visible, onClose }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { apodos, apodoDe, setApodo } = useApodosMesa();
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = apiConfig.isConfigured ? apiConfig.getEndpoint('/mesas') : apiConfig.baseURL + '/mesas';
        const res = await axios.get(url, { timeout: 8000 });
        if (cancelled) return;
        const list = ordenarMesas(Array.isArray(res.data) ? res.data : []);
        setMesas(list);
        const d = {};
        list.forEach((m) => { d[String(m._id)] = apodoDeMesa(apodos, m); });
        setDraft(d);
      } catch {
        if (!cancelled) setMesas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mesas;
    return mesas.filter((m) => {
      const num = String(m.nummesa || '').toLowerCase();
      const nick = String(draft[String(m._id)] || apodoDe(m) || '').toLowerCase();
      return num.includes(s) || nick.includes(s) || numeroMesaLabel(m).toLowerCase().includes(s);
    });
  }, [mesas, q, draft, apodoDe]);

  const guardar = (mesa, texto) => {
    setDraft((prev) => ({ ...prev, [String(mesa._id)]: texto }));
    setApodo(mesa, texto);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface || '#fff' }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="table-furniture" size={22} color={theme.colors.primary || '#d4af37'} />
            <Text style={[styles.title, { color: theme.colors.text?.primary || '#111' }]}>Personalizar mesas</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.text?.light || '#9CA3AF'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: theme.colors.text?.secondary || '#6B7280' }]}>
            El apodo es solo visual y solo lo ves tú. No cambia registros ni lo ven otros mozos.
          </Text>
          <TextInput
            style={[styles.search, {
              backgroundColor: theme.colors.background || '#f3f4f6',
              color: theme.colors.text?.primary || '#111',
              borderColor: theme.colors.border || '#E5E7EB',
            }]}
            placeholder="Buscar mesa o apodo…"
            placeholderTextColor={theme.colors.text?.muted || '#9CA3AF'}
            value={q}
            onChangeText={setQ}
          />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.colors.primary} />
          ) : (
            <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
              {filtradas.map((mesa) => {
                const id = String(mesa._id);
                const value = draft[id] != null ? draft[id] : apodoDe(mesa);
                return (
                  <View key={id} style={styles.row}>
                    <View style={styles.numBox}>
                      <Text style={styles.num}>{numeroMesaLabel(mesa)}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, {
                        backgroundColor: theme.colors.background || '#f3f4f6',
                        color: theme.colors.text?.primary || '#111',
                        borderColor: theme.colors.border || '#E5E7EB',
                      }]}
                      placeholder="Apodo (ej. Terraza, VIP…)"
                      placeholderTextColor={theme.colors.text?.muted || '#9CA3AF'}
                      value={value}
                      maxLength={APODO_MESA_MAX}
                      onChangeText={(t) => guardar(mesa, t)}
                    />
                    {!!String(value || '').trim() && (
                      <TouchableOpacity onPress={() => guardar(mesa, '')} hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {filtradas.length === 0 && (
                <Text style={[styles.empty, { color: theme.colors.text?.muted || '#9CA3AF' }]}>Sin mesas</Text>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 16 },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  numBox: { minWidth: 56, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(212,175,55,0.15)' },
  num: { fontWeight: '700', fontSize: 13, color: '#92400E', textAlign: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  empty: { textAlign: 'center', padding: 20, fontSize: 13 },
});

export default PersonalizarMesasModal;
