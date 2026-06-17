/**
 * HTML del boucher 80mm para compartir como PDF (expo-print).
 * La impresión térmica usa boucherEposXml.js; este módulo es solo para Compartir.
 */
import moment from 'moment-timezone';
import {
  estimarAlturaPdfBoucher,
  envolverHtmlBoucherTicket,
} from './boucherPrint';

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
    return n.toString();
  };

  return convertir(entero) + ' Y ' + decimal.toString().padStart(2, '0') + '/100 Soles';
};

const obtenerEtiqueta = (key, plantilla, defaults) =>
  plantilla?.etiquetas?.[key] || defaults?.[key] || key;

const filaMeta = (etiqueta, valor) =>
  `<tr><td style="width:35%;vertical-align:top;font-weight:600;color:#222;padding:1px 4px 1px 0;font-size:12px;">${etiqueta}</td>` +
  `<td style="vertical-align:top;padding:1px 0;font-size:12px;word-break:break-word;">${valor}</td></tr>`;

/**
 * @returns {{ html: string, heightPx: number }}
 */
export function generarHtmlBoucher({
  boucher = null,
  comandas = [],
  mesa = null,
  plantilla,
  configMoneda = null,
  clienteSeleccionado = null,
  subtotalOriginal = 0,
  total = 0,
  etiquetasDefault = {},
}) {
  const p = plantilla;
  const e = p.espaciado || {};
  const b = p.bloques || {};
  const v = p.visibilidad || {};
  const usarBoucherBackend = boucher?.platos?.length > 0;

  const simboloMoneda =
    boucher?.configuracionIGV?.simboloMoneda || configMoneda?.simboloMoneda || 'S/.';
  const nombreImpuesto =
    boucher?.configuracionIGV?.nombreImpuesto || configMoneda?.nombreImpuestoPrincipal || 'IGV';
  const igvPorcentaje =
    boucher?.configuracionIGV?.igvPorcentaje || configMoneda?.igvPorcentaje || 18;

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

  const montoTotalDescuento = usarBoucherBackend
    ? boucher.montoDescuento || 0
    : comandas.reduce((sum, c) => sum + (c.montoDescuento || 0), 0);

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

  let html = '';

  if (b.mostrarEncabezado) {
    html += '<div class="ticket-block" style="text-align:center;width:100%;">';
    if (p.logo) {
      html += `<img src="${escapeHtml(p.logo)}" style="max-width:100%;max-height:64px;margin:0 auto 4px;display:block;" alt="Logo">`;
    }
    html += `<div style="font-size:16px;font-weight:800;line-height:1.2;">${escapeHtml(censurar(p.restaurante?.nombre, v.nombre))}</div>`;
    html += `<div style="font-size:12px;font-weight:500;color:#444;line-height:1.3;">${escapeHtml(censurar(p.restaurante?.eslogan, v.eslogan))}</div>`;
    html += `<div style="font-size:12px;font-weight:600;">R.U.C.: ${escapeHtml(censurar(p.restaurante?.ruc, v.ruc))}</div>`;
    html += `<div style="font-size:12px;line-height:1.3;">${escapeHtml(censurar(p.restaurante?.direccion, v.direccion))}</div>`;
    html += `<div style="font-size:12px;">Tel: ${escapeHtml(censurar(p.restaurante?.telefono, v.telefono))}</div>`;
    html += '</div>';
    html += `<div style="border-top:1px dashed #333;margin:${Math.min(e.espacioDivider || 6, 6)}px 0;width:100%;"></div>`;
    html += `<div style="text-align:center;font-weight:700;font-size:14px;line-height:1.2;width:100%;">${escapeHtml(p.encabezado?.tipoComprobante || '')}</div>`;
    html += `<div style="text-align:center;font-weight:600;font-size:12px;width:100%;">${escapeHtml(p.encabezado?.serie || 'B001')}-${String(boucherNumber).padStart(6, '0')}</div>`;
    html += `<div style="border-top:1px dashed #333;margin:${Math.min(e.espacioDivider || 6, 6)}px 0;width:100%;"></div>`;
  }

  if (b.mostrarDatosPedido) {
    html += '<table style="width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;">';
    html += filaMeta(
      `${escapeHtml(et('voucherId'))}:`,
      `${escapeHtml(censurar(voucherId, v.voucherId))}-${escapeHtml(censurar(boucherNumber, v.numeroVoucher))}`
    );
    html += filaMeta(
      `${escapeHtml(et('fechaPedido'))}:`,
      escapeHtml(censurar(formatFecha(fechaPedido), v.fechaPedido))
    );
    html += filaMeta(
      `${escapeHtml(et('fechaPago'))}:`,
      escapeHtml(censurar(formatFecha(fechaPago), v.fechaPago))
    );
    html += filaMeta(
      `${escapeHtml(et('mesero'))}:`,
      escapeHtml(censurar(nombreMozo, v.mesero))
    );
    html += filaMeta('Moneda:', 'Soles');
    html += filaMeta(
      `${escapeHtml(et('mesa'))}:`,
      escapeHtml(censurar(String(numMesa), v.mesa))
    );
    if (observaciones) {
      html += filaMeta(
        `${escapeHtml(et('observaciones'))}:`,
        escapeHtml(censurar(observaciones, v.observacion))
      );
    }
    html += '</table>';
    html += `<div style="border-top:1px dashed #333;margin:${Math.min(e.espacioDivider || 6, 6)}px 0;"></div>`;
  }

  if (b.mostrarDetalleProductos) {
    const tbl =
      'width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed;';
    html += `<table style="${tbl}"><thead><tr style="font-weight:700;border-bottom:1px solid #333;">`;
    html += '<th style="text-align:left;width:48%;font-size:12px;">Producto</th>';
    html += '<th style="text-align:center;width:12%;font-size:12px;">Cant.</th>';
    html += '<th style="text-align:right;width:20%;font-size:12px;">P.Unit</th>';
    html += '<th style="text-align:right;width:20%;font-size:12px;">Total</th></tr></thead><tbody>';

    const filaPlato = (nombre, cantidad, precio, subtotalPlato, complementos = []) => {
      html += '<tr>';
      html += `<td style="vertical-align:top;font-size:12px;overflow-wrap:break-word;padding:2px 4px 2px 0;">${escapeHtml(nombre)}</td>`;
      html += `<td style="text-align:center;vertical-align:top;font-size:12px;padding:2px 0;">${cantidad}</td>`;
      html += `<td style="text-align:right;vertical-align:top;font-size:12px;padding:2px 0;white-space:nowrap;">${precio.toFixed(2)}</td>`;
      html += `<td style="text-align:right;vertical-align:top;font-size:12px;padding:2px 0;white-space:nowrap;">${subtotalPlato.toFixed(2)}</td></tr>`;
      complementos.forEach((comp) => {
        const opcionStr = Array.isArray(comp.opcion)
          ? comp.opcion.join(', ')
          : comp.opcion || comp.nombre || '';
        html += '<tr><td colspan="4" style="font-size:11px;color:#666;padding:0 0 2px 8px;">';
        html += `└ ${escapeHtml(opcionStr)}`;
        if (comp.precio > 0) html += ` (+${comp.precio.toFixed(2)})`;
        html += '</td></tr>';
      });
    };

    if (usarBoucherBackend) {
      boucher.platos.forEach((platoItem) => {
        const cantidad = platoItem.cantidad || 1;
        const precio = platoItem.precio || 0;
        const subtotalPlato = platoItem.subtotal || precio * cantidad;
        filaPlato(
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
          filaPlato(
            plato.nombre || 'Plato',
            cantidad,
            precio,
            precio * cantidad,
            platoItem.complementosSeleccionados || []
          );
        });
      });
    }
    html += '</tbody></table>';
    html += `<div style="border-top:1px dashed #333;margin:${e.espacioDivider || 8}px 0;"></div>`;
  }

  if (b.mostrarTotales && v.totales !== false) {
    html += '<div style="text-align:right;width:100%;font-size:12px;">';
    html += `<div style="padding:1px 0;">Subtotal: <span style="font-weight:500;">${simboloMoneda} ${subtotalFinal.toFixed(2)}</span></div>`;
    if (p.campos?.mostrarIGV) {
      html += `<div style="padding:1px 0;">${escapeHtml(nombreImpuesto)} (${igvPorcentaje}%): <span style="font-weight:500;">${simboloMoneda} ${igvFinal.toFixed(2)}</span></div>`;
    }
    if (descuentosComandas.length > 0) {
      html += `<div style="padding:1px 0;color:#EF4444;">Descuento: <span style="font-weight:500;">-${simboloMoneda} ${montoTotalDescuento.toFixed(2)}</span></div>`;
    }
    html += `<div style="font-size:14px;font-weight:700;border-top:2px solid #000;padding-top:4px;margin-top:4px;">${escapeHtml(et('total'))}: ${simboloMoneda} ${totalFinal.toFixed(2)}</div></div>`;
    html += `<div style="font-style:italic;font-size:11px;margin-top:4px;line-height:1.3;width:100%;">Son: ${escapeHtml(numeroALetras(totalFinal))}</div>`;
  }

  html += `<div style="margin-top:4px;font-size:12px;width:100%;">Pago: ${escapeHtml(boucher?.metodoPago || 'Efectivo')}</div>`;

  if (b.mostrarDatosCliente) {
    html += `<div style="border-top:1px dashed #333;margin:${e.espacioDivider || 8}px 0;width:100%;"></div>`;
    html += `<div style="font-size:12px;width:100%;"><span style="font-weight:600;color:#222;">${escapeHtml(et('cliente'))}:</span> <span>${escapeHtml(censurar(nombreCliente, v.cliente))}</span></div>`;
    html += `<div style="font-size:12px;width:100%;"><span style="font-weight:600;color:#222;">DNI:</span> <span>${escapeHtml(censurar(dniCliente, v.dniCliente))}</span></div>`;
  }

  if (b.mostrarAgradecimiento) {
    html += `<div style="border-top:1px dashed #333;margin:${e.espacioDivider || 8}px 0;width:100%;"></div>`;
    html += `<div style="text-align:center;font-weight:600;font-size:12px;width:100%;">${escapeHtml(p.mensajes?.agradecimiento || '')}</div>`;
    if (p.mensajes?.urlConsulta) {
      html += `<div style="font-size:11px;text-align:center;margin-top:4px;line-height:1.3;width:100%;word-break:break-all;">Consulte en: ${escapeHtml(p.mensajes.urlConsulta)}</div>`;
    }
  }

  if (p.campos?.mostrarBloquePromo) {
    html += `<div style="border-top:1px dashed #333;margin:${e.espacioDivider || 8}px 0;width:100%;"></div>`;
    html += `<div style="text-align:center;font-weight:700;font-size:14px;margin-top:6px;width:100%;">${escapeHtml(p.promo?.titulo || '')}</div>`;
    if (p.promo?.mensaje) {
      html += `<div style="font-size:11px;text-align:center;margin-top:2px;width:100%;">${escapeHtml(p.promo.mensaje)}</div>`;
    }
    if (p.campos?.mostrarQR) {
      const qrSize = Math.max(40, Math.min(120, p.promo?.qrTamano || 70));
      html += `<div style="width:${qrSize}px;height:${qrSize}px;background:#e5e5e5;display:flex;align-items:center;justify-content:center;font-size:9px;color:#666;margin:6px auto;border:1px dashed #999;">[QR]</div>`;
    }
  }

  const fontSizeBase = Math.max(Number(e.tamanoFuente) || 12, 12);
  const lineHeightBase = Math.max(Number(e.lineHeight) || 16, Math.round(fontSizeBase * 1.33));
  const heightPx = estimarAlturaPdfBoucher({
    boucher,
    comandas,
    plantilla: p,
    observaciones,
  });
  const wrapOpts = { fontSizeBase, lineHeightBase };

  return {
    htmlInner: html,
    heightPx,
    wrapOpts,
    html: envolverHtmlBoucherTicket(html, wrapOpts),
  };
}
