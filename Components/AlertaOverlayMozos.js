import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useSocket } from '../context/SocketContext';
import { getAlertasActivas, ackAlerta } from '../services/alertaService';

/**
 * AlertaOverlayMozos
 *
 * Banner sticky superior para Alertas operativas. Se monta en el root navigator
 * (App.js) para que aparezca sin importar en qué screen esté el mozo.
 *
 * Comportamiento:
 *  - Escucha `alerta:nueva` y `alerta:cancelada` del socket /mozos.
 *  - Muestra un banner con color = estilo.colorHex.
 *  - Reproduce sonido (expo-av) si estilo.sonidoClave !== 'silencio'.
 *  - Auto-oculta tras estilo.duracionMs salvo que estilo.requiereAck.
 *  - Al montarse y al reconectar, recupera alertas activas vía API.
 */
export default function AlertaOverlayMozos() {
  const { socket } = useSocket() || {};
  const [alerta, setAlerta] = useState(null);
  const timeoutRef = useRef(null);
  const soundRef = useRef(null);
  const ackDoneRef = useRef(new Set());

  // Cargar sonidos bajo demanda
  const reproducirSonido = async (clave) => {
    if (!clave || clave === 'silencio') return;
    try {
      // Construir URL del catálogo en el backend
      const base = (apiConfigBase()).replace(/\/api$/, '');
      const url = `${base}/sounds/alertas/${clave}.mp3`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: clave === 'sirena' }
      );
      soundRef.current = sound;
    } catch (_) {
      // fallback: ignorar (no bloquear la alerta)
    }
  };

  const detenerSonido = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (_) { /* noop */ }
  };

  const cerrar = async (alertaId) => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    await detenerSonido();
    setAlerta((curr) => {
      if (!alertaId) return null;
      if (curr && (curr._id === alertaId || curr.alertaId === alertaId)) return null;
      return curr;
    });
  };

  const mostrar = async (nuevaAlerta) => {
    const id = nuevaAlerta._id || nuevaAlerta.alertaId;
    if (!id) return;
    ackDoneRef.current.delete(id);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await detenerSonido();
    setAlerta(nuevaAlerta);
    reproducirSonido(nuevaAlerta.estilo?.sonidoClave);

    const requiereAck = nuevaAlerta.estilo?.requiereAck;
    const duracionMs = nuevaAlerta.estilo?.duracionMs || 15000;
    if (!requiereAck) {
      timeoutRef.current = setTimeout(() => cerrar(id), duracionMs);
    }
  };

  const onDismiss = async () => {
    if (!alerta) return;
    const id = alerta._id || alerta.alertaId;
    if (id && !ackDoneRef.current.has(id)) {
      ackDoneRef.current.add(id);
      try { await ackAlerta(id); } catch (_) { /* silencioso */ }
      try { socket?.emit?.('alerta:ack', { alertaId: id }); } catch (_) { /* noop */ }
    }
    await cerrar(id);
  };

  // Listeners del socket
  useEffect(() => {
    if (!socket) return;

    const onNueva = (data) => { mostrar(data); };
    const onCancel = ({ alertaId }) => { cerrar(alertaId); };
    const onConnect = async () => {
      try {
        const resp = await getAlertasActivas();
        if (resp?.success && Array.isArray(resp.data) && resp.data.length) {
          const ahora = Date.now();
          const vigentes = resp.data.filter(a => new Date(a.expiraAt).getTime() > ahora);
          if (vigentes.length) mostrar(vigentes[0]);
        }
      } catch (_) { /* silencioso */ }
    };

    socket.on('alerta:nueva', onNueva);
    socket.on('alerta:cancelada', onCancel);
    if (socket.connected) onConnect();
    else socket.on('connect', onConnect);

    return () => {
      socket.off('alerta:nueva', onNueva);
      socket.off('alerta:cancelada', onCancel);
      socket.off('connect', onConnect);
    };
  }, [socket]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      detenerSonido();
    };
  }, []);

  if (!alerta) return null;

  const color = alerta.estilo?.colorHex || '#e74c3c';
  const id = alerta._id || alerta.alertaId;

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🚨</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>
          ALERTA {String(alerta.prioridadCodigo || 'urgente').toUpperCase()}
        </Text>
        <Text style={styles.text}>{alerta.texto}</Text>
        {alerta.creadoPorNombre ? (
          <Text style={styles.from}>De: {alerta.creadoPorNombre}</Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
        <Text style={styles.dismissText}>Entendido</Text>
      </TouchableOpacity>
    </View>
  );
}

function apiConfigBase() {
  // Lazy require para evitar ciclo si apiConfig depende de algo
  const cfg = require('../config/apiConfig').default || require('../config/apiConfig');
  return cfg.baseURL || (cfg.wsURL || '').replace(/^ws/, 'http') || 'http://localhost:3000';
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    paddingTop: Platform.OS === 'android' ? 24 : 38,
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  iconWrap: { marginRight: 4 },
  icon: { fontSize: 30, color: '#fff' },
  body: { flex: 1 },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
  from: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  dismissBtn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  dismissText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
