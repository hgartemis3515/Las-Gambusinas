/**
 * ePOS-Print XML 80 mm (42 columnas) — ticket mozo + ticket cocina.
 * Cocina: mismo cuerpo, sin título de restaurante, □ a la izquierda de cada plato.
 */
import moment from 'moment-timezone';
import { numeroTicketImpresion } from './comandaHelpers';

const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
const CHARS = 42;
const CUADRO = '□';

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

const divider = () => texto('-'.repeat(CHARS));

const padLine = (left, right) => {
  const l = String(left);
  const r = String(right);
  const gap = CHARS - l.length - r.length;
  if (gap >= 1) return l + ' '.repeat(gap) + r;
  if (l.length + r.length <= CHARS) return (l + ' ' + r).slice(0, CHARS);
  return (l.slice(0, Math.max(0, CHARS - r.length - 1)) + ' ' + r).slice(0, CHARS);
};

const colW = Math.floor(CHARS / 2);

const padCol = (s, w) => String(s ?? '').slice(0, w).padEnd(w, ' ');

const cuadros2 = (l1, v1, l2, v2) => [
  texto(padCol(l1, colW) + padCol(l2, CHARS - colW)),
  texto(padCol(v1 || '—', colW) + padCol(v2 || '—', CHARS - colW)),
];

const fmt = (n, dec = 2) => Number(n || 0).toFixed(dec);

const nombrePlato = (p) =>
  p?.nombre
  || p?.plato?.nombre
  || p?.nombreComercial
  || 'Plato';

function platosVivosDeComanda(platos, comanda, { incluirPagados }) {
  const cid = String(comanda?._id || '');
  return (platos || []).filter((p) => {
    if (p.eliminado || p.anulado) return false;
    if (!incluirPagados && String(p.estado || '').toLowerCase() === 'pagado') return false;
    if (cid && p.comandaId != null && String(p.comandaId) !== cid) return false;
    return true;
  });
}

function montoLinea(p) {
  const cant = Number(p.cantidad) || 1;
  const unit = Number(p.precio ?? p.precioUnitario ?? p.plato?.precio) || 0;
  if (p.subtotal != null && Number.isFinite(Number(p.subtotal))) return Number(p.subtotal);
  return cant * unit;
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
  const parts = [];
  parts.push(texto(letrero || '#—', 'align="center" width="2" height="2" em="true"'));
  parts.push('<feed unit="8"/>');
  parts.push(...cuadros2('Mozo', mozo, 'Mesa', mesa));
  parts.push(...cuadros2('Fecha', fecha, 'Área', area || '—'));
  parts.push(divider());
  const encabezado = cocina
    ? padLine(`${CUADRO} Cant Plato`, 'P.Unit   Total')
    : padLine('Cant  Plato', 'P.Unit   Total');
  parts.push(texto(encabezado, 'em="true"'));

  let bruto = 0;
  for (const p of platos) {
    const cant = Number(p.cantidad) || 1;
    const unit = Number(p.precio ?? p.precioUnitario ?? p.plato?.precio) || 0;
    const line = montoLinea(p);
    bruto += line;
    const nom = nombrePlato(p);
    const left = cocina
      ? `${CUADRO} ${cant} ${nom}`
      : `${cant}  ${nom}`;
    const right = `${fmt(unit, decimales)}  ${fmt(line, decimales)}`;
    parts.push(texto(padLine(left, right)));
  }

  parts.push(divider());
  const desc = Number(descuentoMonto) || 0;
  if (desc > 0) {
    const mot = descuentoMotivo ? ` (${String(descuentoMotivo).slice(0, 18)})` : '';
    parts.push(texto(padLine(`Descuento${mot}`, `-${simbolo}${fmt(desc, decimales)}`)));
  }
  const neto = Math.max(0, bruto - desc);
  parts.push(texto(padLine('TOTAL', `${simbolo}${fmt(neto, decimales)}`), 'em="true"'));
  parts.push('<feed unit="12"/>');
  return parts;
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

/**
 * Un XML: por cada comanda con platos, ticket mozo + corte + ticket cocina + corte.
 */
export function generarXmlTicketsMozoYCocina({
  comandas = [],
  platos = [],
  mesa = null,
  incluirPagados = false,
  configMoneda = null,
}) {
  const letrero = numeroTicketImpresion(comandas) || '#—';
  const simbolo = configMoneda?.simboloMoneda || 'S/.';
  const decimales = configMoneda?.decimales ?? 2;
  const parts = [`<epos-print xmlns="${EPOS_NS}">`];
  let impresos = 0;

  for (const comanda of comandas || []) {
    const lista = platosVivosDeComanda(platos, comanda, { incluirPagados });
    if (!lista.length) continue;
    const meta = metaDeComanda(comanda, mesa);
    const desc = Number(comanda.montoDescuento) || 0;
    const opts = {
      letrero,
      ...meta,
      platos: lista,
      simbolo,
      decimales,
      descuentoMonto: desc,
      descuentoMotivo: comanda.motivoDescuento || '',
    };
    parts.push(...cuerpoTicket({ ...opts, cocina: false }));
    parts.push('<cut type="feed"/>');
    parts.push(...cuerpoTicket({ ...opts, cocina: true }));
    parts.push('<cut type="feed"/>');
    impresos += 1;
  }

  parts.push('</epos-print>');
  return { xml: parts.join(''), impresos, letrero };
}
