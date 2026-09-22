/**
 * Mismo HTML que el ticket de la tabla de tickets y pagos adelantados
 * (appcocina ticketCocinaHtml.js). El celular lo maqueta con Arial y lo
 * manda a la Epson como imagen de 576 puntos (80 mm a 203 dpi).
 *
 * El XML <text> no puede igualarlo: TM Print Assistant solo tiene la
 * fuente interna de la impresora (celdas fijas, mucho más grandes).
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
const ANCHO_CSS = 226;
const ANCHO_PUNTOS = 576;
const ESCALA = ANCHO_PUNTOS / ANCHO_CSS;

const esc = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n) => Number(n || 0).toFixed(2);

function celdaMeta(label, value) {
  return `<td style="width:50%;padding:2px 3px;border:1px solid #000;vertical-align:top;">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.3px;">${esc(label)}</div>
    <div style="font-size:12px;font-weight:700;line-height:1.2;">${esc(value || '—')}</div>
  </td>`;
}

/** Cuerpo idéntico a generarHtmlTicketCocina. cocina=false quita el cuadrado. */
function htmlCuerpo(datos) {
  const d = datos || {};
  const cocina = !!d.cocina;
  const simbolo = d.simbolo || 'S/.';
  let filas = '';
  let bruto = 0;
  for (const p of d.platos || []) {
    const line = Number(p.line) || 0;
    bruto += line;
    const cuadro = cocina
      ? `<td style="width:18px;padding:3px 2px;vertical-align:middle;"><span style="display:inline-block;width:12px;height:12px;border:1.6px solid #000;box-sizing:border-box;"></span></td>`
      : '';
    filas += `<tr class="prod-item">${cuadro}
      <td style="padding:3px 2px;text-align:center;font-weight:700;width:22px;">${esc(p.cant)}</td>
      <td style="padding:3px 2px;">${esc(p.nombre)}</td>
      <td style="padding:3px 2px;text-align:right;white-space:nowrap;">${fmt(p.unit)}</td>
      <td style="padding:3px 2px;text-align:right;white-space:nowrap;font-weight:700;">${fmt(line)}</td>
    </tr>`;
  }
  const desc = Number(d.descuentoMonto) || 0;
  const neto = Math.max(0, bruto - desc);
  const thCuadro = cocina ? '<th style="width:18px;border-bottom:1px solid #000;"></th>' : '';
  let html = '';
  html += `<div style="text-align:center;font-size:22px;font-weight:800;letter-spacing:0.5px;line-height:1.15;padding:4px 0 6px;">${esc(d.letrero || '#—')}</div>`;
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
    <tr>${celdaMeta('Mozo', d.mozo)}${celdaMeta('Mesa', d.mesa)}</tr>
    <tr>${celdaMeta('Fecha', d.fecha)}${celdaMeta('Área', d.area)}</tr>
  </table>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:11px;">
    <thead><tr>
      ${thCuadro}
      <th style="text-align:center;border-bottom:1px solid #000;padding:2px;">Cant</th>
      <th style="text-align:left;border-bottom:1px solid #000;padding:2px;">Plato</th>
      <th style="text-align:right;border-bottom:1px solid #000;padding:2px;">P.Unit</th>
      <th style="text-align:right;border-bottom:1px solid #000;padding:2px;">Total</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
  if (desc > 0) {
    const mot = d.descuentoMotivo ? ` (${esc(d.descuentoMotivo)})` : '';
    html += `<div style="text-align:right;padding:4px 0 0;font-size:11px;">Descuento${mot}: -${esc(simbolo)}${fmt(desc)}</div>`;
  }
  html += `<div style="text-align:right;font-size:14px;font-weight:800;padding:4px 0 2px;border-top:1px solid #000;margin-top:4px;">TOTAL ${esc(simbolo)}${fmt(neto)}</div>`;
  return html;
}

const SCRIPT_RASTER = `
function enviar(msg) {
  var n = 0;
  (function tick() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(msg);
      return;
    }
    if (++n > 50) return;
    setTimeout(tick, 40);
  })();
}
function rasterizar() {
  try {
    var S = ${ESCALA};
    var sheet = document.getElementById('sheet');
    var root = sheet.getBoundingClientRect();
    var rawW = sheet.offsetWidth || ${ANCHO_CSS};
    var posScale = root.width / rawW;
    if (!isFinite(posScale) || posScale < 0.5) posScale = 1;
    var extra = S / posScale;
    var W = ${ANCHO_PUNTOS};
    var H = Math.max(8, Math.ceil((root.height * extra) / 8) * 8);
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.textBaseline = 'top';
    function fontEscalada(fontCss) {
      return String(fontCss || '11px Arial').replace(/([\\d.]+)px/g, function (_, n) {
        return (parseFloat(n) * S) + 'px';
      });
    }
    function paintText(node) {
      var full = node.nodeValue;
      if (!full || !/\\S/.test(full)) return;
      var parent = node.parentElement;
      if (!parent) return;
      var cs = getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      ctx.font = fontEscalada(cs.font);
      try {
        if ('letterSpacing' in ctx) {
          var ls = cs.letterSpacing;
          var n = (ls && ls !== 'normal') ? parseFloat(ls) : 0;
          ctx.letterSpacing = ((n || 0) * S) + 'px';
        }
      } catch (e) {}
      var start = 0;
      var guard = 0;
      while (start < full.length && guard++ < 400) {
        while (start < full.length && (full.charAt(start) === '\\n' || full.charAt(start) === '\\r')) start++;
        if (start >= full.length) break;
        var end = start + 1;
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        var rect = range.getBoundingClientRect();
        var top = rect.top;
        while (end < full.length) {
          range.setEnd(node, end + 1);
          var r2 = range.getBoundingClientRect();
          if (end > start && (Math.abs(r2.top - top) > 1.5 || r2.height > rect.height + 1)) break;
          end++;
          rect = range.getBoundingClientRect();
        }
        var slice = full.slice(start, end).replace(/\\s+/g, ' ');
        if (slice.trim()) {
          ctx.fillText(slice, (rect.left - root.left) * extra, (rect.top - root.top) * extra);
        }
        start = end;
      }
    }
    function edge(cs, which, x1, y1, x2, y2) {
      var bw = parseFloat(cs['border' + which + 'Width']);
      var st = cs['border' + which + 'Style'];
      if (!(bw > 0) || st === 'none' || st === 'hidden') return;
      ctx.lineWidth = Math.max(1, bw * S);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    function paintEl(el) {
      if (!el || el.nodeType !== 1) return;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var r = el.getBoundingClientRect();
      var x = (r.left - root.left) * extra;
      var y = (r.top - root.top) * extra;
      var w = r.width * extra;
      var h = r.height * extra;
      edge(cs, 'Top', x, y, x + w, y);
      edge(cs, 'Bottom', x, y + h, x + w, y + h);
      edge(cs, 'Left', x, y, x, y + h);
      edge(cs, 'Right', x + w, y, x + w, y + h);
      var kids = el.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.nodeType === 3) paintText(c);
        else if (c.nodeType === 1) paintEl(c);
      }
    }
    paintEl(sheet);
    var img = ctx.getImageData(0, 0, W, H);
    var rowBytes = W / 8;
    var bytes = new Uint8Array(rowBytes * H);
    var di = 0;
    for (var yy = 0; yy < H; yy++) {
      for (var xx = 0; xx < W; xx += 8) {
        var b = 0;
        for (var bit = 0; bit < 8; bit++) {
          var i = ((yy * W) + xx + bit) * 4;
          var lum = img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11;
          if (lum < 160) b |= (0x80 >> bit);
        }
        bytes[di++] = b;
      }
    }
    var bin = '';
    var CHUNK = 8192;
    for (var j = 0; j < bytes.length; j += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(j, j + CHUNK));
    }
    enviar(JSON.stringify({ ok: true, width: W, height: H, b64: btoa(bin) }));
  } catch (err) {
    enviar(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
  }
}
function arrancar() {
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(rasterizar, 30); });
  else setTimeout(rasterizar, 60);
}
arrancar();
`;

function htmlDocumento(datos) {
  const cuerpo = htmlCuerpo(datos);
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=640, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#000;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
  #sheet{
    width:${ANCHO_CSS}px;
    padding:4px;
    box-sizing:border-box;
    background:#fff;
    color:#000;
    font-family:Arial,Helvetica,sans-serif;
    font-size:11px;
    line-height:14px;
    transform:scale(${ESCALA});
    transform-origin:top left;
  }
  table{width:100%;}
</style></head><body><div id="sheet">${cuerpo}</div><script>${SCRIPT_RASTER}</script></body></html>`;
}

export function xmlImagenEpos({ width, height, b64 }) {
  return `<epos-print xmlns="${EPOS_NS}"><image width="${width}" height="${height}" color="color_1" mode="mono" align="center">${b64}</image><feed line="2"/><cut type="feed"/></epos-print>`;
}

export function xmlDosImagenesEpos(mozo, cocina) {
  return `<epos-print xmlns="${EPOS_NS}"><image width="${mozo.width}" height="${mozo.height}" color="color_1" mode="mono" align="center">${mozo.b64}</image><feed line="2"/><cut type="feed"/><image width="${cocina.width}" height="${cocina.height}" color="color_1" mode="mono" align="center">${cocina.b64}</image><feed line="2"/><cut type="feed"/></epos-print>`;
}

const RasterTicketCocina = forwardRef(function RasterTicketCocina(_props, ref) {
  const [html, setHtml] = useState(null);
  const [seq, setSeq] = useState(0);
  const pending = useRef(null);

  useImperativeHandle(ref, () => ({
    rasterizar(payload) {
      return new Promise((resolve, reject) => {
        if (pending.current?.t) clearTimeout(pending.current.t);
        const t = setTimeout(() => {
          pending.current = null;
          reject(new Error('timeout'));
        }, 12000);
        pending.current = { resolve, reject, t };
        setHtml(htmlDocumento(payload));
        setSeq((n) => n + 1);
      });
    },
  }));

  const onMessage = (event) => {
    const job = pending.current;
    if (!job) return;
    clearTimeout(job.t);
    pending.current = null;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data?.ok || !data.b64) job.reject(new Error(data?.error || 'raster'));
      else job.resolve(data);
    } catch (err) {
      job.reject(err);
    }
  };

  return (
    <View style={{ position: 'absolute', left: -4000, top: 0, width: 640, height: 1400 }} pointerEvents="none">
      {html ? (
        <WebView
          key={seq}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          javaScriptEnabled
          textZoom={100}
          scalesPageToFit={false}
          onError={() => {
            const job = pending.current;
            if (!job) return;
            clearTimeout(job.t);
            pending.current = null;
            job.reject(new Error('webview'));
          }}
        />
      ) : null}
    </View>
  );
});

export default RasterTicketCocina;
