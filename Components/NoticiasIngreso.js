import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSocket } from '../context/SocketContext';
import {
  cargarNoticiasHoy,
  cargarTopSemana,
  idsNoticiasVistas,
  marcarNoticiasVistas,
  marcarTopVisto,
  origenServidor,
  topYaVisto,
} from '../helpers/noticiasDia';

function htmlNoticias(noticias) {
  const origin = origenServidor();
  const bloques = (noticias || []).map((n) => {
    const cuerpo = String(n.cuerpoHtml || '').replace(/src="\/uploads\//g, `src="${origin}/uploads/`);
    const titulo = String(n.titulo || '').replace(/[<>]/g, '');
    return `<article><h2>${titulo}</h2>${cuerpo}</article>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; padding:12px 14px 24px; background:#141414; color:#f5f5f5; font-family: system-ui, sans-serif; font-size:16px; }
  h2 { margin:0 0 8px; font-size:20px; }
  article { margin-bottom:18px; }
  img { max-width:100%; height:auto; border-radius:8px; }
</style></head><body>${bloques}</body></html>`;
}

function Hoja({ titulo, children, onListo, listoLabel }) {
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onListo}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          <Text style={styles.titulo}>{titulo}</Text>
          <View style={styles.cuerpo}>{children}</View>
          <TouchableOpacity style={styles.listo} onPress={onListo} accessibilityRole="button" accessibilityLabel={listoLabel || 'Listo'}>
            <Text style={styles.listoTxt}>{listoLabel || 'Listo'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function NoticiasManual({ visible, onClose }) {
  const [top, setTop] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancel = false;
    setCargando(true);
    Promise.all([
      cargarTopSemana(true).catch(() => ({ platos: [] })),
      cargarNoticiasHoy().catch(() => ({ noticias: [] })),
    ]).then(([t, n]) => {
      if (cancel) return;
      setTop(t.platos || []);
      setNoticias(n.noticias || []);
      setCargando(false);
    });
    return () => { cancel = true; };
  }, [visible]);

  if (!visible) return null;
  return (
    <Hoja titulo="Noticias" onListo={onClose} listoLabel="Cerrar">
      {cargando ? <ActivityIndicator color="#d4af37" /> : (
        <ScrollView>
          <Text style={styles.seccion}>TOP de la semana</Text>
          {top.length ? top.map((p) => (
            <Text key={String(p._id)} style={styles.fila}>
              {p.puesto}. {p.nombre}{p.codigo ? ` · ${p.codigo}` : ''} · {p.cantidad}
            </Text>
          )) : <Text style={styles.vacio}>Sin platos esta semana.</Text>}
          <Text style={styles.seccion}>Hoy</Text>
          {noticias.length ? (
            <View style={{ height: 280 }}>
              <WebView originWhitelist={['*']} source={{ html: htmlNoticias(noticias), baseUrl: origenServidor() }} style={styles.web} />
            </View>
          ) : <Text style={styles.vacio}>No hay publicación de hoy.</Text>}
        </ScrollView>
      )}
    </Hoja>
  );
}

export default function NoticiasIngreso() {
  const { socket } = useSocket();
  const [fase, setFase] = useState(null);
  const faseRef = React.useRef(null);
  const [top, setTop] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [fecha, setFecha] = useState('');

  const evaluar = useCallback(async (porSocket = false) => {
    try {
      const [t, n] = await Promise.all([
        cargarTopSemana(porSocket).catch(() => null),
        cargarNoticiasHoy().catch(() => null),
      ]);
      if (!t && !n) return;
      const ymd = n?.fechaOperativa || t?.fechaOperativa || '';
      const platos = t?.platos || [];
      const lista = n?.noticias || [];
      setFecha(ymd);
      setTop(platos);
      setNoticias(lista);
      const vistas = await idsNoticiasVistas(ymd);
      const hayNuevas = lista.some((item) => !vistas.includes(String(item._id)));
      if (!porSocket && platos.length && !(await topYaVisto(ymd))) {
        setFase('top');
        return;
      }
      if (hayNuevas) setFase('noticias');
    } catch (_) {
      /* sin red: no se marca como visto */
    }
  }, []);

  useEffect(() => { faseRef.current = fase; }, [fase]);

  useEffect(() => { evaluar(false); }, [evaluar]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNueva = () => { if (faseRef.current !== 'top') evaluar(true); };
    socket.on('noticia-publicada', onNueva);
    return () => socket.off('noticia-publicada', onNueva);
  }, [socket, evaluar]);

  const cerrarTop = async () => {
    if (fecha && top.length) await marcarTopVisto(fecha);
    const vistas = await idsNoticiasVistas(fecha);
    const hayNuevas = noticias.some((item) => !vistas.includes(String(item._id)));
    setFase(hayNuevas ? 'noticias' : null);
  };

  const cerrarNoticias = async () => {
    if (fecha && noticias.length) {
      await marcarNoticiasVistas(fecha, noticias.map((n) => n._id));
    }
    setFase(null);
  };

  if (fase === 'top') {
    return (
      <Hoja titulo="TOP de la semana" onListo={cerrarTop}>
        <ScrollView>
          {top.map((p) => (
            <View key={String(p._id)} style={styles.item}>
              <Text style={styles.puesto}>{p.puesto}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{p.nombre}</Text>
                <Text style={styles.meta}>{p.codigo ? `${p.codigo} · ` : ''}{p.cantidad} vendidos</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Hoja>
    );
  }

  if (fase === 'noticias') {
    return (
      <Hoja titulo="Noticias de hoy" onListo={cerrarNoticias}>
        <WebView originWhitelist={['*']} source={{ html: htmlNoticias(noticias), baseUrl: origenServidor() }} style={styles.web} />
      </Hoja>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 16,
  },
  hoja: {
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    height: '82%',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  titulo: {
    color: '#f5f5f5',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  cuerpo: { flex: 1, minHeight: 160 },
  listo: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: '#d4af37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listoTxt: { color: '#1a1a1a', fontSize: 18, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  puesto: { color: '#1a1a1a', backgroundColor: '#d4af37', fontWeight: '800', fontSize: 16, width: 32, height: 32, textAlign: 'center', lineHeight: 32, borderRadius: 8, overflow: 'hidden' },
  nombre: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#bdbdbd', fontSize: 14, marginTop: 2 },
  seccion: { color: '#d4af37', fontWeight: '800', fontSize: 16, marginTop: 8, marginBottom: 6 },
  fila: { color: '#fff', fontSize: 16, paddingVertical: 6 },
  vacio: { color: '#bdbdbd', fontSize: 15, marginBottom: 8 },
  web: { flex: 1, backgroundColor: '#141414', minHeight: 220 },
});
