/**
 * ePOS-Print por HTTP a una Epson en la red (TM-m30II / TM-m30III).
 * POST http://<ip>/cgi-bin/epos/service.cgi?devid=local_printer
 */

const EPOS_NS = 'http://www.epson-pos.com/schemas/2011/03/epos-print';
const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

const MENSAJES = {
  EPTR_REC_EMPTY: 'Sin papel.',
  EPTR_COVER_OPEN: 'Tapa abierta.',
  EPTR_CUTTER: 'Error del cortador.',
  EX_TIMEOUT: 'La impresora no respondió.',
  ERROR_WAIT_EJECT: 'Retira el papel de la salida.',
};

export function envolverSoapEpos(xmlEpos) {
  const inner = String(xmlEpos || '').trim();
  if (/Envelope/i.test(inner)) return inner;
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="${SOAP_NS}"><s:Body>${inner}</s:Body></s:Envelope>`
  );
}

export function xmlPruebaEpos(etiqueta) {
  const safe = String(etiqueta || 'PRUEBA').replace(/[<>&]/g, '');
  return (
    `<epos-print xmlns="${EPOS_NS}">` +
    `<text align="center" width="2" height="2">${safe}&#10;</text>` +
    `<feed line="3"/><cut type="feed"/>` +
    `</epos-print>`
  );
}

function mensajeFallo(code, status) {
  if (code && MENSAJES[code]) return MENSAJES[code];
  if (code) return `La impresora rechazó el ticket (${code}).`;
  return `La impresora no aceptó el ticket (${status}).`;
}

function mensajeRed(error) {
  const msg = String(error?.message || '');
  if (error?.name === 'AbortError' || /aborted/i.test(msg)) {
    return 'La impresora no respondió a tiempo.';
  }
  if (/network request failed|failed to connect|network error|timed out/i.test(msg)) {
    return 'No se alcanzó la impresora. Revisa la IP y que esté en la misma red.';
  }
  return msg || 'No se pudo imprimir.';
}

/**
 * @param {string} ip
 * @param {string} xmlEpos fragmento <epos-print>…</epos-print>
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function imprimirEposEnIp(ip, xmlEpos, opts = {}) {
  const host = String(ip || '').trim();
  if (!host) {
    throw new Error('Sin IP.');
  }
  const timeoutMs = opts.timeoutMs || 10000;
  const url =
    `http://${host}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=${timeoutMs}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs + 2000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '""',
        'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
      },
      body: envolverSoapEpos(xmlEpos),
      signal: ctrl.signal,
    });
    const text = await res.text();
    const ok = /success\s*=\s*["']true["']/i.test(text);
    if (!res.ok || !ok) {
      const code = (text.match(/code\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      throw new Error(mensajeFallo(code, res.status));
    }
    return { ok: true };
  } catch (error) {
    if (error?.message && MENSAJES && /impresora|Sin papel|Tapa abierta|cortador|Retira el papel/i.test(error.message)) {
      throw error;
    }
    throw new Error(mensajeRed(error));
  } finally {
    clearTimeout(timer);
  }
}
