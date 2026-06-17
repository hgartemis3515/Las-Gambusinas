/**
 * Medidor de altura REAL del ticket 80mm usando un WebView oculto.
 *
 * Renderiza el HTML del boucher fuera de pantalla con el mismo ancho que el PDF
 * (viewport = BOUCHER_PDF_WIDTH_PX) y devuelve la altura exacta del contenido
 * (document.body.scrollHeight). Así el PDF se genera clavado al contenido y la
 * Epson TM-m30II no alimenta ni corta papel en blanco de más.
 *
 * Uso:
 *   const medidorRef = useRef(null);
 *   ...
 *   <MedidorAlturaBoucher ref={medidorRef} />
 *   ...
 *   const alturaPx = await medidorRef.current.medir(htmlCompleto); // null si falla
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BOUCHER_PDF_WIDTH_PX } from './boucherPrint';

// Script inyectado: mide la altura real del contenido (incluye padding del body)
// y la reporta. Espera a que carguen las imágenes (logo) antes de medir.
const SCRIPT_MEDICION = `
(function () {
  function alturaContenido() {
    var root = document.getElementById('ticket-root');
    if (root) {
      var kids = root.children;
      if (kids && kids.length > 0) {
        var last = kids[kids.length - 1];
        var bottom = last.offsetTop + last.offsetHeight;
        if (bottom > 0) return Math.ceil(bottom + 2);
      }
      return Math.ceil(Math.max(root.getBoundingClientRect().height, root.scrollHeight));
    }
    var page = document.getElementById('page');
    if (page) {
      return Math.ceil(Math.max(page.getBoundingClientRect().height, page.scrollHeight));
    }
    var b = document.body, d = document.documentElement;
    return Math.max(
      b.scrollHeight, b.offsetHeight,
      d.scrollHeight, d.offsetHeight
    );
  }
  function reportar() {
    try {
      window.ReactNativeWebView.postMessage(String(alturaContenido()));
    } catch (e) {}
  }
  function esperarImagenesYReportar() {
    var imgs = document.images || [];
    var pendientes = 0;
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].complete) {
        pendientes++;
        var fin = function () { if (--pendientes <= 0) setTimeout(reportar, 30); };
        imgs[i].addEventListener('load', fin);
        imgs[i].addEventListener('error', fin);
      }
    }
    if (pendientes === 0) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { setTimeout(reportar, 50); });
      });
    }
  }
  if (document.readyState === 'complete') {
    esperarImagenesYReportar();
  } else {
    window.addEventListener('load', esperarImagenesYReportar);
  }
})();
true;
`;

export const MedidorAlturaBoucher = forwardRef((props, ref) => {
  const [html, setHtml] = useState(null);
  const resolverRef = useRef(null);
  const timeoutRef = useRef(null);

  const finalizar = useCallback((valor) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setHtml(null);
    if (resolver) resolver(valor);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      /**
       * @param {string} htmlContenido HTML completo (ya envuelto con viewport 58mm)
       * @param {{ timeoutMs?: number }} [opts]
       * @returns {Promise<number|null>} altura en px (== puntos PDF) o null si falla/timeout
       */
      medir: (htmlContenido, { timeoutMs = 4000 } = {}) =>
        new Promise((resolve) => {
          // Si había una medición previa pendiente, la resolvemos como fallida.
          if (resolverRef.current) {
            const anterior = resolverRef.current;
            resolverRef.current = null;
            anterior(null);
          }
          resolverRef.current = resolve;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => finalizar(null), timeoutMs);
          setHtml(htmlContenido);
        }),
    }),
    [finalizar]
  );

  const onMessage = useCallback(
    (event) => {
      const valor = Number(event?.nativeEvent?.data);
      finalizar(Number.isFinite(valor) && valor > 0 ? Math.ceil(valor) : null);
    },
    [finalizar]
  );

  if (!html) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: BOUCHER_PDF_WIDTH_PX,
        height: 1200,
        opacity: 0,
        overflow: 'hidden',
      }}
      pointerEvents="none"
    >
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        injectedJavaScript={SCRIPT_MEDICION}
        onMessage={onMessage}
        scrollEnabled={false}
        javaScriptEnabled
        androidLayerType="software"
        // Ignora el tamaño de fuente del sistema (accesibilidad). Sin esto, si el
        // teléfono tiene la fuente agrandada, la altura medida sale mayor que lo
        // que renderiza expo-print y queda papel en blanco al final.
        textZoom={100}
        style={{ width: BOUCHER_PDF_WIDTH_PX, height: 1200, opacity: 0 }}
      />
    </View>
  );
});

MedidorAlturaBoucher.displayName = 'MedidorAlturaBoucher';
