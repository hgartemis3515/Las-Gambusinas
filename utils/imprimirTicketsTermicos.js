import { Alert } from 'react-native';
import { obtenerConfiguracion } from '../services/configuracionService';
import { datosImpresionTicket } from './comandaMozoEposXml';
import { xmlImagenEpos, xmlDosImagenesEpos } from './ticketRasterCocina';
import { leerImpresorasTermicas } from '../config/impresorasTermicas';
import { imprimirEposEnIp } from './eposPrintHttp';
import { imprimirBoucherTmAssistant, buildTmPrintAssistantUrl } from './boucherTmPrint';

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
        precio: platoItem.precioUnitario != null ? Number(platoItem.precioUnitario) : (Number(plato.precio) || 0),
        comandaId: comanda._id,
        eliminado: platoItem.eliminado === true,
        anulado: platoItem.anulado === true,
        plato,
      });
    });
  }
  return platos;
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
  let detenerCaja = false;
  let detenerCocina = false;
  try {
    const sistema = await obtenerConfiguracion(true);
    detenerCaja = sistema?.cocina?.detenerImpresionCaja === true;
    detenerCocina = sistema?.cocina?.detenerImpresionCocina === true;
  } catch {
    detenerCaja = false;
    detenerCocina = false;
  }
  if (detenerCaja && detenerCocina) return;
  try {
    const mozo = detenerCaja ? null : await rasterizar({ ...datos, cocina: false });
    const cocinaImg = detenerCocina ? null : await rasterizar({ ...datos, cocina: true });
    const cfg = await leerImpresorasTermicas();
    const ipCaja = String(cfg?.caja?.ip || '').trim();
    const ipCocina = String(cfg?.cocina?.ip || '').trim();
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
        await imprimirEposEnIp(job.ip, job.xml);
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
