/**
 * PDF nativo 80 mm con pdf-lib (sin expo-print / WebView).
 * Evita márgenes blancos en Samsung y otros Android.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import moment from 'moment-timezone';
import { PUNTOS_ANCHO } from './boucherPrint';
import { loadLogoBytes } from './logoPlantilla';

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

const censurar = (valor, visible) => {
  if (visible) return String(valor ?? '');
  return 'X'.repeat(Math.min(String(valor ?? '').length, 10));
};

const numeroALetras = (num) => {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = [
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
    'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  ];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
  ];
  if (num === 0) return 'CERO';
  const entero = Math.floor(num);
  const decimal = Math.round((num - entero) * 100);
  const convertir = (n) => {
    if (n < 10) return unidades[n];
    if (n < 20) return especiales[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 2 && u > 0) return 'VEINTI' + unidades[u].toLowerCase();
      return decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '');
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      if (n === 100) return 'CIEN';
      return centenas[c] + (r > 0 ? ' ' + convertir(r) : '');
    }
    if (n < 1000000) {
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      const miles = m === 1 ? 'MIL' : convertir(m) + ' MIL';
      return miles + (r > 0 ? ' ' + convertir(r) : '');
    }
    return String(n);
  };
  return convertir(entero) + ' Y ' + decimal.toString().padStart(2, '0') + '/100 Soles';
};

const obtenerEtiqueta = (key, plantilla, defaults) =>
  plantilla?.etiquetas?.[key] || defaults?.[key] || key;

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
 * @returns {Promise<string>} URI del PDF en cache
 */
export async function generarPdfBoucherNativo(opts) {
  const {
    boucher = null,
    comandas = [],
    mesa = null,
    plantilla,
    configMoneda = null,
    clienteSeleccionado = null,
    subtotalOriginal = 0,
    total = 0,
    etiquetasDefault = {},
  } = opts;

  const p = plantilla;
  const b = p.bloques || {};
  const v = p.visibilidad || {};
  const usarBoucherBackend = boucher?.platos?.length > 0;

  const simboloMoneda =
    boucher?.configuracionIGV?.simboloMoneda || configMoneda?.simboloMoneda || 'S/.';
  const nombreImpuesto =
    boucher?.configuracionIGV?.nombreImpuesto || configMoneda?.nombreImpuestoPrincipal || 'IGV';
  const igvPorcentaje =
    boucher?.configuracionIGV?.igvPorcentaje || configMoneda?.igvPorcentaje || 18;

  // 🔥 Símbolo de moneda según la moneda de cobro del boucher (PEN/USD)
  const monedaCobro = boucher?.moneda || 'PEN';
  const simboloMonedaCobro = monedaCobro === 'USD' ? '$' : simboloMoneda;
  // 🔥 Etiqueta de método de pago + moneda
  const metodoPagoLabelBoucher = (() => {
    const label = boucher?.metodoPagoLabel || (
      boucher?.metodoPago === 'efectivo' ? 'Efectivo'
      : boucher?.metodoPago === 'digital' ? 'YAPE/PLIN'
      : boucher?.metodoPago === 'tarjeta' ? 'CRÉDITO/DÉBITO'
      : 'Efectivo'
    );
    return `${label} (${monedaCobro})`;
  })();

  const primeraComanda = usarBoucherBackend ? null : comandas[0];
  const fechaPedido = usarBoucherBackend
    ? moment(boucher.fechaPedido || boucher.createdAt).tz('America/Lima')
    : moment(primeraComanda?.createdAt || primeraComanda?.fecha).tz('America/Lima');
  const fechaPago = usarBoucherBackend
    ? moment(boucher.fechaPago || boucher.createdAt).tz('America/Lima')
    : moment().tz('America/Lima');

  const voucherId = boucher?.voucherId || 'N/A';
  const boucherNumber = boucher?.boucherNumber || 'N/A';
  const numMesa =
    mesa?.nombreCombinado || boucher?.numMesa || mesa?.nummesa || comandas[0]?.mesas?.nummesa || 'N/A';
  const nombreMozo = boucher?.nombreMozo || comandas[0]?.mozos?.name || 'N/A';
  const nombreCliente =
    boucher?.cliente?.nombre || clienteSeleccionado?.nombre || 'CLIENTE GENERAL';
  const dniCliente = boucher?.cliente?.dni || clienteSeleccionado?.dni || '00000000';
  const observaciones =
    boucher?.observaciones ||
    comandas
      .filter((c) => c.observaciones)
      .map((c) => `C#${c.comandaNumber || c._id?.slice?.(-6)}: ${c.observaciones}`)
      .join('. ') ||
    '';

  const descuentosComandas = usarBoucherBackend
    ? boucher.descuentos || []
    : comandas
        .filter((c) => c.descuento > 0)
        .map((c) => ({
          comandaNumber: c.comandaNumber,
          porcentaje: c.descuento,
          motivo: c.motivoDescuento,
          monto: c.montoDescuento || 0,
        }));

  const montoTotalDescuento = usarBoucherBackend
    ? boucher.montoDescuento || 0
    : comandas.reduce((sum, c) => sum + (c.montoDescuento || 0), 0);

  const subtotalFinal = boucher?.subtotal || subtotalOriginal || total;
  const igvFinal = boucher?.igv ?? subtotalFinal * (igvPorcentaje / 100);
  const tieneDescuentoBoucher =
    (boucher?.montoDescuento || 0) > 0 || (boucher?.descuentos?.length || 0) > 0;
  const totalFinal =
    tieneDescuentoBoucher && boucher?.totalConDescuento != null
      ? boucher.totalConDescuento
      : boucher?.total != null
        ? boucher.total
        : Math.max(0, subtotalFinal + igvFinal - montoTotalDescuento);

  const formatFecha = (f) => f.format('DD/MM/YYYY HH:mm:ss');
  const et = (key) => obtenerEtiqueta(key, p, etiquetasDefault);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  /** @type {Array<{ type: string, [key: string]: any }>} */
  const ops = [];

  const addWrapped = (text, align = 'left', { bold = false, size = SIZE_BODY } = {}) => {
    const f = bold ? fontBold : font;
    wrapText(f, text, CONTENT_W, size).forEach((line) => {
      ops.push({ type: 'text', text: line, align, bold, size });
    });
  };

  const addGap = (h = 4) => ops.push({ type: 'gap', h });
  const addRule = () => ops.push({ type: 'rule' });
  const addPad = (left, right, { size = SIZE_BODY, bold = false } = {}) => {
    ops.push({ type: 'pad', left: String(left), right: String(right), size, bold });
  };
  const addLabel = (label, value) => {
    const lbl = `${label}:`;
    ops.push({ type: 'label', label: lbl, value: String(value) });
  };

  if (b.mostrarEncabezado) {
    if (p.logo) {
      try {
        const { bytes, isPng } = await loadLogoBytes(p.logo);
        const embedded = isPng
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const dims = embedded.scale(0.35);
        const imgH = Math.min(dims.height, 56);
        ops.unshift({
          type: 'image',
          image: embedded,
          width: Math.min(dims.width, CONTENT_W),
          height: imgH,
        });
        addGap(4);
      } catch (err) {
        if (__DEV__) console.warn('[BOUCHER] Logo no embebido en PDF:', err?.message);
      }
    }
    addWrapped(censurar(p.restaurante?.nombre, v.nombre), 'center', { bold: true, size: SIZE_HEADER });
    addWrapped(censurar(p.restaurante?.eslogan, v.eslogan), 'center', { size: SIZE_BODY });
    addWrapped(`R.U.C.: ${censurar(p.restaurante?.ruc, v.ruc)}`, 'center', { bold: true, size: SIZE_BODY });
    addWrapped(censurar(p.restaurante?.direccion, v.direccion), 'center', { size: SIZE_BODY });
    addWrapped(`Tel: ${censurar(p.restaurante?.telefono, v.telefono)}`, 'center', { size: SIZE_BODY });
    addGap(4);
    addRule();
    addWrapped(p.encabezado?.tipoComprobante || 'BOLETA DE VENTA', 'center', { bold: true, size: SIZE_TITLE });
    addWrapped(
      `${p.encabezado?.serie || 'B001'}-${String(boucherNumber).padStart(6, '0')}`,
      'center',
      { bold: true, size: SIZE_BODY }
    );
    addRule();
  }

  if (b.mostrarDatosPedido) {
    addLabel(et('voucherId'), `${censurar(voucherId, v.voucherId)}-${censurar(boucherNumber, v.numeroVoucher)}`);
    addLabel(et('fechaPedido'), censurar(formatFecha(fechaPedido), v.fechaPedido));
    addLabel(et('fechaPago'), censurar(formatFecha(fechaPago), v.fechaPago));
    addLabel(et('mesero'), censurar(nombreMozo, v.mesero));
    addLabel('Moneda', 'Soles');
    addLabel(et('mesa'), censurar(String(numMesa), v.mesa));
    if (observaciones) addLabel(et('observaciones'), censurar(observaciones, v.observacion));
    addRule();
  }

  if (b.mostrarDetalleProductos) {
    addPad('Producto', 'Cant  P.Unit  Total', { bold: true, size: SIZE_SM });
    addGap(2);

    const agregarPlato = (nombre, cantidad, precio, subtotalPlato, complementos = []) => {
      addWrapped(nombre, 'left', { size: SIZE_BODY });
      addPad(
        `  x${cantidad}`,
        `${simboloMoneda} ${precio.toFixed(2)}  ${simboloMoneda} ${subtotalPlato.toFixed(2)}`,
        { size: SIZE_SM }
      );
      complementos.forEach((comp) => {
        const opcionStr = Array.isArray(comp.opcion)
          ? comp.opcion.join(', ')
          : comp.opcion || comp.nombre || '';
        const extra = comp.precio > 0 ? ` (+${comp.precio.toFixed(2)})` : '';
        addWrapped(`  └ ${opcionStr}${extra}`, 'left', { size: SIZE_SM });
      });
    };

    if (usarBoucherBackend) {
      boucher.platos.forEach((platoItem) => {
        const cantidad = platoItem.cantidad || 1;
        const precio = platoItem.precio || 0;
        const subtotalPlato = platoItem.subtotal || precio * cantidad;
        agregarPlato(
          platoItem.nombre || 'Plato',
          cantidad,
          precio,
          subtotalPlato,
          platoItem.complementosSeleccionados || []
        );
      });
    } else {
      comandas.forEach((comanda) => {
        (comanda.platos || []).forEach((platoItem, index) => {
          const plato = platoItem.plato || platoItem;
          const cantidad = comanda.cantidades?.[index] || 1;
          const precio = plato.precio || 0;
          agregarPlato(
            plato.nombre || 'Plato',
            cantidad,
            precio,
            precio * cantidad,
            platoItem.complementosSeleccionados || []
          );
        });
      });
    }
    addRule();
  }

  if (b.mostrarTotales && v.totales !== false) {
    addPad('Subtotal:', `${simboloMoneda} ${subtotalFinal.toFixed(2)}`);
    if (p.campos?.mostrarIGV) {
      addPad(`${nombreImpuesto} (${igvPorcentaje}%):`, `${simboloMoneda} ${igvFinal.toFixed(2)}`);
    }
    if (descuentosComandas.length > 0) {
      addPad('Descuento:', `-${simboloMoneda} ${montoTotalDescuento.toFixed(2)}`);
    }
    addPad(`${et('total')}:`, `${simboloMoneda} ${totalFinal.toFixed(2)}`, { bold: true, size: SIZE_TITLE });
    addWrapped(`Son: ${numeroALetras(totalFinal)}`, 'left', { size: SIZE_SM });
  }

  addLabel('Pago', metodoPagoLabelBoucher);
  if (boucher?.metodoPago === 'efectivo' && boucher?.montoRecibido != null) {
    addPad('Recibido:', `${simboloMonedaCobro} ${Number(boucher.montoRecibido).toFixed(2)}`);
    addPad('Vuelto:', `${simboloMonedaCobro} ${Number(boucher.vuelto ?? 0).toFixed(2)}`, { bold: true });
  }

  if (b.mostrarDatosCliente) {
    addRule();
    addLabel(et('cliente'), censurar(nombreCliente, v.cliente));
    addLabel('DNI', censurar(dniCliente, v.dniCliente));
  }

  if (b.mostrarAgradecimiento) {
    addRule();
    addWrapped(p.mensajes?.agradecimiento || 'Gracias por su preferencia', 'center', { bold: true });
    if (p.mensajes?.urlConsulta) {
      addWrapped(`Consulte en: ${p.mensajes.urlConsulta}`, 'center', { size: SIZE_SM });
    }
  }

  if (p.campos?.mostrarBloquePromo) {
    addRule();
    addWrapped(p.promo?.titulo || '', 'center', { bold: true, size: SIZE_TITLE });
    if (p.promo?.mensaje) addWrapped(p.promo.mensaje, 'center', { size: SIZE_SM });
  }

  const heightOf = (op) => {
    if (op.type === 'gap') return op.h;
    if (op.type === 'rule') return 8;
    if (op.type === 'image') return op.height + 4;
    if (op.type === 'text' || op.type === 'pad' || op.type === 'label') {
      if (op.type === 'label') {
        const labelW = CONTENT_W * 0.36;
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
    if (op.type === 'gap') {
      y -= op.h;
      return;
    }
    if (op.type === 'rule') {
      y -= 4;
      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: PUNTOS_ANCHO - MARGIN_X, y },
        thickness: 0.5,
        color: rgb(0.3, 0.3, 0.3),
        dashArray: [2, 2],
      });
      y -= 4;
      return;
    }
    if (op.type === 'image') {
      const imgW = op.width;
      const imgH = op.height;
      y -= imgH;
      page.drawImage(op.image, {
        x: MARGIN_X + (CONTENT_W - imgW) / 2,
        y,
        width: imgW,
        height: imgH,
      });
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
      page.drawText(op.right, {
        x: PUNTOS_ANCHO - MARGIN_X - rw,
        y: y - size,
        size,
        font: f,
        color: rgb(0, 0, 0),
      });
      y -= size >= SIZE_TITLE ? LH_TITLE : LH_BODY;
      return;
    }
    if (op.type === 'label') {
      const labelW = CONTENT_W * 0.36;
      const lines = wrapText(font, op.value, CONTENT_W - labelW - 4, SIZE_BODY);
      lines.forEach((line, idx) => {
        if (idx === 0) {
          page.drawText(op.label, {
            x: MARGIN_X,
            y: y - SIZE_BODY,
            size: SIZE_BODY,
            font: fontBold,
            color: rgb(0, 0, 0),
          });
        }
        page.drawText(line, {
          x: MARGIN_X + labelW,
          y: y - SIZE_BODY,
          size: SIZE_BODY,
          font,
          color: rgb(0, 0, 0),
        });
        y -= LH_BODY;
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  const outUri = `${FileSystem.cacheDirectory}boucher_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, uint8ToBase64(pdfBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}
