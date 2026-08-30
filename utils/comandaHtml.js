/**
 * comandaHtml.js — Generador de HTML 80mm para Comanda (NO comprobante fiscal)
 *
 * Excluye intencionalmente: RUC, dirección, IGV, serie/correlativo fiscal,
 * bloque promoción/QR, URL consulta SUNAT, "Nro. Voucher", "Fecha Pago".
 *
 * Incluye: Logo, nombre comercial, eslogan, título "COMANDA", número de comanda,
 * fecha/hora, mesa, mozo, área, detalle de platos (con complementos y notas),
 * total simple, moneda, tipo de pago, cliente, DNI, observaciones.
 */
import { resolveLogoUrl } from './logoPlantilla';
import { envolverHtmlBoucherTicket } from './boucherPrint';

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

function imprimirSoloNombreComercial(plantilla) {
  return plantilla?.imprimirSoloNombreComercial !== false;
}

function nombreComercialImpresion(prod) {
  const plato = prod?.plato && typeof prod.plato === 'object' ? prod.plato : null;
  const comercial = String(plato?.nombre || prod?.nombreComercial || prod?.nombre || '').trim();
  const cocina = String(plato?.nombreCocina || prod?.nombreCocina || '').trim();
  if (comercial && cocina && comercial === cocina) return comercial;
  return comercial || 'Plato';
}

export function aplicarOpcionesImpresionProductos(productos, plantilla) {
  const solo = imprimirSoloNombreComercial(plantilla);
  return (productos || [])
    .filter((prod) => prod && !prod.eliminado && !prod.anulado)
    .map((prod) => {
      const nombre = nombreComercialImpresion(prod);
      if (!solo) return { ...prod, nombre };
      return { ...prod, nombre, complementos: [], mostrarResumenComplementos: false };
    });
}

/**
 * Formatea números de comanda para el campo visible del ticket.
 * Una comanda  → "#81"
 * Varias       → "#81+#82"   (orden ascendente, sin duplicados)
 *
 * @param {Array<number|string|null|undefined>} comandasNumbers
 * @returns {string} ej. "#81+#82" o "" si no hay números válidos
 */
export function formatComandasNumbersLabel(comandasNumbers) {
  const nums = [...new Set(
    (comandasNumbers || [])
      .map((n) => (n != null && n !== '' ? Number(n) : NaN))
      .filter((n) => !Number.isNaN(n))
  )].sort((a, b) => a - b);

  if (nums.length === 0) return '';
  return nums.map((n) => `#${n}`).join('+');
}

/**
 * Aplica display agrupado sobre payload ticket-imprimible o mapComandaATicket.
 * Calcula comandaNumeroDisplay a partir de comandasNumbers si existen.
 *
 * @param {Object} datos - Datos mapeados de comanda
 * @returns {Object} datos con campo adicional comandaNumeroDisplay
 */
export function aplicarComandaNumeroDisplay(datos) {
  const label = formatComandasNumbersLabel(datos.comandasNumbers);
  if (label) {
    return { ...datos, comandaNumeroDisplay: label };
  }
  const fallback = datos.comandaNumero != null ? `#${datos.comandaNumero}` : '';
  return { ...datos, comandaNumeroDisplay: fallback };
}

/**
 * Genera el HTML interior de una comanda térmica 80mm.
 * No incluye el wrapper <html>/<style> — eso lo hace envolverHtmlBoucherTicket.
 *
 * @param {Object} params
 * @param {Object} params.datos - Datos mapeados de la comanda (ver mapComandaATicket o ticket-imprimible)
 * @param {Object} params.plantilla - Plantilla de comanda desde GET /comanda-plantilla
 * @param {string} params.serverOrigin - URL base del servidor (para resolver logo)
 * @returns {{ htmlInner: string, heightPx: number, wrapOpts: object, html: string }}
 */
export function generarHtmlComanda({ datos, plantilla, serverOrigin }) {
  const p = plantilla || {};
  datos = {
    ...(datos || {}),
    productos: aplicarOpcionesImpresionProductos(datos?.productos, p),
  };
  const vis = p.visibilidad || {};
  const bloques = p.bloques || {};
  const esp = p.espaciado || {};
  const etiquetas = { ...ETIQUETAS_DEFAULT_COMANDA, ...(p.etiquetas || {}) };
  const mensajes = p.mensajes || {};

  const lineHeight = esp.lineHeight || 16;
  const fontSize = esp.tamanoFuente || 11;
  const dividerGap = esp.espacioDivider || 8;

  const mostrarPrecios = bloques.mostrarPrecios !== false;
  const mostrarTotal = bloques.mostrarTotal !== false;

  // Logo
  const logoUrl = resolveLogoUrl(p.logo || '', serverOrigin);
  const mostrarLogo = !!logoUrl;
  const mostrarNombre = vis.nombre !== false;
  const mostrarEslogan = vis.eslogan !== false;

  let html = '';

  // === ENCABEZADO ===
  if (bloques.mostrarEncabezado !== false) {
    if (mostrarLogo) {
      html += `<div style="text-align:center;margin-bottom:6px;">
        <img src="${logoUrl}" style="max-width:100%;max-height:80px;object-fit:contain;" />
      </div>`;
    }
    if (mostrarNombre) {
      html += `<div class="restaurant-name" style="text-align:center;font-weight:bold;font-size:${fontSize + 4}px;">${escapeHtml(p.restaurante?.nombre || 'LAS GAMBUSINAS')}</div>`;
    }
    if (mostrarEslogan && p.restaurante?.eslogan) {
      html += `<div style="text-align:center;font-size:${fontSize - 1}px;color:#666;">${escapeHtml(p.restaurante.eslogan)}</div>`;
    }
    // Título COMANDA
    html += `<div style="text-align:center;font-weight:bold;font-size:${fontSize + 2}px;margin:4px 0;letter-spacing:2px;">${escapeHtml(p.encabezado?.titulo || 'COMANDA')}</div>`;
    html += divider();
  }

  // === DATOS COMANDA ===
  if (bloques.mostrarDatosComanda !== false) {
    html += '<div style="margin-bottom:4px;">';
    if (vis.comandaNumero !== false) {
      const numeroEtiqueta = datos.comandaNumeroDisplay
        || formatComandasNumbersLabel(datos.comandasNumbers)
        || (datos.comandaNumero != null ? `#${datos.comandaNumero}` : '');
      if (numeroEtiqueta) {
        html += fila(etiquetas.comandaNumero, numeroEtiqueta);
      }
    }
    if (vis.fechaPedido !== false && datos.fechaPedido) {
      html += fila(etiquetas.fechaPedido, formatFecha(datos.fechaPedido));
    }
    if (vis.mesa !== false && datos.mesa) {
      html += fila(etiquetas.mesa, String(datos.mesa));
    }
    if (vis.mozo !== false && datos.mozo) {
      html += fila(etiquetas.mozo, datos.mozo);
    }
    if (vis.area !== false && datos.area) {
      html += fila(etiquetas.area, datos.area);
    }
    if (vis.moneda !== false && datos.moneda) {
      html += fila(etiquetas.moneda, datos.moneda);
    }
    if (vis.tipoPago !== false && datos.tipoPago) {
      html += fila(etiquetas.tipoPago, datos.tipoPago);
    }
    html += '</div>';
    html += divider();
  }

  // === DETALLE PRODUCTOS ===
  if (bloques.mostrarDetalleProductos !== false && datos.productos?.length) {
    html += '<table style="width:100%;border-collapse:collapse;font-size:' + fontSize + 'px;">';
    html += '<thead><tr style="border-bottom:1px solid #000;font-weight:bold;">';
    html += '<th style="text-align:left;padding:2px 0;">Producto</th>';
    html += '<th style="text-align:center;padding:2px 4px;width:30px;">Cant.</th>';
    if (mostrarPrecios) {
      html += '<th style="text-align:right;padding:2px 4px;width:50px;">Total</th>';
    }
    html += '</tr></thead><tbody>';

    for (const prod of datos.productos) {
      if (!prod || prod.eliminado || prod.anulado) continue;
      html += '<tr>';
      const nombre = escapeHtml(prod.nombre || 'Plato');
      const marcadorPL = prod.paraLlevar ? ' (P.L.)' : '';
      html += `<td style="padding:2px 0;vertical-align:top;">${nombre}${marcadorPL}</td>`;
      html += `<td style="text-align:center;vertical-align:top;">${prod.cantidad || 1}</td>`;
      if (mostrarPrecios) {
        html += `<td style="text-align:right;vertical-align:top;">${(prod.subtotal || 0).toFixed(2)}</td>`;
      }
      html += '</tr>';

      // Complementos
      if (prod.complementos?.length) {
        for (const c of prod.complementos) {
          html += '<tr style="color:#666;font-size:' + (fontSize - 1) + 'px;">';
          html += `<td style="padding:0 0 0 10px;">└ ${escapeHtml(c.grupo || '')}: ${escapeHtml(c.opcion || '')}</td>`;
          html += '<td></td>';
          if (mostrarPrecios) html += '<td></td>';
          html += '</tr>';
        }

        // v3.0: fila de resumen agregado si el plato lo activa
        if (prod.mostrarResumenComplementos) {
          const flags = prod.resumenComplementosImpresion || {};
          const mostrarCantidad = flags.mostrarCantidad !== false;
          const mostrarMontoExtra = flags.mostrarMontoExtra !== false;
          let totalUnidades = 0;
          let extra = 0;
          for (const c of prod.complementos) {
            const cant = Math.max(1, Number(c.cantidad) || 1);
            totalUnidades += cant;
            extra += (Number(c.precio) || 0) * cant;
          }
          if (totalUnidades > 0) {
            const partes = [];
            if (mostrarCantidad) {
              partes.push(`${totalUnidades} ${totalUnidades === 1 ? 'ud.' : 'uds.'}`);
            }
            if (mostrarMontoExtra && extra > 0) {
              partes.push(`(+S/.${extra.toFixed(2)})`);
            }
            const textoResumen = partes.join(' ').trim();
            if (textoResumen) {
              html += '<tr style="color:#444;font-size:' + (fontSize - 2) + 'px;font-weight:600;">';
              html += `<td colspan="${mostrarPrecios ? 3 : 2}" style="padding:1px 0 0 10px;border-top:1px dotted #aaa;">Σ Complementos: ${escapeHtml(textoResumen)}</td>`;
              html += '</tr>';
            }
          }
        }
      }
      // Nota especial
      if (prod.notaEspecial) {
        html += '<tr style="color:#999;font-size:' + (fontSize - 2) + 'px;font-style:italic;">';
        html += `<td colspan="${mostrarPrecios ? 3 : 2}" style="padding:0 0 0 10px;">Nota: ${escapeHtml(prod.notaEspecial)}</td>`;
        html += '</tr>';
      }
    }
    html += '</tbody></table>';
    html += divider();
  }

  // === TOTAL ===
  if (mostrarTotal && bloques.mostrarTotal !== false) {
    const simboloMoneda = datos.moneda === 'USD' ? '$' : 'S/.';
    const subtotalPlatos = resolverSubtotalPlatos(datos);
    const { bruto, neto, montoDesc } = resolverBrutoYNetoImpresion(datos, subtotalPlatos);
    if (mostrarPrecios && (montoDesc > 0 ? bruto : subtotalPlatos) > 0) {
      html += `<div style="font-size:${fontSize}px;text-align:right;padding:1px 0;">Subtotal: ${simboloMoneda}${(montoDesc > 0 ? bruto : subtotalPlatos).toFixed(2)}</div>`;
    }
    if (montoDesc > 0) {
      const motivoDesc = datos.descuentos?.[0]?.motivo ? ` (${escapeHtml(datos.descuentos[0].motivo)})` : '';
      html += `<div style="font-size:${fontSize}px;text-align:right;padding:1px 0;">Descuento${motivoDesc}: -${simboloMoneda}${montoDesc.toFixed(2)}</div>`;
    }
    html += '<div style="font-weight:bold;font-size:' + (fontSize + 2) + 'px;text-align:right;margin:4px 0;">';
    html += `${etiquetas.total}: ${simboloMoneda}${neto.toFixed(2)}`;
    html += '</div>';

    // Bloque efectivo: monto recibido + vuelto (solo si método de pago es efectivo)
    if (String(datos.tipoPago || '').toLowerCase() === 'efectivo' && (datos.montoRecibido != null || datos.vuelto != null)) {
      html += `<div style="font-size:${fontSize}px;text-align:right;padding:2px 0 1px;">Recibido: ${simboloMoneda}${(datos.montoRecibido || 0).toFixed(2)}</div>`;
      html += `<div style="font-size:${fontSize + 1}px;font-weight:bold;text-align:right;padding:1px 0;">Vuelto: ${simboloMoneda}${(datos.vuelto || 0).toFixed(2)}</div>`;
    }

    html += divider();
  }

  // === DATOS CLIENTE ===
  if (bloques.mostrarDatosCliente !== false) {
    const clienteName = datos.cliente?.nombre || '';
    const clienteDni = datos.cliente?.dni || '';
    if (clienteName || clienteDni) {
      html += '<div style="margin-bottom:4px;">';
      if (vis.cliente !== false && clienteName) {
        html += fila(etiquetas.cliente, clienteName);
      }
      if (vis.dniCliente !== false && clienteDni) {
        html += fila(etiquetas.dni, clienteDni);
      }
      html += '</div>';
    }
  }

  // === OBSERVACIONES ===
  if (bloques.mostrarObservaciones !== false && datos.observaciones) {
    html += `<div style="margin-bottom:4px;font-size:${fontSize - 1}px;color:#555;">
      <strong>${etiquetas.observaciones}:</strong> ${escapeHtml(datos.observaciones)}
    </div>`;
  }

  // === PIE ===
  if (mensajes.pie) {
    html += `<div style="text-align:center;font-size:${fontSize - 2}px;color:#999;margin-top:6px;">${escapeHtml(mensajes.pie)}</div>`;
  }

  const heightPx = Math.max(200, html.length / 2.5);
  const wrapOpts = { fontSizeBase: fontSize, lineHeightBase: lineHeight, pageHeightPx: Math.ceil(heightPx + 40) };

  return {
    htmlInner: html,
    heightPx,
    wrapOpts,
    html: envolverHtmlBoucherTicket(html, wrapOpts),
  };
}

// === HELPERS ===

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolverSubtotalPlatos(datos) {
  const hayLista = Array.isArray(datos?.productos);
  const suma = (datos?.productos || []).reduce((s, p) => {
    if (!p || p.eliminado || p.anulado) return s;
    const linea = Number(p?.subtotal);
    if (Number.isFinite(linea) && linea > 0) return s + linea;
    return s + (Number(p?.precio) || 0) * (Number(p?.cantidad) || 1);
  }, 0);
  if (hayLista) return Number(suma.toFixed(2));
  const sinDesc = Number(datos?.totalSinDescuento);
  if (sinDesc > 0) return sinDesc;
  const sub = Number(datos?.subtotal);
  return Number.isFinite(sub) && sub > 0 ? sub : 0;
}

function resolverBrutoYNetoImpresion(datos, subtotalPlatos) {
  const montoDesc = Number(datos?.montoDescuento || 0);
  const hayLista = Array.isArray(datos?.productos);
  const sin = Number(datos?.totalSinDescuento);
  const tot = Number(datos?.total);
  const sub = Number(datos?.subtotal);
  let bruto;
  if (hayLista) {
    bruto = Number(subtotalPlatos) || 0;
  } else {
    const candidatos = [];
    if (Number.isFinite(sin) && sin > 0) candidatos.push(sin);
    if (subtotalPlatos > 0) candidatos.push(subtotalPlatos);
    if (Number.isFinite(sub) && sub > 0) candidatos.push(sub);
    bruto = candidatos.length
      ? Math.max(...candidatos)
      : (Number.isFinite(tot) && tot > 0 ? tot : 0);
  }
  const neto = montoDesc > 0
    ? Number(Math.max(0, bruto - montoDesc).toFixed(2))
    : (hayLista ? bruto : (Number.isFinite(tot) && tot > 0 ? tot : bruto));
  return { bruto, neto, montoDesc };
}

function divider() {
  return '<div style="border-top:1px dashed #999;margin:6px 0;"></div>';
}

function fila(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:1px 0;">
    <span style="font-weight:500;">${label}:</span>
    <span>${value}</span>
  </div>`;
}

function formatFecha(date) {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(date);
  }
}

function resolverPrecioLineaImpresion(p) {
  const n = Number(p?.precioUnitario ?? p?.precio ?? p?.plato?.precio ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mapa datos reales de comanda + boucher → formato ticket para plantilla comanda.
 * Se usa tanto en App Mozos como en el dashboard.
 */
export function mapComandaATicket(comanda, boucherOpcional, config = {}) {
  const comandasNumbers = boucherOpcional?.comandasNumbers
    || (comanda.comandaNumber ? [comanda.comandaNumber] : []);
  const productos = (comanda.platos || [])
    .filter(p => !p.eliminado && !p.anulado)
    .map(p => {
      const precio = resolverPrecioLineaImpresion(p);
      const cantidad = p.cantidad || 1;
      return {
        nombre: p.plato?.nombre || p.nombre || 'Plato',
        cantidad,
        precio,
        subtotal: precio * cantidad,
        tipoServicio: p.tipoServicio || 'mesa',
        complementos: (p.complementosSeleccionados || []).map(c => ({
          grupo: c.grupo,
          opcion: c.opcion,
        })),
        notaEspecial: p.notaEspecial || '',
        paraLlevar: p.tipoServicio === 'para_llevar',
      };
    });
  const sumaPlatos = productos.reduce((s, p) => s + (Number(p.subtotal) || 0), 0);
  const tieneDesc = Number(comanda.descuento) > 0 || Number(comanda.montoDescuento) > 0;
  const totalFuente = Number(boucherOpcional?.total ?? comanda.total ?? comanda.precioTotal);
  const subtotalFuente = Number(comanda.totalSinDescuento ?? boucherOpcional?.subtotal ?? comanda.subtotal);
  return {
    comandaNumero: comanda.comandaNumber || comanda.comandaNumber || null,
    comandasNumbers,
    fechaPedido: comanda.createdAt || comanda.fechaPedido || new Date(),
    mesa: comanda.mesaNumero || comanda.mesas?.nummesa || (typeof comanda.mesa === 'object' ? comanda.mesa?.nummesa : comanda.mesa) || null,
    mozo: comanda.mozoNombre || comanda.mozos?.name || (typeof comanda.mozo === 'object' ? comanda.mozo?.name : comanda.mozo) || null,
    area: comanda.areaNombre || comanda.mesas?.area?.nombre || null,
    moneda: boucherOpcional?.moneda || config.moneda || 'PEN',
    tipoPago: boucherOpcional?.metodoPagoLabel || boucherOpcional?.metodoPago || 'Pendiente',
    observaciones: comanda.observaciones || '',
    productos,
    subtotal: sumaPlatos > 0 ? sumaPlatos : (subtotalFuente > 0 ? subtotalFuente : 0),
    totalSinDescuento: sumaPlatos > 0 ? sumaPlatos : (Number(comanda.totalSinDescuento) || subtotalFuente || 0),
    igv: boucherOpcional?.igv ?? comanda.igv ?? 0,
    total: tieneDesc
      ? (Number.isFinite(Number(comanda.totalCalculado)) ? Number(comanda.totalCalculado) : 0)
      : (totalFuente > 0 ? totalFuente : sumaPlatos),
    montoDescuento: tieneDesc
      ? (Number(comanda.montoDescuento) || 0)
      : (Number(boucherOpcional?.montoDescuento) || 0),
    descuentos: tieneDesc
      ? [{ porcentaje: comanda.descuento, motivo: comanda.motivoDescuento, monto: comanda.montoDescuento }]
      : (boucherOpcional?.descuentos || []),
    cliente: {
      nombre: comanda.clienteNombre || comanda.cliente?.nombre || (typeof boucherOpcional?.cliente === 'object' ? boucherOpcional.cliente?.nombre : null) || 'Cliente',
      dni: comanda.cliente?.dni || (typeof boucherOpcional?.cliente === 'object' ? boucherOpcional.cliente?.dni : null) || '',
    },
    voucherId: boucherOpcional?.voucherId || boucherOpcional?.boucherNumber || null,
    montoRecibido: boucherOpcional?.montoRecibido ?? null,
    vuelto: boucherOpcional?.vuelto ?? null,
  };
}