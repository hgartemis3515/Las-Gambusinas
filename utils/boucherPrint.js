/**
 * PDF ticket 80mm para expo-print / compartir.
 * Ancho fijo 226 pt (80 mm @ 72 PPI); alto dinámico según ítems del pedido.
 */
export const BOUCHER_PAPER_MM = 80;
/** Ancho fijo ticketera 80 mm en puntos PDF (72 PPI). */
export const PUNTOS_ANCHO = 226;
export const BOUCHER_PDF_WIDTH_PX = PUNTOS_ANCHO;

/** Altura base estimada: encabezado + datos pedido + totales + pie. */
export const ALTURA_BASE_PDF = 320;
/** Puntos adicionales por cada fila de producto (incluye complementos). */
export const ALTURA_POR_FILA_PDF = 45;

export const PADDING_INFERIOR_PX = 4;

const ALTURA_MINIMA_PX = 200;

/**
 * Cuenta filas del detalle de productos (platos + líneas de complementos).
 */
export function contarFilasProductoBoucher({ boucher = null, comandas = [] }) {
  let filas = 0;

  if (boucher?.platos?.length > 0) {
    boucher.platos.forEach((item) => {
      filas += 1;
      filas += (item.complementosSeleccionados || []).length;
    });
    return filas;
  }

  comandas.forEach((comanda) => {
    (comanda.platos || []).forEach((platoItem) => {
      filas += 1;
      filas += (platoItem.complementosSeleccionados || []).length;
    });
  });

  return filas;
}

/**
 * Calcula el alto del lienzo PDF: base fija + puntos por cada fila de producto.
 */
export function calcularAltoPdfDinamico({ boucher = null, comandas = [], plantilla } = {}) {
  const filas = contarFilasProductoBoucher({ boucher, comandas });
  let alto = ALTURA_BASE_PDF + filas * ALTURA_POR_FILA_PDF;

  const p = plantilla || {};
  if (p.logo) alto += 40;
  if (p.campos?.mostrarBloquePromo && p.campos?.mostrarQR) {
    alto += Math.max(40, Math.min(120, p.promo?.qrTamano || 70));
  }

  return Math.max(ALTURA_MINIMA_PX, Math.ceil(alto));
}

/**
 * Estima la altura del PDF en px (72 PPI) — respaldo cuando no hay conteo de filas.
 */
export function estimarAlturaPdfBoucher({
  boucher = null,
  comandas = [],
  plantilla,
  observaciones = '',
}) {
  return calcularAltoPdfDinamico({ boucher, comandas, plantilla });
}

export const pxToMm = (px) => (px * 25.4) / 72;

/**
 * Envuelve el HTML del ticket para PDF con página de tamaño exacto.
 */
export function envolverHtmlBoucherTicket(html, { fontSizeBase, lineHeightBase, pageHeightPx }) {
  const w = PUNTOS_ANCHO;
  const h = pageHeightPx ? Math.ceil(pageHeightPx) : null;
  const pageSize = h
    ? `${BOUCHER_PAPER_MM}mm ${pxToMm(h).toFixed(2)}mm`
    : `${BOUCHER_PAPER_MM}mm auto`;
  const bodyHeight = h ? `${h}px` : 'auto';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=${w}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title>Voucher</title>
<style>
@page{size:${pageSize};margin:0;}
@media print{
  @page{size:${pageSize};margin:0;}
  html,body{width:${w}px !important;max-width:${w}px !important;margin:0 !important;overflow:hidden !important;}
  body{height:${bodyHeight} !important;padding:4px !important;}
}
*{box-sizing:border-box;}
html{width:${w}px;max-width:${w}px;margin:0;padding:0;overflow:hidden;}
body{margin:0;padding:4px;width:100%;box-sizing:border-box;height:${bodyHeight};max-width:100%;overflow:hidden;font-family:Arial,Helvetica,sans-serif;font-size:${fontSizeBase}px;line-height:${lineHeightBase}px;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
#ticket-root{width:100%;}
table{width:100%;}
.ticket-block{width:100%;}
</style></head><body><div id="ticket-root" class="ticket-block">${html}</div></body></html>`;
}
