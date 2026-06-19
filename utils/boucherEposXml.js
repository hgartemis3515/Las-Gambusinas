/**
 * Generador ePOS-Print XML para Epson TM Print Assistant (TM-m30II, 58mm).
 * Sin altura de página: el corte (<cut type="feed"/>) elimina papel en blanco residual.
 */
import moment from 'moment-timezone';

const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
const CHARS_LINEA = 32;

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

const divider = () => texto('-'.repeat(CHARS_LINEA));

const padLine = (left, right) => {
  const l = String(left);
  const r = String(right);
  const gap = CHARS_LINEA - l.length - r.length;
  if (gap >= 1) return l + ' '.repeat(gap) + r;
  if (l.length + r.length <= CHARS_LINEA) return (l + ' ' + r).slice(0, CHARS_LINEA);
  return (l.slice(0, CHARS_LINEA - r.length - 1) + ' ' + r).slice(0, CHARS_LINEA);
};

const lineaEtiqueta = (etiqueta, valor) => {
  const lbl = `${etiqueta}:`;
  const espacio = Math.max(1, 15 - lbl.length);
  return texto(lbl + ' '.repeat(espacio) + valor);
};

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

/**
 * @param {Object} opts
 * @returns {string} XML ePOS-Print listo para TM Print Assistant
 */
export function generarXmlBoucher({
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

  const parts = [`<epos-print xmlns="${EPOS_NS}">`];

  if (b.mostrarEncabezado) {
    parts.push(texto(censurar(p.restaurante?.nombre, v.nombre), 'align="center" width="2" height="2"'));
    parts.push(texto(censurar(p.restaurante?.eslogan, v.eslogan), 'align="center"'));
    parts.push(texto(`R.U.C.: ${censurar(p.restaurante?.ruc, v.ruc)}`, 'align="center"'));
    parts.push(texto(censurar(p.restaurante?.direccion, v.direccion), 'align="center"'));
    parts.push(texto(`Tel: ${censurar(p.restaurante?.telefono, v.telefono)}`, 'align="center"'));
    parts.push(texto('', 'align="center"'));
    parts.push(divider());
    parts.push(texto(p.encabezado?.tipoComprobante || 'BOLETA DE VENTA', 'align="center" em="true"'));
    parts.push(
      texto(
        `${p.encabezado?.serie || 'B001'}-${String(boucherNumber).padStart(6, '0')}`,
        'align="center" em="true"'
      )
    );
    parts.push(divider());
  }

  if (b.mostrarDatosPedido) {
    parts.push(
      lineaEtiqueta(
        et('voucherId'),
        `${censurar(voucherId, v.voucherId)}-${censurar(boucherNumber, v.numeroVoucher)}`
      )
    );
    parts.push(
      lineaEtiqueta(et('fechaPedido'), censurar(formatFecha(fechaPedido), v.fechaPedido))
    );
    parts.push(
      lineaEtiqueta(et('fechaPago'), censurar(formatFecha(fechaPago), v.fechaPago))
    );
    parts.push(lineaEtiqueta(et('mesero'), censurar(nombreMozo, v.mesero)));
    parts.push(lineaEtiqueta('Moneda', 'Soles'));
    parts.push(lineaEtiqueta(et('mesa'), censurar(String(numMesa), v.mesa)));
    if (observaciones) {
      parts.push(
        lineaEtiqueta(et('observaciones'), censurar(observaciones, v.observacion))
      );
    }
    parts.push(divider());
  }

  if (b.mostrarDetalleProductos) {
    parts.push(texto(padLine('Producto', 'Cant. P.Unit Total'), 'em="true"'));

    const agregarPlato = (nombre, cantidad, precio, subtotalPlato, complementos = []) => {
      parts.push(
        texto(
          padLine(
            `${cantidad} ${nombre}`.slice(0, 26),
            `${simboloMoneda} ${subtotalPlato.toFixed(2)}`
          )
        )
      );
      complementos.forEach((comp) => {
        const opcionStr = Array.isArray(comp.opcion)
          ? comp.opcion.join(', ')
          : comp.opcion || comp.nombre || '';
        const extra = comp.precio > 0 ? ` +${comp.precio.toFixed(2)}` : '';
        parts.push(texto(`  └ ${opcionStr}${extra}`));
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
    parts.push(divider());
  }

  if (b.mostrarTotales && v.totales !== false) {
    parts.push(texto(padLine('Subtotal:', `${simboloMoneda} ${subtotalFinal.toFixed(2)}`), 'align="right"'));
    if (p.campos?.mostrarIGV) {
      parts.push(
        texto(
          padLine(`${nombreImpuesto} (${igvPorcentaje}%):`, `${simboloMoneda} ${igvFinal.toFixed(2)}`),
          'align="right"'
        )
      );
    }
    if (descuentosComandas.length > 0) {
      parts.push(
        texto(
          padLine('Descuento:', `-${simboloMoneda} ${montoTotalDescuento.toFixed(2)}`),
          'align="right"'
        )
      );
    }
    parts.push(
      texto(
        `${et('total')}: ${simboloMoneda} ${totalFinal.toFixed(2)}`,
        'align="right" width="2" height="1"'
      )
    );
    parts.push(texto(`Son: ${numeroALetras(totalFinal)}`));
  }

  parts.push(lineaEtiqueta('Pago', metodoPagoLabelBoucher));
  if (boucher?.metodoPago === 'efectivo' && boucher?.montoRecibido != null) {
    parts.push(texto(`Recibido: ${simboloMonedaCobro} ${Number(boucher.montoRecibido).toFixed(2)}`, 'align="right"'));
    parts.push(texto(`Vuelto: ${simboloMonedaCobro} ${Number(boucher.vuelto ?? 0).toFixed(2)}`, 'align="right" em="true"'));
  }

  if (b.mostrarDatosCliente) {
    parts.push(divider());
    parts.push(lineaEtiqueta(et('cliente'), censurar(nombreCliente, v.cliente)));
    parts.push(lineaEtiqueta('DNI', censurar(dniCliente, v.dniCliente)));
  }

  if (b.mostrarAgradecimiento) {
    parts.push(divider());
    parts.push(texto(p.mensajes?.agradecimiento || 'Gracias por su preferencia', 'align="center" em="true"'));
    if (p.mensajes?.urlConsulta) {
      parts.push(texto(`Consulte en: ${p.mensajes.urlConsulta}`, 'align="center"'));
    }
  }

  if (p.campos?.mostrarBloquePromo) {
    parts.push(divider());
    parts.push(texto(p.promo?.titulo || '', 'align="center" em="true"'));
    if (p.promo?.mensaje) {
      parts.push(texto(p.promo.mensaje, 'align="center"'));
    }
    if (p.campos?.mostrarQR && boucher?.voucherId) {
      parts.push(`<symbol type="qrcode" level="level_l" width="3" height="3">${escapeXml(boucher.voucherId)}</symbol>`);
    }
  }

  parts.push('<feed unit="12"/>');
  parts.push('<cut type="feed"/>');
  parts.push('</epos-print>');

  return parts.join('');
}
