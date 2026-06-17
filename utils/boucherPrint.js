/**
 * PDF ticket 80mm para expo-print + Epson TM-m30II / TM Print Assistant.
 * Ancho fijo 80mm @ 72 PPI; altura dinámica según contenido (evita rollo en blanco).
 */
export const BOUCHER_PDF_WIDTH_PX = Math.round((80 / 25.4) * 72);

const CHARS_POR_LINEA = 26;
const PADDING_INFERIOR_PX = 16;

const contarLineasTexto = (texto = '', charsPorLinea = CHARS_POR_LINEA) =>
  Math.max(1, Math.ceil(String(texto || '').length / charsPorLinea));

/**
 * Estima la altura del PDF en px (72 PPI) para que la página termine cerca del contenido.
 */
export function estimarAlturaPdfBoucher({
  boucher = null,
  comandas = [],
  plantilla,
  observaciones = '',
}) {
  const p = plantilla;
  const b = p.bloques || {};
  const e = p.espaciado || {};
  const lineH = Math.max(
    Number(e.lineHeight) || 16,
    Math.round(Math.max(Number(e.tamanoFuente) || 11, 12) * 1.35)
  );
  const dividerLines = (Number(e.espacioDivider) || 8) / lineH;

  let lines = 1;

  if (b.mostrarEncabezado) {
    lines += p.logo ? 5 : 4;
    lines += 2;
    lines += dividerLines * 2;
  }

  if (b.mostrarDatosPedido) {
    lines += 6;
    if (observaciones) lines += contarLineasTexto(observaciones, 24);
    lines += dividerLines;
  }

  if (b.mostrarDetalleProductos) {
    lines += 1;
    const usarBackend = boucher?.platos?.length > 0;

    const sumarPlato = (nombre, complementos = []) => {
      lines += contarLineasTexto(nombre);
      lines += complementos.length;
    };

    if (usarBackend) {
      boucher.platos.forEach((item) => {
        sumarPlato(item.nombre, item.complementosSeleccionados || []);
      });
    } else {
      comandas.forEach((comanda) => {
        (comanda.platos || []).forEach((platoItem) => {
          const plato = platoItem.plato || platoItem;
          sumarPlato(plato.nombre, platoItem.complementosSeleccionados || []);
        });
      });
    }
    lines += dividerLines;
  }

  if (b.mostrarTotales) {
    lines += 5;
    const hayDescuento =
      (boucher?.montoDescuento || 0) > 0 ||
      (boucher?.descuentos?.length || 0) > 0;
    if (hayDescuento) lines += 1;
  }

  lines += 1;

  if (b.mostrarDatosCliente) {
    lines += 2 + dividerLines;
  }

  if (b.mostrarAgradecimiento) {
    lines += 2 + dividerLines;
  }

  if (p.campos?.mostrarBloquePromo) {
    lines += 2;
    if (p.promo?.mensaje) lines += 1;
    if (p.campos.mostrarQR) {
      const qrSize = Math.max(40, Math.min(120, p.promo?.qrTamano || 70));
      lines += Math.ceil(qrSize / lineH) + 1;
    }
    lines += dividerLines;
  }

  const altura = Math.ceil(lines * lineH) + PADDING_INFERIOR_PX;
  return Math.max(260, Math.min(altura, 1800));
}

export function envolverHtmlBoucherTicket(html, { fontSizeBase, lineHeightBase }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=${BOUCHER_PDF_WIDTH_PX}, initial-scale=1.0, maximum-scale=1.0"><title>Voucher</title>
<style>
@page{size:80mm auto;margin:0;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${BOUCHER_PDF_WIDTH_PX}px;max-width:${BOUCHER_PDF_WIDTH_PX}px;margin:0;padding:0;overflow:visible;}
body{font-family:Arial,Helvetica,sans-serif;font-size:${fontSizeBase}px;line-height:${lineHeightBase}px;padding:4px 2px;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style></head><body>${html}</body></html>`;
}
