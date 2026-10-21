import { Alert } from 'react-native';
import axios from 'axios';
import { obtenerConfiguracion, getMozoAuthHeaders } from '../services/configuracionService';
import apiConfig from '../config/apiConfig';
import { getFallbackApiBase } from '../config/envDefaults';
import { datosImpresionTicket } from './comandaMozoEposXml';
import { xmlImagenEpos, xmlDosImagenesEpos } from './ticketRasterCocina';
import { leerImpresorasTermicas } from '../config/impresorasTermicas';
import { imprimirEposEnIp } from './eposPrintHttp';
import { imprimirBoucherTmAssistant, buildTmPrintAssistantUrl } from './boucherTmPrint';

const IP_COCINA_PRUEBA = '192.168.50.228';
const IP_CAJA_PRUEBA = '192.168.50.150';

async function imprimirEposPorServidor(ip, xml) {
  const url = apiConfig.isConfigured && apiConfig.getEndpoint
    ? apiConfig.getEndpoint('/impresion/epos')
    : `${getFallbackApiBase()}/impresion/epos`;
  const headers = await getMozoAuthHeaders();
  const res = await axios.post(url, { ip, xml }, {
    timeout: 20000,
    headers,
    validateStatus: () => true,
  });
  if (res.status >= 200 && res.status < 300 && res.data?.ok === true) return;
  throw new Error(res.data?.message || `No se alcanzó la impresora ${ip}.`);
}

export function platosPlanosParaTicket(comandas) {
  const platos = [];
  for (const comanda of comandas || []) {
    (comanda?.platos || []).forEach((platoItem, index) => {
      if (!platoItem) return;
      const plato = platoItem.plato && typeof platoItem.plato === 'object' ? platoItem.plato : {};
      platos.push({
        _id: platoItem._id,
        nombre: platoItem.nombreCocinaPedido || plato.nombreCocina || plato.nombre || platoItem.nombre || 'Plato',
        cantidad: comanda.cantidades?.[index] || platoItem.cantidad || 1,
        estado: platoItem.estado || 'pedido',
        tipoServicio: platoItem.tipoServicio || 'mesa',
        precio: platoItem.precioUnitario != null ? Number(platoItem.precioUnitario) : (Number(plato.precio) || 0),
        comandaId: comanda._id,
        eliminado: platoItem.eliminado === true,
        anulado: platoItem.anulado === true,
        guarnicionesCambio: platoItem.guarnicionesCambio || null,
        plato,
      });
    });
  }
  return platos;
}

function fechaTicket(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Foto del backend (productos) → el mismo cuerpo que imprime el mozo. */
export function datosRasterDesdeTicket(datos) {
  const d = datos || {};
  const productos = d.platos || d.productos || [];
  return {
    letrero: d.comandaNumeroDisplay || d.letrero || '#—',
    mozo: d.mozo || '',
    mesa: d.mesa || '—',
    fecha: d.fecha || fechaTicket(d.fechaPedido),
    clienteNombre: d.clienteNombre || '',
    sinMesa: d.sinMesa === true,
    reserva: d.reserva === true,
    fechaAtencion: d.fechaAtencion || '',
    esPrueba: d.esPrueba === true,
    sinTotal: d.sinTotal === true,
    anulacion: d.sinTotal ? null : (d.anulacion || null),
    descuentoMonto: d.sinTotal ? 0 : (Number(d.montoDescuento ?? d.descuentoMonto) || 0),
    descuentoMotivo: d.sinTotal ? '' : (d.descuentoMotivo || d.descuentos?.[0]?.motivo || ''),
    simbolo: d.simbolo || 'S/.',
    platos: productos.map((p) => {
      const cant = Number(p.cant ?? p.cantidad) || 1;
      const unit = Number(p.unit ?? p.precio ?? p.precioUnitario) || 0;
      return {
        cant,
        nombre: p.nombre || 'Plato',
        unit,
        line: Number(p.line ?? p.subtotal) || Number((cant * unit).toFixed(2)),
        tipoServicio: p.tipoServicio || 'mesa',
        guarnicionesCambio: p.guarnicionesCambio || null,
        lineaAnulada: p.lineaAnulada || null,
      };
    }),
  };
}

async function imprimirRasterListo({ rasterizar, datos, esPrueba }) {
  let detenerCaja = false;
  let detenerCocina = false;
  try {
    const url = apiConfig.isConfigured && apiConfig.getEndpoint
      ? apiConfig.getEndpoint('/configuracion/impresion-automatica')
      : `${getFallbackApiBase()}/configuracion/impresion-automatica`;
    const headers = await getMozoAuthHeaders();
    const res = await axios.get(url, { timeout: 5000, headers, validateStatus: () => true });
    if (res.status === 200 && res.data) {
      detenerCaja = res.data.detenerImpresionCaja === true;
      detenerCocina = res.data.detenerImpresionCocina === true;
    } else {
      const sistema = await obtenerConfiguracion(true);
      detenerCaja = sistema?.cocina?.detenerImpresionCaja === true;
      detenerCocina = sistema?.cocina?.detenerImpresionCocina === true;
    }
  } catch {
    detenerCaja = false;
    detenerCocina = false;
  }
  const forzarAmbas = esPrueba === true;
  if (forzarAmbas) {
    detenerCaja = false;
    detenerCocina = false;
  }
  if (detenerCaja && detenerCocina) return;
  try {
    const mozo = detenerCaja ? null : await rasterizar({ ...datos, cocina: false });
    const cocinaImg = detenerCocina ? null : await rasterizar({ ...datos, cocina: true });
    const cfg = await leerImpresorasTermicas();
    let ipCaja = String(cfg?.caja?.ip || '').trim();
    let ipCocina = String(cfg?.cocina?.ip || '').trim();
    if (forzarAmbas) {
      ipCaja = IP_CAJA_PRUEBA;
      ipCocina = IP_COCINA_PRUEBA;
    }
    if (!ipCaja && !ipCocina) {
      if (mozo && cocinaImg) {
        const junto = xmlDosImagenesEpos(mozo, cocinaImg);
        if (buildTmPrintAssistantUrl(junto).length <= 190 * 1024) {
          await imprimirBoucherTmAssistant(junto);
          return;
        }
      }
      if (mozo) await imprimirBoucherTmAssistant(xmlImagenEpos(mozo));
      if (mozo && cocinaImg) await new Promise((r) => setTimeout(r, 700));
      if (cocinaImg) await imprimirBoucherTmAssistant(xmlImagenEpos(cocinaImg));
      return;
    }
    const trabajos = [];
    if (ipCaja && mozo) trabajos.push({ nombre: 'Caja', ip: ipCaja, xml: xmlImagenEpos(mozo) });
    if (ipCocina && cocinaImg) trabajos.push({ nombre: 'Cocina', ip: ipCocina, xml: xmlImagenEpos(cocinaImg) });
    const resultados = await Promise.all(trabajos.map(async (job) => {
      try {
        if (forzarAmbas) {
          try {
            await imprimirEposPorServidor(job.ip, job.xml);
          } catch {
            await imprimirEposEnIp(job.ip, job.xml);
          }
        } else {
          await imprimirEposEnIp(job.ip, job.xml);
        }
        return { ...job, ok: true };
      } catch (e) {
        return { ...job, ok: false, error: e?.message || 'Error' };
      }
    }));
    const lineas = [];
    if (!ipCaja && !detenerCaja) lineas.push('Caja sin IP: no salió el ticket de precios.');
    if (!ipCocina && !detenerCocina) lineas.push('Cocina sin IP: no salió el ticket de cocina.');
    resultados.forEach((r) => {
      if (!r.ok) lineas.push(`${r.nombre} (${r.ip}): ${r.error}`);
    });
    if (lineas.length) Alert.alert('Impresión', lineas.join('\n'));
  } catch (err) {
    Alert.alert('Error', err?.message || 'No se pudo armar el ticket.');
  }
}

/** Ticket de caja y ticket de cocina. Avisa solo si falta IP o falla una impresora. */
export async function imprimirTicketsMozoYCocina({
  rasterizar,
  comandas,
  platos,
  mesa = null,
  incluirPagados = false,
  configMoneda = null,
}) {
  const datos = datosImpresionTicket({
    comandas,
    platos,
    mesa,
    incluirPagados,
    configMoneda,
  });
  if (!datos.ok) {
    Alert.alert('Sin platos', 'No hay platos para imprimir.');
    return;
  }
  if (typeof rasterizar !== 'function') {
    Alert.alert('Error', 'No se pudo preparar la impresión.');
    return;
  }
  const esPrueba = (comandas || []).some((c) => c?.esPrueba === true) || datos.esPrueba === true;
  await imprimirRasterListo({ rasterizar, datos, esPrueba });
}

/** Imprime una foto ya armada (eliminados o una letra del historial). */
export async function imprimirDatosTicketMozo({ rasterizar, datos }) {
  if (typeof rasterizar !== 'function') return;
  const listo = datosRasterDesdeTicket(datos);
  if (!listo.platos.length && !listo.anulacion) return;
  await imprimirRasterListo({ rasterizar, datos: listo, esPrueba: listo.esPrueba === true });
}

/** Los dos papeles de una baja: eliminados y lo que queda. */
export async function imprimirParejaBajaMozo({ rasterizar, ticketsBaja }) {
  if (ticketsBaja?.eliminados?.datos) {
    await imprimirDatosTicketMozo({ rasterizar, datos: ticketsBaja.eliminados.datos });
  }
  if (ticketsBaja?.restantes?.datos) {
    await imprimirDatosTicketMozo({ rasterizar, datos: ticketsBaja.restantes.datos });
  }
}
