/**
 * PDF nativo 80mm para Comanda (NO comprobante fiscal).
 *
 * Genera un ticket térmico usando pdf-lib, mismo patrón que boucherPdfNative.js
 * pero con contenido de COMANDA: sin RUC, IGV, serie/correlativo fiscal,
 * bloque promo/QR, URL SUNAT ni "Son: ... Soles".
 *
 * Incluye: Logo, nombre comercial, eslogan, título COMANDA, número de comanda,
 * fecha/hora, mesa, mozo, área, moneda, tipo de pago, detalle de platos
 * (con complementos, notas y marcador P.L.), total simple, cliente, DNI, observaciones.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import moment from 'moment-timezone';
import { PUNTOS_ANCHO } from './boucherPrint';
import { loadLogoBytes } from './logoPlantilla';
import { formatComandasNumbersLabel } from './comandaHtml';

const MARGIN_X = 6;
const CONTENT_W = PUNTOS_ANCHO - MARGIN_X * 2;
const PAD_Y = 8;
const SIZE_BODY = 10;
const SIZE_SM = 9;
const SIZE_TITLE = 14;
const SIZE_HEADER = 16;
const LH_BODY = 12;
const LH_TITLE = 15;
const LH_HEADER = 18;

const ETIQUETAS_DEFAULT_COMANDA = {
  comandaNumero: 'Comanda',
  fechaPedido: 'Fecha',
  mesa: 'Mesa',
  mozo: 'Mozo',
  area: 'Área',
  moneda: 'Moneda',
  tipoPago: 'Pago',
  total: 'TOTAL',
  cliente: 'Cliente',
  dni: 'DNI',
  observaciones: 'Obs',
};

const escapePdf = (str) => {
  if (!str) return '';
  return String(str).replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑ]/g, '?');
};

const obtenerEtiqueta = (key, plantilla, defaults) =>
  plantilla?.etiquetas?.[key] || defaults?.[key] || ETIQUETAS_DEFAULT_COMANDA[key] || key;

const wrapText = (font, text, maxWidth, fontSize) => {
  const raw = String(text ?? '').trim();
  if (!raw) return [''];
  const lines = [];
  let current = '';
  const pushWord = (word) => {
    if (!word) return;
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
      return;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      return;
    }
    let chunk = '';
    for (const ch of word) {
      const t = chunk + ch;
      if (font.widthOfTextAtSize(t, fontSize) <= maxWidth) chunk = t;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  };
  raw.split(/\s+/).forEach(pushWord);
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const uint8ToBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return globalThis.btoa(binary);
};

/**
 * Genera un PDF de Comanda térmica 80mm.
 *
 * @param {Object} opts
 * @param {Object} opts.datos - Datos mapeados de comanda (de mapComandaATicket o ticket-imprimible)
 * @param {Object} opts.plantilla - Plantilla de comanda (de GET /comanda-plantilla)
 * @param {string} opts.serverOrigin - URL base del servidor (para resolver logo)
 * @returns {Promise<string>} URI del PDF en cache
 */
export async function generarPdfComandaNativo(opts) {
  const { datos, plantilla, serverOrigin } = opts;
  const p = plantilla || {};
  const b = p.bloques || {};
  const v = p.visibilidad || {};
  const esp = p.espaciado || {};
  const mensajes = p.mensajes || {};

  const mostrarPrecios = b.mostrarPrecios !== false;

  const fontSize = esp.tamanoFuente || SIZE_BODY;
  const lineHeight = esp.lineHeight || LH_BODY;
  const dividerGap = esp.espacioDivider || 6;

  const simboloMoneda = datos.moneda === 'USD' ? '$' : 'S/.';

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ops = [];

  const addWrapped = (text, align = 'left', { bold = false, size = fontSize } = {}) => {
    const f = bold ? fontBold : font;
    wrapText(f, String(text ?? ''), CONTENT_W, size).forEach((line) => {
      ops.push({ type: 'text', text: line, align, bold, size });
    });
  };
  const addGap = (h = 4) => ops.push({ type: 'gap', h });
  const addRule = () => ops.push({ type: 'rule' });
  const addPad = (left, right, { bold = false, size = fontSize } = {}) => {
    ops.push({ type: 'pad', left: String(left), right: String(right), size, bold });
  };
  const addLabel = (label, value) => {
    ops.push({ type: 'label', label: `${label}:`, value: String(value ?? '') });
  };

  // === ENCABEZADO ===
  if (b.mostrarEncabezado !== false) {
    if (p.logo) {
      try {
        const { bytes, isPng } = await loadLogoBytes(p.logo);
        const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const dims = embedded.scale(0.35);
        const imgH = Math.min(dims.height, 56);
        ops.push({ type: 'image', image: embedded, width: Math.min(dims.width, CONTENT_W), height: imgH });
        addGap(4);
      } catch (err) {
        if (__DEV__) console.warn('[COMANDA] Logo no embebido en PDF:', err?.message);
      }
    }
    if (v.nombre !== false) {
      addWrapped(p.restaurante?.nombre || 'LAS GAMBUSINAS', 'center', { bold: true, size: SIZE_HEADER });
    }
    if (v.eslogan && p.restaurante?.eslogan) {
      addWrapped(p.restaurante.eslogan, 'center', { size: SIZE_SM });
    }
    // Título COMANDA
    addGap(2);
    addWrapped(p.encabezado?.titulo || 'COMANDA', 'center', { bold: true, size: SIZE_TITLE });
    addRule();

    // Número de comanda centrado (soporta agrupación #81+#82)
    const numeroDisplay = datos.comandaNumeroDisplay
      || formatComandasNumbersLabel(datos.comandasNumbers)
      || (datos.comandaNumero != null ? `#${datos.comandaNumero}` : '');
    if (numeroDisplay) {
      addWrapped(numeroDisplay, 'center', { bold: true, size: SIZE_BODY });
    }
  }

  // === DATOS COMANDA ===
  if (b.mostrarDatosComanda !== false) {
    if (v.fechaPedido !== false && datos.fechaPedido) {
      try {
        const f = new Date(datos.fechaPedido);
        addLabel(obtenerEtiqueta('fechaPedido', p), f.toLocaleDateString('es-PE') + ' ' + f.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        addLabel(obtenerEtiqueta('fechaPedido', p), String(datos.fechaPedido));
      }
    }
    if (v.mesa !== false && datos.mesa) addLabel(obtenerEtiqueta('mesa', p), String(datos.mesa));
    if (v.mozo !== false && datos.mozo) addLabel(obtenerEtiqueta('mozo', p), String(datos.mozo));
    if (v.area && datos.area) addLabel(obtenerEtiqueta('area', p), String(datos.area));
    if (v.moneda !== false && datos.moneda) addLabel(obtenerEtiqueta('moneda', p), String(datos.moneda));
    if (v.tipoPago !== false && datos.tipoPago) addLabel(obtenerEtiqueta('tipoPago', p), String(datos.tipoPago));
    addRule();
  }

  // === DETALLE PRODUCTOS ===
  if (b.mostrarDetalleProductos !== false && datos.productos?.length) {
    addPad('Producto', mostrarPrecios ? 'Cant  Total' : 'Cant', { bold: true, size: SIZE_SM });
    addGap(2);

    for (const prod of datos.productos) {
      const nombre = prod.nombre || 'Plato';
      const marcadorPL = prod.paraLlevar ? ' (P.L.)' : '';
      addWrapped(`${nombre}${marcadorPL}`, 'left', { size: SIZE_BODY });
      const cant = prod.cantidad || 1;
      const subtotal = prod.subtotal || (prod.precio || 0) * cant;
      if (mostrarPrecios) {
        addPad(`  x${cant}`, `${simboloMoneda} ${subtotal.toFixed(2)}`, { size: SIZE_SM });
      } else {
        addPad(`  x${cant}`, '', { size: SIZE_SM });
      }
      // Complementos
      if (prod.complementos?.length) {
        for (const c of prod.complementos) {
          const compStr = `${c.grupo ? c.grupo + ': ' : ''}${c.opcion || ''}`;
          addWrapped(`  └ ${compStr}`, 'left', { size: SIZE_SM });
        }
      }
      // Nota especial
      if (prod.notaEspecial) {
        addWrapped(`  Nota: ${prod.notaEspecial}`, 'left', { size: SIZE_SM });
      }
    }
    addRule();
  }

  // === TOTAL ===
  if (b.mostrarTotal !== false) {
    addPad(obtenerEtiqueta('total', p) + ':', `${simboloMoneda} ${(datos.total || 0).toFixed(2)}`, { bold: true, size: SIZE_TITLE });
    addRule();
  }

  // === DATOS CLIENTE ===
  if (b.mostrarDatosCliente !== false) {
    const cn = datos.cliente?.nombre || '';
    const cd = datos.cliente?.dni || '';
    if (cn || cd) {
      if (v.cliente !== false && cn) addLabel(obtenerEtiqueta('cliente', p), cn);
      if (v.dniCliente !== false && cd) addLabel(obtenerEtiqueta('dni', p), cd);
    }
  }

  // === OBSERVACIONES ===
  if (b.mostrarObservaciones !== false && datos.observaciones) {
    addWrapped(`Obs: ${datos.observaciones}`, 'left', { size: SIZE_SM });
  }

  // === PIE ===
  if (mensajes.pie) {
    addGap(4);
    addWrapped(mensajes.pie, 'center', { size: SIZE_SM });
  }

  // === RENDER PDF ===
  const heightOf = (op) => {
    if (op.type === 'gap') return op.h;
    if (op.type === 'rule') return 8;
    if (op.type === 'image') return op.height + 4;
    if (op.type === 'text' || op.type === 'pad' || op.type === 'label') {
      if (op.type === 'label') {
        const labelW = CONTENT_W * 0.38;
        return wrapText(font, op.value, CONTENT_W - labelW - 4, SIZE_BODY).length * LH_BODY;
      }
      const size = op.size || SIZE_BODY;
      if (size >= SIZE_HEADER) return LH_HEADER;
      if (size >= SIZE_TITLE) return LH_TITLE;
      return LH_BODY;
    }
    return LH_BODY;
  };

  const pageHeight = PAD_Y * 2 + ops.reduce((sum, op) => sum + heightOf(op), 0);
  const page = pdfDoc.addPage([PUNTOS_ANCHO, Math.ceil(pageHeight)]);
  let y = page.getHeight() - PAD_Y;

  const drawTextLine = (text, x, size, bold) => {
    const f = bold ? fontBold : font;
    page.drawText(text, { x, y: y - size, size, font: f, color: rgb(0, 0, 0) });
    y -= size >= SIZE_TITLE ? LH_TITLE : LH_BODY;
  };

  ops.forEach((op) => {
    if (op.type === 'gap') { y -= op.h; return; }
    if (op.type === 'rule') {
      y -= 4;
      page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PUNTOS_ANCHO - MARGIN_X, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3), dashArray: [2, 2] });
      y -= 4;
      return;
    }
    if (op.type === 'image') {
      const imgW = op.width;
      const imgH = op.height;
      y -= imgH;
      page.drawImage(op.image, { x: MARGIN_X + (CONTENT_W - imgW) / 2, y, width: imgW, height: imgH });
      y -= 4;
      return;
    }
    if (op.type === 'text') {
      const f = op.bold ? fontBold : font;
      const size = op.size || SIZE_BODY;
      const textW = f.widthOfTextAtSize(op.text, size);
      let x = MARGIN_X;
      if (op.align === 'center') x = MARGIN_X + (CONTENT_W - textW) / 2;
      if (op.align === 'right') x = PUNTOS_ANCHO - MARGIN_X - textW;
      drawTextLine(op.text, x, size, op.bold);
      return;
    }
    if (op.type === 'pad') {
      const f = op.bold ? fontBold : font;
      const size = op.size || SIZE_BODY;
      const rw = f.widthOfTextAtSize(op.right, size);
      page.drawText(op.left, { x: MARGIN_X, y: y - size, size, font: f, color: rgb(0, 0, 0) });
      if (op.right) {
        page.drawText(op.right, { x: PUNTOS_ANCHO - MARGIN_X - rw, y: y - size, size, font: f, color: rgb(0, 0, 0) });
      }
      y -= size >= SIZE_TITLE ? LH_TITLE : LH_BODY;
      return;
    }
    if (op.type === 'label') {
      const labelW = CONTENT_W * 0.38;
      const lines = wrapText(font, op.value, CONTENT_W - labelW - 4, SIZE_BODY);
      lines.forEach((line, idx) => {
        if (idx === 0) {
          page.drawText(op.label, { x: MARGIN_X, y: y - SIZE_BODY, size: SIZE_BODY, font: fontBold, color: rgb(0, 0, 0) });
        }
        page.drawText(line, { x: MARGIN_X + labelW, y: y - SIZE_BODY, size: SIZE_BODY, font, color: rgb(0, 0, 0) });
        y -= LH_BODY;
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  const outUri = `${FileSystem.cacheDirectory}comanda_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, uint8ToBase64(pdfBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}