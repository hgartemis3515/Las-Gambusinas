import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SectionList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { themeLight } from '../../constants/theme';
import {
  getConversaciones,
  getMensajesConv,
  enviarMensajeTexto,
  enviarMensajeVoz,
  marcarLeido,
  getNoLeidosCount,
  setSilenciado,
  setPineado,
  setArchivado,
  emitTyping,
  crearGrupo,
} from '../../services/chatService';
import apiConfig from '../../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIO_COLORS = {
  baja: '#95a5a6',
  normal: '#3498db',
  alta: '#f39c12',
  urgente: '#e74c3c',
  critica: '#c0392b',
};
const PRIO_LABELS = { baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente', critica: 'Crítica' };

function cText(theme, variant = 'primary') {
  const t = theme?.colors?.text;
  if (t && typeof t === 'object') return t[variant] || t.primary || '#fff';
  if (typeof t === 'string') return t;
  return variant === 'primary' ? '#1A1A1A' : '#888';
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const { socket, connected } = useSocket() || {};
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const isDarkMode = !!themeContext?.isDarkMode;

  const colors = useMemo(() => {
    const primary = theme?.colors?.primary || theme?.primary || '#C41E3A';
    return {
      bg: theme?.colors?.background || (isDarkMode ? '#1A1A1A' : '#F8F9FA'),
      surface: theme?.colors?.surface || (isDarkMode ? '#2A2A2A' : '#FFFFFF'),
      border: theme?.colors?.border || (isDarkMode ? '#404040' : '#E0E0E0'),
      text: cText(theme, 'primary'),
      textSecondary: cText(theme, 'secondary'),
      textMuted: cText(theme, 'light'),
      textWhite: cText(theme, 'white') || '#FFFFFF',
      primary,
      inputBg: isDarkMode ? '#333333' : '#F0F0F0',
      bubbleOther: isDarkMode ? '#333333' : '#E8E8E8',
      bubbleOtherText: isDarkMode ? '#FFFFFF' : '#1A1A1A',
      replyBar: isDarkMode ? '#252525' : '#F5F5F5',
    };
  }, [theme, isDarkMode]);

  const [conversaciones, setConversaciones] = useState([]);
  const [convActiva, setConvActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [prioridad, setPrioridad] = useState('normal');
  const [noLeidos, setNoLeidos] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [typingShown, setTypingShown] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState('idle');
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const grabacionRef = useRef(null);

  // === Nuevo grupo (modal) ===
  const [modalGrupo, setModalGrupo] = useState(false);
  const [grupoNombre, setGrupoNombre] = useState('');
  const [grupoSeleccion, setGrupoSeleccion] = useState([]);
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const url = apiConfig.getEndpoint('/mozos?activos=true');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data || data?.mozos || []);
      setUsuariosLista(list);
    } catch (_) { /* silencioso */ } finally {
      setCargandoUsuarios(false);
    }
  }, []);

  useEffect(() => {
    if (modalGrupo && usuariosLista.length === 0) cargarUsuarios();
  }, [modalGrupo, usuariosLista.length, cargarUsuarios]);

  const toggleMiembroGrupo = (id) => {
    setGrupoSeleccion((curr) =>
      curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]
    );
  };

  const crearGrupoNuevo = async () => {
    if (!grupoNombre.trim()) { Alert.alert('Falta el nombre', 'Ponle un nombre al grupo'); return; }
    if (grupoSeleccion.length === 0) { Alert.alert('Sin miembros', 'Elige al menos a una persona'); return; }
    try {
      const resp = await crearGrupo(grupoNombre.trim(), grupoSeleccion);
      if (resp?.success) {
        setModalGrupo(false);
        setGrupoNombre('');
        setGrupoSeleccion([]);
        await cargarInbox();
        abrirConversacion(resp.data);
      } else {
        Alert.alert('Error', resp?.error || 'No se pudo crear el grupo');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el grupo');
    }
  };

  const cargarInbox = useCallback(async () => {
    try {
      const resp = await getConversaciones();
      if (resp?.success) setConversaciones(resp.data || []);
      const c = await getNoLeidosCount();
      setNoLeidos(c?.data?.count || 0);
    } catch (_) { /* silencioso */ }
  }, []);

  useEffect(() => { cargarInbox(); }, [cargarInbox]);

  useEffect(() => {
    if (!socket) return;
    const handlerNuevo = (data) => {
      if (convActiva && data?.conversacionId && String(data.conversacionId) === String(convActiva._id || convActiva)) {
        cargarMensajes(convActiva._id || convActiva);
      }
      cargarInbox();
    };
    const handlerTyping = (d) => {
      if (!d?.remitenteId || !convActiva) return;
      if (String(d.conversacionId) !== String(convActiva._id || convActiva)) return;
      setTypingShown(d.remitenteNombre || d.remitenteId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingShown(null), 3000);
    };
    const handlerEntregado = () => { if (convActiva) cargarMensajes(convActiva._id || convActiva); };
    const handlerLeido = () => { if (convActiva) cargarMensajes(convActiva._id || convActiva); };
    socket.on('mensaje:nuevo', handlerNuevo);
    socket.on('mensaje:typing', handlerTyping);
    socket.on('mensaje:entregado', handlerEntregado);
    socket.on('mensaje:leido', handlerLeido);
    return () => {
      socket.off('mensaje:nuevo', handlerNuevo);
      socket.off('mensaje:typing', handlerTyping);
      socket.off('mensaje:entregado', handlerEntregado);
      socket.off('mensaje:leido', handlerLeido);
    };
  }, [socket, convActiva, cargarInbox]);

  useEffect(() => {
    if (socket?.connected && convActiva) {
      socket.emit('join-conversacion', convActiva._id || convActiva);
    }
  }, [socket, convActiva]);

  const cargarMensajes = useCallback(async (convId) => {
    setCargando(true);
    try {
      const resp = await getMensajesConv(convId);
      setMensajes(resp?.data || []);
      try { await marcarLeido(convId); } catch (_) {}
      cargarInbox();
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar los mensajes');
    } finally {
      setCargando(false);
    }
  }, [cargarInbox]);

  const abrirConversacion = async (conv) => {
    Haptics.selectionAsync();
    setConvActiva(conv);
    setReplyTo(null);
    await cargarMensajes(conv._id);
  };

  const volverALista = () => {
    setConvActiva(null);
    setMensajes([]);
    setReplyTo(null);
    cargarInbox();
  };

  const handleEnviar = async () => {
    const t = texto.trim();
    if (!t || !convActiva) return;
    setTexto('');
    setReplyTo(null);
    try {
      await enviarMensajeTexto(convActiva._id, t, prioridad, replyTo?._id || null);
      await cargarMensajes(convActiva._id);
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
      setTexto(t);
    }
  };

  const onInputChange = (val) => {
    setTexto(val);
    if (!convActiva) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      lastTypingEmitRef.current = now;
      emitTyping(convActiva._id, '').catch(() => {});
    }
  };

  const iniciarGrabacion = async () => {
    if (grabandoVoz) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const AudioRes = await import('expo-av');
      const { Audio } = AudioRes;
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permiso denegado', 'Se necesita acceso al micrófono'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      grabacionRef.current = rec;
      setGrabandoVoz(true);
      setEstadoVoz('grabando');
      setTimeout(async () => {
        if (grabacionRef.current) await detenerYEnviar();
      }, 60000);
    } catch (e) {
      setGrabandoVoz(false);
      setEstadoVoz('idle');
      Alert.alert('Error', 'No se pudo grabar audio');
    }
  };

  const detenerYEnviar = async () => {
    try {
      const rec = grabacionRef.current;
      if (!rec) return;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      grabacionRef.current = null;
      setGrabandoVoz(false);
      setEstadoVoz('enviando');
      if (uri && convActiva) {
        await enviarMensajeVoz(convActiva._id, uri, prioridad);
        await cargarMensajes(convActiva._id);
      }
    } catch (_) { /* ignore */ }
    setEstadoVoz('idle');
  };

  const accionFila = async (conv, act) => {
    Haptics.selectionAsync();
    try {
      if (act === 'pin') await setPineado(conv._id, !conv.pineado);
      else if (act === 'mute') await setSilenciado(conv._id, !conv.silenciado);
      else if (act === 'archive') await setArchivado(conv._id, true);
      cargarInbox();
    } catch (_) {}
  };

  const conversacionesFiltradas = conversaciones.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (c.titulo || '').toLowerCase().includes(q) || (c.ultimoMensajePreview || '').toLowerCase().includes(q);
  });

  const secciones = [
    { title: 'Anuncios', data: conversacionesFiltradas.filter(c => c.tipo === 'anuncio') },
    { title: 'Grupos', data: conversacionesFiltradas.filter(c => c.tipo === 'grupo') },
    { title: 'Canales', data: conversacionesFiltradas.filter(c => c.tipo === 'canal') },
    { title: 'Directos', data: conversacionesFiltradas.filter(c => c.tipo === 'directo') },
  ].filter(s => s.data.length > 0);

  const renderConvItem = ({ item }) => {
    const prioColor = item.prioridadMinima >= 9 ? PRIO_COLORS.urgente : (item.prioridadMinima >= 7 ? PRIO_COLORS.alta : null);
    const badgeColor = prioColor || PRIO_COLORS.urgente;
    return (
      <TouchableOpacity
        onPress={() => abrirConversacion(item)}
        onLongPress={() => accionFila(item, 'pin')}
        style={[styles.convItem, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}
        activeOpacity={0.7}
      >
        {item.pineado && <View style={[styles.pinnedBar, { backgroundColor: PRIO_COLORS.alta }]} />}
        <View style={[styles.convAvatar, { backgroundColor: prioColor || colors.primary }]}>
          <Text style={[styles.convAvatarText, { color: colors.textWhite }]}>
            {(item.titulo || '?').replace('#', '').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <Text style={[styles.convTitulo, { color: colors.text }]} numberOfLines={1}>
              {item.tipo === 'anuncio' ? '📢 ' : (item.tipo === 'canal' ? '# ' : (item.tipo === 'grupo' ? '👥 ' : ''))}
              {item.titulo || 'Conversación'}
              {item.silenciado ? ' 🔕' : ''}
              {item.pineado ? ' 📌' : ''}
            </Text>
            {item.noLeidos > 0 && (
              <View style={[styles.badgeNoLeidos, { backgroundColor: badgeColor }]}>
                <Text style={styles.badgeText}>{item.noLeidos > 99 ? '99+' : item.noLeidos}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.convPreview, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.ultimoMensajePreview || 'Sin mensajes'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMensaje = ({ item }) => {
    const esMio = item._esMio;
    const prioColor = PRIO_COLORS[item.prioridadCodigo] || 'transparent';
    const prioChip = item.prioridad > 5 ? (
      <Text style={[styles.msgPrio, { color: prioColor, borderColor: prioColor }]}>
        {PRIO_LABELS[item.prioridadCodigo] || item.prioridadCodigo}
      </Text>
    ) : null;
    const estadoIcon = esMio ? (item.estado === 'leido' ? '✓✓' : (item.estado === 'entregado' ? '✓✓' : '✓')) : '';
    const estadoColor = esMio ? (item.estado === 'leido' ? '#4fc3f7' : colors.textMuted) : 'transparent';
    const bubbleBg = esMio ? colors.primary : colors.bubbleOther;
    const bubbleText = esMio ? colors.textWhite : colors.bubbleOtherText;
    const replyQuote = item.respuestaA ? (
      <Text style={[styles.replyQuote, { color: colors.textMuted, borderLeftColor: colors.primary }]}>
        ↩ {item.respuestaA?.texto?.slice(0, 60) || 'Mensaje'}
      </Text>
    ) : null;
    return (
      <View style={[styles.msgRow, esMio ? styles.msgRowMio : styles.msgRowOtro]}>
        <Text style={[styles.msgNombre, { color: colors.textMuted }]}>
          {esMio ? 'Yo' : item.remitenteId?.name || ''} {prioChip}
        </Text>
        {replyQuote}
        <TouchableOpacity
          onLongPress={() => setReplyTo(item)}
          style={[
            styles.msgBubble,
            { backgroundColor: bubbleBg },
            esMio ? styles.msgBubbleMio : styles.msgBubbleOtro,
          ]}
        >
          {item.tipoContenido === 'voz' ? (
            <View style={styles.msgVoz}>
              <Text style={styles.msgVozIcon}>🎤</Text>
              <Text style={[styles.msgVozText, { color: bubbleText }]}>
                Nota de voz {item.audio?.duracionMs ? `· ${Math.round(item.audio.duracionMs / 1000)}s` : ''}
              </Text>
            </View>
          ) : (
            <Text style={[styles.msgTexto, { color: bubbleText }]}>{item.texto}</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.msgEstado, { color: estadoColor }]}>
          {estadoIcon} {formatHora(item.createdAt)}
        </Text>
      </View>
    );
  };

  const formatHora = (d) => {
    try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  };

  if (!convActiva) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Chat</Text>
          <TouchableOpacity onPress={() => setModalGrupo(true)} style={styles.nuevoGrupoBtn}>
            <Text style={{ fontSize: 20 }}>👥</Text>
          </TouchableOpacity>
          {noLeidos > 0 && (
            <View style={[styles.badgeNoLeidos, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{noLeidos > 99 ? '99+' : noLeidos}</Text>
            </View>
          )}
        </View>
        <View style={styles.connectionRow}>
          <Text style={[styles.connectionText, { color: colors.textMuted }]}>
            {connected ? '🟢 En línea' : '🔴 Sin conexión'}
          </Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar persona, canal o mensaje…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
          />
        </View>
        <SectionList
          sections={secciones}
          keyExtractor={(i) => i._id}
          renderItem={renderConvItem}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.textSecondary, backgroundColor: colors.bg }]}>
              {section.title} ({section.data.length})
            </Text>
          )}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No hay conversaciones</Text>}
          onRefresh={cargarInbox}
          refreshing={cargando}
          stickySectionHeadersEnabled={false}
        />

        <Modal visible={modalGrupo} animationType="slide" transparent onRequestClose={() => setModalGrupo(false)}>
          <View style={grupoStyles.backdrop}>
            <View style={[grupoStyles.card, { backgroundColor: colors.surface }]}>
              <View style={grupoStyles.header}>
                <Text style={[grupoStyles.title, { color: colors.text }]}>👥 Nuevo grupo</Text>
                <TouchableOpacity onPress={() => setModalGrupo(false)}>
                  <Text style={{ fontSize: 26, color: colors.textMuted }}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={[grupoStyles.label, { color: colors.textSecondary }]}>Nombre del grupo</Text>
              <TextInput
                value={grupoNombre}
                onChangeText={setGrupoNombre}
                placeholder="Ej: Turno noche"
                placeholderTextColor={colors.textMuted}
                style={[grupoStyles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />

              <Text style={[grupoStyles.label, { color: colors.textSecondary }]}>Miembros ({grupoSeleccion.length})</Text>
              <FlatList
                data={usuariosLista}
                keyExtractor={(u) => u._id}
                renderItem={({ item }) => {
                  const sel = grupoSeleccion.includes(item._id);
                  return (
                    <TouchableOpacity
                      onPress={() => toggleMiembroGrupo(item._id)}
                      style={[grupoStyles.chipRow, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.inputBg : 'transparent' }]}
                    >
                      <Text style={{ color: sel ? colors.primary : colors.text, fontSize: 13 }}>
                        {sel ? '✓ ' : ''}{item.name} <Text style={{ color: colors.textMuted, fontSize: 11 }}>({item.rol})</Text>
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                style={{ maxHeight: 260 }}
                ListEmptyComponent={
                  cargandoUsuarios
                    ? <Text style={{ color: colors.textMuted, padding: 8 }}>Cargando…</Text>
                    : <Text style={{ color: colors.textMuted, padding: 8 }}>Sin personas disponibles</Text>
                }
              />

              <View style={grupoStyles.actions}>
                <TouchableOpacity onPress={() => setModalGrupo(false)} style={[grupoStyles.btnGhost, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={crearGrupoNuevo} style={[grupoStyles.btnPrimary, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.textWhite, fontWeight: '700' }}>Crear grupo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={volverALista} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {convActiva.tipo === 'anuncio' ? '📢 ' : (convActiva.tipo === 'canal' ? '# ' : '')}
          {convActiva.titulo || 'Conversación'}
        </Text>
      </View>
      <FlatList
        data={mensajes}
        keyExtractor={(i) => i._id}
        renderItem={renderMensaje}
        contentContainerStyle={styles.hilo}
        ListEmptyComponent={
          cargando
            ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            : <Text style={[styles.empty, { color: colors.textMuted }]}>Sin mensajes. ¡Inicia!</Text>
        }
        ListFooterComponent={
          typingShown
            ? <Text style={[styles.typingText, { color: colors.textMuted }]}>{typingShown} está escribiendo…</Text>
            : null
        }
      />
      {replyTo && (
        <View style={[styles.replyBar, { backgroundColor: colors.replyBar, borderTopColor: colors.border }]}>
          <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
            ↩ {replyTo.texto?.slice(0, 60) || 'Mensaje'}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={[styles.replyCancel, { color: colors.primary }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={grabandoVoz ? detenerYEnviar : iniciarGrabacion}
          style={[styles.micBtn, { backgroundColor: colors.inputBg }, grabandoVoz && styles.micBtnGrabando]}
          disabled={estadoVoz === 'enviando'}
        >
          <Text style={styles.micText}>
            {estadoVoz === 'enviando' ? '…' : (grabandoVoz ? '⏹' : '🎤')}
          </Text>
        </TouchableOpacity>
        <TextInput
          value={texto}
          onChangeText={onInputChange}
          placeholder={grabandoVoz ? 'Grabando… toca ⏹ para enviar' : 'Mensaje…'}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
          multiline
        />
        <TouchableOpacity onPress={handleEnviar} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.sendText, { color: colors.textWhite }]}>➤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { fontSize: 26 },
  title: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  nuevoGrupoBtn: { paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  connectionRow: { paddingVertical: 4, alignItems: 'center' },
  connectionText: { fontSize: 11 },
  searchRow: { paddingHorizontal: 12, paddingBottom: 8 },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, borderWidth: StyleSheet.hairlineWidth },
  lista: { padding: 10 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', paddingVertical: 6, paddingHorizontal: 4, marginTop: 8 },
  convItem: { flexDirection: 'row', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', position: 'relative', borderRadius: 8, marginBottom: 4 },
  pinnedBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  convAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  convAvatarText: { fontWeight: 'bold', fontSize: 18 },
  convContent: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convTitulo: { fontSize: 15, fontWeight: '600', flex: 1 },
  convPreview: { fontSize: 12, marginTop: 2 },
  badgeNoLeidos: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  empty: { textAlign: 'center', padding: 20, fontSize: 14 },
  hilo: { padding: 10, flexGrow: 1 },
  msgRow: { maxWidth: '80%', marginVertical: 4 },
  msgRowMio: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowOtro: { alignSelf: 'flex-start' },
  msgNombre: { fontSize: 10, marginBottom: 2 },
  msgPrio: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 4, borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginLeft: 4 },
  replyQuote: { fontSize: 11, borderLeftWidth: 2, paddingLeft: 6, marginBottom: 4 },
  msgBubble: { padding: 10, borderRadius: 16, minWidth: 60 },
  msgBubbleMio: { borderTopRightRadius: 4 },
  msgBubbleOtro: { borderTopLeftRadius: 4 },
  msgTexto: { fontSize: 15 },
  msgVoz: { flexDirection: 'row', alignItems: 'center' },
  msgVozIcon: { fontSize: 22, marginRight: 8 },
  msgVozText: { fontSize: 14, fontWeight: '500' },
  msgEstado: { fontSize: 9, marginTop: 2, textAlign: 'right' },
  typingText: { fontSize: 11, fontStyle: 'italic', paddingHorizontal: 10, paddingVertical: 4 },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1 },
  replyText: { flex: 1, fontSize: 12 },
  replyCancel: { fontSize: 16, paddingHorizontal: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, gap: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 80, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 18 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  micBtnGrabando: { backgroundColor: '#e74c3c' },
  micText: { fontSize: 18 },
});

const grupoStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, borderRadius: 14, padding: 16, maxHeight: '86%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: 'bold' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, fontWeight: '600' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  chipRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, marginBottom: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btnGhost: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  btnPrimary: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
});
