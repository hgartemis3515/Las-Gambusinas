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
import { useApodosMesa } from '../context/ApodosMesaContext';
import { numeroMesaLabel, apodoDeMesa, textoMesaConApodo, APODO_MESA_MAX } from '../utils/apodosMesa';
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
  const { apodos, apodoDe, setApodo } = useApodosMesa();
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [elegida, setElegida] = useState(null);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setElegida(null);
    setTexto('');
    setQ('');
    (async () => {
      setLoading(true);
      try {
        const url = apiConfig.isConfigured ? apiConfig.getEndpoint('/mesas') : apiConfig.baseURL + '/mesas';
        const res = await axios.get(url, { timeout: 8000 });
        if (!cancelled) setMesas(ordenarMesas(Array.isArray(res.data) ? res.data : []));
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
      const nick = String(apodoDe(m) || '').toLowerCase();
      return num.includes(s) || nick.includes(s) || numeroMesaLabel(m).toLowerCase().includes(s);
    });
  }, [mesas, q, apodoDe, apodos]);

  const conApodo = useMemo(
    () => mesas.filter((m) => String(apodoDeMesa(apodos, m) || '').trim()),
    [mesas, apodos]
  );

  const elegir = (mesa) => {
    setElegida(mesa);
    setTexto(apodoDe(mesa) || '');
  };

  const guardar = () => {
    if (!elegida) return;
    setApodo(elegida, texto);
  };

  const quitar = (mesa) => {
    const m = mesa || elegida;
    if (!m) return;
    setApodo(m, '');
    if (elegida && String(elegida._id) === String(m._id)) setTexto('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Personalizar mesas</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Solo lo ves tú en esta tablet. No cambia la comanda ni lo ven caja ni cocina.
          </Text>
          <TextInput
            style={styles.search}
            placeholder="Buscar mesa o apodo…"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={q}
            onChangeText={setQ}
          />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#F5C518" />
          ) : (
            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
              {conApodo.length > 0 && (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Con apodo</Text>
                  <View style={styles.wrap}>
                    {conApodo.map((m) => (
                      <TouchableOpacity key={`a-${m._id}`} style={styles.chipOn} onPress={() => elegir(m)}>
                        <Text style={styles.chipOnText}>{textoMesaConApodo(m, apodoDe(m))}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <Text style={styles.blockTitle}>Mesas</Text>
              <View style={styles.wrap}>
                {filtradas.map((m) => {
                  const tiene = !!String(apodoDe(m) || '').trim();
                  const activa = elegida && String(elegida._id) === String(m._id);
                  return (
                    <TouchableOpacity
                      key={String(m._id)}
                      style={[styles.mesa, tiene && styles.mesaOn, activa && styles.mesaActiva]}
                      onPress={() => elegir(m)}
                    >
                      <Text style={styles.mesaNum}>{numeroMesaLabel(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {filtradas.length === 0 && <Text style={styles.empty}>Sin mesas</Text>}
            </ScrollView>
          )}
          {elegida && (
            <View style={styles.editor}>
              <Text style={styles.preview}>{textoMesaConApodo(elegida, texto)}</Text>
              <TextInput
                style={styles.input}
                placeholder="Apodo (ej. Terraza, VIP…)"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={texto}
                maxLength={APODO_MESA_MAX}
                onChangeText={setTexto}
              />
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnQuitar} onPress={() => quitar()}>
                  <Text style={styles.btnText}>Quitar apodo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGuardar} onPress={guardar}>
                  <Text style={styles.btnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#12121A', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#fff', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  search: { backgroundColor: '#1E293B', color: '#fff', borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 16, marginBottom: 12 },
  block: { marginBottom: 8 },
  blockTitle: { color: '#fff', fontWeight: '800', fontSize: 13, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOn: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' },
  chipOnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  mesa: { minWidth: 56, minHeight: 48, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#1E3A8A', alignItems: 'center', justifyContent: 'center' },
  mesaOn: { backgroundColor: '#6D28D9' },
  mesaActiva: { borderWidth: 2, borderColor: '#fff' },
  mesaNum: { color: '#fff', fontWeight: '800', fontSize: 16 },
  empty: { color: '#fff', textAlign: 'center', padding: 16 },
  editor: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  preview: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  input: { backgroundColor: '#1E293B', color: '#fff', borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnQuitar: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' },
  btnGuardar: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

export default PersonalizarMesasModal;
