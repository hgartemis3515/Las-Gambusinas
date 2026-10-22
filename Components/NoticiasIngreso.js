import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const GOLD = '#d4af37';
const PUESTO_COLOR = { 1: GOLD, 2: '#c0c0c0', 3: '#cd7f32' };

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (vivo) setReduce(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(!!v));
    return () => { vivo = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

function haptic() {
  try { Haptics.selectionAsync(); } catch (_) {}
}

function htmlNoticias(noticias, nuevasIds = []) {
  const origin = origenServidor();
  const bloques = (noticias || []).map((n) => {
    const cuerpo = String(n.cuerpoHtml || '').replace(/src="\/uploads\//g, `src="${origin}/uploads/`);
    const titulo = String(n.titulo || '').replace(/[<>]/g, '');
    const nuevo = nuevasIds.includes(String(n._id)) ? '<span class="nuevo">Nuevo</span>' : '';
    const autor = n.autor?.nombre ? `<p class="autor">— ${String(n.autor.nombre).replace(/[<>]/g, '')}</p>` : '';
    return `<article><h2>${titulo}${nuevo}</h2>${cuerpo}${autor}</article>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; padding:12px 14px 24px; background:#141414; color:#f5f5f5; font-family: system-ui, sans-serif; font-size:32px; line-height:1.45; }
  article { margin-bottom:14px; background:#1f1f1f; border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px; opacity:0; transform: translateY(10px); animation: entra .38s ease-out forwards; }
  article:nth-child(2) { animation-delay: .07s } article:nth-child(3) { animation-delay: .14s } article:nth-child(n+4) { animation-delay: .2s }
  @keyframes entra { to { opacity:1; transform:none } }
  @media (prefers-reduced-motion: reduce) { article { animation:none; opacity:1; transform:none } }
  h2 { margin:0 0 8px; font-size:40px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  h3 { margin:0 0 6px; font-size:34px; }
  p { margin:0 0 8px; }
  ul, ol { padding-left: 22px; margin: 0 0 8px; }
  img { max-width:100%; height:auto; border-radius:10px; display:block; margin:8px 0; }
  .nuevo { font-size:10px; font-weight:800; text-transform:uppercase; background:${GOLD}; color:#1a1a1a; border-radius:6px; padding:2px 6px; letter-spacing:.04em; }
  .autor { color:#8a8a8a; font-size:12px; margin:8px 0 0; }
</style></head><body>${bloques}</body></html>`;
}

/** Hoja oscura con borde dorado. Entra desde abajo y sale hacia abajo. */
function Hoja({ titulo, subtitulo, children, onListo, listoLabel, reduce, icono = 'newspaper-variant-outline', ajustar = false }) {
  const t = reduce ? { type: 'timing', duration: 0 } : { type: 'spring', damping: 18, stiffness: 220, mass: 0.9 };
  return (
    <View style={styles.fondo} pointerEvents="box-none">
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: reduce ? 0 : 200 }}
        style={[StyleSheet.absoluteFill, styles.velo]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onListo} accessibilityLabel="Cerrar" />
      </MotiView>
      <MotiView
        from={{ opacity: 0, translateY: 48, scale: 0.96 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        exit={{ opacity: 0, translateY: 40, scale: 0.97 }}
        transition={t}
        exitTransition={{ type: 'timing', duration: reduce ? 0 : 180 }}
        style={[styles.hoja, ajustar && styles.hojaAjuste]}
      >
        <View style={styles.franja} />
        <View style={styles.cabecera}>
          <View style={styles.iconoWrap}>
            <MaterialCommunityIcons name={icono} size={22} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{titulo}</Text>
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
          </View>
        </View>
        <View style={ajustar ? styles.cuerpoAjuste : styles.cuerpo}>{children}</View>
        <TouchableOpacity
          style={styles.listo}
          onPress={() => { haptic(); onListo?.(); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={listoLabel || 'Listo'}
        >
          <Text style={styles.listoTxt}>{listoLabel || 'Listo'}</Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  );
}

function FilaTop({ p, index, reduce }) {
  const color = PUESTO_COLOR[p.puesto];
  return (
    <MotiView
      from={{ opacity: 0, translateX: -18 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: reduce ? 0 : 260, delay: reduce ? 0 : 120 + index * 45 }}
      style={[styles.item, p.puesto === 1 && styles.itemPrimero]}
    >
      <View style={[styles.puesto, color ? { backgroundColor: color } : styles.puestoResto]}>
        <Text style={[styles.puestoTxt, !color && { color: GOLD }]}>{p.puesto}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nombre} numberOfLines={1}>{p.nombre}</Text>
        <Text style={styles.meta}>{p.codigo ? `${p.codigo} · ` : ''}{p.cantidad} vendidos</Text>
      </View>
      {p.puesto <= 3 ? <MaterialCommunityIcons name={p.puesto === 1 ? 'crown' : 'medal'} size={20} color={color} /> : null}
    </MotiView>
  );
}

function ListaTop({ top, reduce }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {top.map((p, i) => <FilaTop key={String(p._id)} p={p} index={i} reduce={reduce} />)}
    </ScrollView>
  );
}

const MEDIR_ALTO = `(function(){
  function alto(){ return Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)); }
  function send(){ try { window.ReactNativeWebView.postMessage(String(alto())); } catch (e) {} }
  send();
  setTimeout(send, 80);
  setTimeout(send, 400);
  Array.prototype.forEach.call(document.images || [], function(img){
    if (img.complete) return;
    img.addEventListener('load', send);
    img.addEventListener('error', send);
  });
  true;
})();`;

function WebNoticias({ noticias, nuevasIds, reduce, ajustar = false }) {
  const { height: ventana } = useWindowDimensions();
  const tope = Math.round(ventana * 0.62);
  const hayFoto = (noticias || []).some((n) => /<img\b/i.test(n.cuerpoHtml || ''));
  const [alto, setAlto] = useState(ajustar ? (hayFoto ? tope : 72) : 0);
  const [listo, setListo] = useState(false);
  const altoVista = ajustar ? Math.min(tope, Math.max(hayFoto ? Math.round(tope * 0.72) : 72, alto)) : undefined;
  return (
    <View style={ajustar ? { height: altoVista } : { flex: 1, minHeight: 220 }}>
      {!listo ? <ActivityIndicator color={GOLD} style={StyleSheet.absoluteFill} /> : null}
      <MotiView animate={{ opacity: listo ? 1 : 0 }} transition={{ type: 'timing', duration: reduce ? 0 : 220 }} style={{ flex: 1 }}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlNoticias(noticias, nuevasIds), baseUrl: origenServidor() }}
          style={ajustar ? { height: altoVista, backgroundColor: '#141414' } : styles.web}
          scrollEnabled={!ajustar || hayFoto || alto > tope}
          mixedContentMode="always"
          injectedJavaScript={ajustar ? MEDIR_ALTO : undefined}
          onMessage={(e) => {
            const n = Number(e.nativeEvent.data);
            if (Number.isFinite(n) && n > 0) setAlto(n);
          }}
          onLoadEnd={() => setListo(true)}
        />
      </MotiView>
    </View>
  );
}

export function NoticiasManual({ visible, onClose }) {
  const reduce = useReduceMotion();
  const [top, setTop] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMontado(true);
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

  if (!montado) return null;
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <AnimatePresence onExitComplete={() => setMontado(false)}>
        {visible ? (
          <Hoja key="manual" titulo="Noticias" subtitulo="TOP de la semana y lo de hoy" onListo={onClose} listoLabel="Cerrar" reduce={reduce}>
            {cargando ? <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} /> : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.seccion}>TOP de la semana</Text>
                {top.length ? top.map((p, i) => <FilaTop key={String(p._id)} p={p} index={i} reduce={reduce} />) : <Text style={styles.vacio}>Sin platos esta semana.</Text>}
                <Text style={styles.seccion}>Hoy</Text>
                {noticias.length ? (
                  <View style={{ height: 300, borderRadius: 12, overflow: 'hidden' }}>
                    <WebNoticias noticias={noticias} nuevasIds={[]} reduce={reduce} />
                  </View>
                ) : <Text style={styles.vacio}>No hay publicación de hoy.</Text>}
              </ScrollView>
            )}
          </Hoja>
        ) : null}
      </AnimatePresence>
    </Modal>
  );
}

async function avisoParaEsteMozo(aviso) {
  if (!aviso) return true;
  const dest = aviso.destinos?.length ? aviso.destinos : ['mozos', 'cocina'];
  if (!dest.includes('mozos')) return false;
  if ((aviso.mozosAlcance || 'todos') !== 'algunos') return true;
  try {
    const raw = await AsyncStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    const id = String(user?._id || user?.id || '');
    return (aviso.mozoIds || []).map(String).includes(id);
  } catch (_) {
    return false;
  }
}

export default function NoticiasIngreso() {
  const { socket } = useSocket();
  const reduce = useReduceMotion();
  const [fase, setFase] = useState(null);
  const faseRef = useRef(null);
  const [montado, setMontado] = useState(false);
  const [top, setTop] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [nuevasIds, setNuevasIds] = useState([]);
  const [fecha, setFecha] = useState('');
  const [flash, setFlash] = useState(null);

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
      if (porSocket && faseRef.current === 'noticias' && !lista.length) setFase(null);
      const vistas = await idsNoticiasVistas(ymd);
      const nuevas = lista.filter((item) => !vistas.includes(String(item._id))).map((item) => String(item._id));
      setNuevasIds(nuevas);
      if (!porSocket && platos.length && !(await topYaVisto(ymd))) {
        setFase('top');
        return;
      }
      if (nuevas.length) setFase('noticias');
    } catch (_) {
      /* sin red: no se marca como visto */
    }
  }, []);

  useEffect(() => { faseRef.current = fase; if (fase) setMontado(true); }, [fase]);

  useEffect(() => { evaluar(false); }, [evaluar]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNueva = async (aviso) => {
      if (aviso?.accion === 'retirada') {
        await evaluar(true);
        return;
      }
      if (!(await avisoParaEsteMozo(aviso))) return;
      if (faseRef.current !== 'top') evaluar(true);
    };
    const onTemporal = async (aviso) => {
      if (!aviso?.titulo) return;
      if (!(await avisoParaEsteMozo(aviso))) return;
      setFlash(aviso);
    };
    socket.on('noticia-publicada', onNueva);
    socket.on('noticia-temporal', onTemporal);
    return () => {
      socket.off('noticia-publicada', onNueva);
      socket.off('noticia-temporal', onTemporal);
    };
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

  const hojaFlash = flash ? (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => setFlash(null)}>
      <Hoja titulo="Aviso" subtitulo="Solo esta vez. No queda guardado." onListo={() => setFlash(null)} reduce={reduce} ajustar>
        <WebNoticias noticias={[flash]} nuevasIds={[]} reduce={reduce} ajustar />
      </Hoja>
    </Modal>
  ) : null;

  if (!montado) return hojaFlash;

  return (
    <>
      {hojaFlash}
      <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={fase === 'top' ? cerrarTop : cerrarNoticias}>
        <AnimatePresence exitBeforeEnter onExitComplete={() => { if (!faseRef.current) setMontado(false); }}>
          {fase === 'top' ? (
            <Hoja key="top" titulo="TOP de la semana" subtitulo="Lo más pedido en los últimos 7 días" icono="trophy-outline" onListo={cerrarTop} reduce={reduce}>
              <ListaTop top={top} reduce={reduce} />
            </Hoja>
          ) : null}
          {fase === 'noticias' ? (
            <Hoja
              key="noticias"
              titulo="Noticias de hoy"
              subtitulo={nuevasIds.length ? `${nuevasIds.length} ${nuevasIds.length === 1 ? 'nueva' : 'nuevas'}` : ''}
              onListo={cerrarNoticias}
              reduce={reduce}
              ajustar
            >
              <WebNoticias noticias={noticias} nuevasIds={nuevasIds} reduce={reduce} ajustar />
            </Hoja>
          ) : null}
        </AnimatePresence>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  velo: { backgroundColor: 'rgba(0,0,0,0.72)' },
  hoja: {
    backgroundColor: '#1c1c1c',
    borderRadius: 18,
    height: '82%',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  hojaAjuste: { height: undefined, maxHeight: '88%' },
  cuerpoAjuste: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  franja: { height: 4, backgroundColor: GOLD, marginHorizontal: -16, marginBottom: 14 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconoWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  titulo: { color: '#f5f5f5', fontSize: 22, fontWeight: '800' },
  subtitulo: { color: '#bdbdbd', fontSize: 13, marginTop: 2 },
  cuerpo: { flex: 1, minHeight: 160 },
  listo: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listoTxt: { color: '#1a1a1a', fontSize: 18, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4 },
  itemPrimero: { backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  puesto: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  puestoResto: { backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  puestoTxt: { color: '#1a1a1a', fontWeight: '800', fontSize: 15 },
  nombre: { color: '#fff', fontSize: 16, fontWeight: '700' },
  meta: { color: '#bdbdbd', fontSize: 13, marginTop: 2 },
  seccion: { color: GOLD, fontWeight: '800', fontSize: 15, marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  vacio: { color: '#bdbdbd', fontSize: 15, marginBottom: 8 },
  web: { flex: 1, backgroundColor: '#141414', minHeight: 220 },
});
