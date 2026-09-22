/**
 * ePOS-Print XML 80 mm — ticket mozo + ticket cocina.
 * Mismo modelo que el ticket de la tabla de tickets y pagos adelantados (App Cocina):
 * número grande, cuadros mozo/mesa y fecha/área, tabla Cant · Plato · P.Unit · Total.
 * Cocina: idéntico, con un cuadrado a la izquierda de cada plato para marcar.
 */
import moment from 'moment-timezone';
import { numeroTicketImpresion } from './comandaHelpers';

const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

/** Font A en rollo de 80 mm. */
const CHARS = 48;

const COL_CANT = 5;
const COL_UNIT = 8;
const COL_TOTAL = 9;
const COL_CUADRO = 4;

const escapeXml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const texto = (content, attrs = '') => {
  const attrStr = attrs ? ` ${attrs}` : '';
  return `<text${attrStr}>${escapeXml(content)}&#10;</text>`;
};

const linea = (char = '-') => texto(char.repeat(CHARS));

const recorta = (s, w) => String(s ?? '').slice(0, w);
const izq = (s, w) => recorta(s, w).padEnd(w, ' ');
const der = (s, w) => recorta(s, w).padStart(w, ' ');

const fmt = (n, dec = 2) => Number(n || 0).toFixed(dec);

/** Cuadro 2×2 con bordes, como las celdas del ticket de cocina. */
const CELDA_A = Math.ceil((CHARS - 3) / 2);
const CELDA_B = CHARS - 3 - CELDA_A;

const bordeCuadro = () => texto(`+${'-'.repeat(CELDA_A)}+${'-'.repeat(CELDA_B)}+`);

const filaCuadro = (a, b) => texto(`|${izq(a, CELDA_A)}|${izq(b, CELDA_B)}|`);

const cuadros = (l1, v1, l2, v2) => [
  bordeCuadro(),
  filaCuadro(` ${String(l1).toUpperCase()}`, ` ${String(l2).toUpperCase()}`),
  filaCuadro(` ${v1 || '—'}`, ` ${v2 || '—'}`),
];

const nombrePlato = (p) =>
  p?.nombre
  || p?.plato?.nombre
  || p?.nombreComercial
  || 'Plato';

function montoLinea(p) {
  if (p?.subtotal != null && Number.isFinite(Number(p.subtotal))) return Number(p.subtotal);
  const cant = Number(p?.cantidad) || 1;
  const unit = Number(p?.precio ?? p?.precioUnitario ?? p?.plato?.precio) || 0;
  return cant * unit;
}

/** Nombre largo: corta en palabras y sangra la continuación bajo la columna Plato. */
function lineasNombre(nombre, ancho) {
  const palabras = String(nombre || '').split(/\s+/).filter(Boolean);
  const out = [];
  let actual = '';
  for (const w of palabras) {
    if (!actual) {
      actual = recorta(w, ancho);
    } else if (actual.length + 1 + w.length <= ancho) {
      actual += ` ${w}`;
    } else {
      out.push(actual);
      actual = recorta(w, ancho);
    }
  }
  if (actual) out.push(actual);
  return out.length ? out : ['Plato'];
}

function cuerpoTicket({
  letrero,
  mozo,
  mesa,
  fecha,
  area,
  platos,
  simbolo,
  decimales,
  descuentoMonto,
  descuentoMotivo,
  cocina,
}) {
  const anchoPlato = CHARS - COL_CANT - COL_UNIT - COL_TOTAL - (cocina ? COL_CUADRO : 0);
  const sangria = ' '.repeat(COL_CANT + (cocina ? COL_CUADRO : 0));
  const parts = [];

  parts.push(texto(letrero || '#—', 'align="center" width="2" height="2"'));
  parts.push(...cuadros('Mozo', mozo, 'Mesa', mesa));
  parts.push(...cuadros('Fecha', fecha, 'Área', area || '—'));
  parts.push(bordeCuadro());

  const cabecera = (cocina ? izq('', COL_CUADRO) : '')
    + izq('Cant', COL_CANT)
    + izq('Plato', anchoPlato)
    + der('P.Unit', COL_UNIT)
    + der('Total', COL_TOTAL);
  parts.push(texto(cabecera, 'em="true"'));
  parts.push(linea());

  let bruto = 0;
  for (const p of platos) {
    const cant = Number(p.cantidad) || 1;
    const unit = Number(p.precio ?? p.precioUnitario ?? p.plato?.precio) || 0;
    const line = montoLinea(p);
    bruto += line;
    const nombres = lineasNombre(nombrePlato(p), anchoPlato);
    parts.push(texto(
      (cocina ? izq('[ ]', COL_CUADRO) : '')
      + izq(String(cant), COL_CANT)
      + izq(nombres[0], anchoPlato)
      + der(fmt(unit, decimales), COL_UNIT)
      + der(fmt(line, decimales), COL_TOTAL)
    ));
    for (const extra of nombres.slice(1)) {
      parts.push(texto(sangria + extra));
    }
  }

  parts.push(linea());
  const desc = Number(descuentoMonto) || 0;
  if (desc > 0) {
    const mot = descuentoMotivo ? ` (${recorta(descuentoMotivo, 16)})` : '';
    parts.push(texto(der(`Descuento${mot}: -${simbolo}${fmt(desc, decimales)}`, CHARS)));
  }
  const neto = Math.max(0, bruto - desc);
  parts.push(texto(der(`TOTAL ${simbolo}${fmt(neto, decimales)}`, CHARS), 'em="true"'));
  parts.push('<feed unit="2"/>');
  return parts;
}

function fechaIgualCocina(iso) {
  try {
    const s = new Date(iso || Date.now()).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (s && s !== 'Invalid Date') return s;
  } catch {
    /* la fuente del ticket de cocina es toLocaleString; si el motor no la tiene, moment */
  }
  return moment(iso || Date.now()).tz('America/Lima').format('DD/MM HH:mm');
}

function metaDeComanda(comanda, mesa) {
  const mozo = comanda?.mozos?.name || comanda?.mozoNombre || '—';
  const numMesa = mesa?.sinMesa
    ? 'Sin mesa'
    : (mesa?.nombreCombinado || mesa?.nummesa || comanda?.mesas?.nummesa || comanda?.mesaNumero || '—');
  const area = comanda?.areaNombre
    || comanda?.mesas?.area?.nombre
    || mesa?.area?.nombre
    || '';
  const fecha = moment(comanda?.createdAt || Date.now()).tz('America/Lima').format('DD/MM HH:mm');
  return { mozo, mesa: String(numMesa), area, fecha };
}

function platosDeSeleccion(platos, comandas, { incluirPagados }) {
  const ids = new Set((comandas || []).map((c) => String(c?._id || '')).filter(Boolean));
  const seen = new Set();
  const out = [];
  for (const p of platos || []) {
    if (p.eliminado || p.anulado) continue;
    if (!incluirPagados && String(p.estado || '').toLowerCase() === 'pagado') continue;
    const cid = p.comandaId != null ? String(p.comandaId) : '';
    if (ids.size && cid && !ids.has(cid)) continue;
    const key = String(p._id || `${cid}-${p.platoId}-${p.index}-${p.nombre || ''}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Datos del papel (uno por envío). El dibujo lo hace el mismo HTML que cocina;
 * el XML de texto de la Epson no puede igualar esa fuente.
 * Varias comandas: un solo ticket, todos los platos y un total.
 */
export function datosImpresionTicket({
  comandas = [],
  platos = [],
  mesa = null,
  incluirPagados = false,
  configMoneda = null,
}) {
  const elegidas = (comandas || []).filter((c) => c && c._id);
  const lista = platosDeSeleccion(platos, elegidas, { incluirPagados });
  const letrero = numeroTicketImpresion(elegidas) || '#—';
  if (!lista.length) return { ok: false, letrero };
  const base = elegidas[0] || {};
  const desc = elegidas.reduce((s, c) => s + (Number(c.montoDescuento) || 0), 0);
  const motivo = elegidas.map((c) => c.motivoDescuento).find((m) => m) || '';
  const decimales = configMoneda?.decimales ?? 2;
  const meta = metaDeComanda(base, mesa);
  return {
    ok: true,
    letrero,
    ...meta,
    fecha: fechaIgualCocina(base.createdAt),
    simbolo: configMoneda?.simboloMoneda || 'S/.',
    decimales,
    descuentoMonto: desc,
    descuentoMotivo: motivo,
    platos: lista.map((p) => ({
      cant: Number(p.cantidad) || 1,
      nombre: nombrePlato(p),
      unit: Number(p.precio ?? p.precioUnitario ?? p.plato?.precio) || 0,
      line: montoLinea(p),
    })),
  };
}

/**
 * Un XML con dos hojas: ticket mozo y ticket cocina.
 * Si hay varias comandas, van en un solo ticket (todos los platos y un total).
 */
export function generarXmlTicketsMozoYCocina({
  comandas = [],
  platos = [],
  mesa = null,
  incluirPagados = false,
  configMoneda = null,
}) {
  const elegidas = (comandas || []).filter((c) => c && c._id);
  const lista = platosDeSeleccion(platos, elegidas, { incluirPagados });
  const letrero = numeroTicketImpresion(elegidas) || '#—';
  const simbolo = configMoneda?.simboloMoneda || 'S/.';
  const decimales = configMoneda?.decimales ?? 2;
  if (!lista.length) {
    return { xml: '', impresos: 0, letrero };
  }
  const base = elegidas[0] || {};
  const desc = elegidas.reduce((s, c) => s + (Number(c.montoDescuento) || 0), 0);
  const motivo = elegidas.map((c) => c.motivoDescuento).find((m) => m) || '';
  const opts = {
    letrero,
    ...metaDeComanda(base, mesa),
    platos: lista,
    simbolo,
    decimales,
    descuentoMonto: desc,
    descuentoMotivo: motivo,
  };
  const parts = [
    `<epos-print xmlns="${EPOS_NS}">`,
    ...cuerpoTicket({ ...opts, cocina: false }),
    '<cut type="feed"/>',
    ...cuerpoTicket({ ...opts, cocina: true }),
    '<cut type="feed"/>',
    '</epos-print>',
  ];
  return { xml: parts.join(''), impresos: 1, letrero };
}
