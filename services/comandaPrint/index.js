/**
 * comandaPrint — Servicio de impresión/compartición de comanda en App Mozos.
 *
 * Reemplaza completamente el antiguo boucherPrint para la UI de mozos.
 * El boucher sigue creándose en backend como registro contable; este servicio
 * solo genera la comanda (plantilla comandaPlantilla) para impresión/compartición.
 *
 * Flujo: Genera PDF nativo 80mm con pdf-lib (igual que boucherPdfNative)
 * y lo comparte vía expo-sharing. En web, abre ventana de impresión con HTML.
 *
 * Regla central del plan:
 *   "En App Mozos, cualquier acción de impresión/compartición que antes
 *    generaba un boucher ahora debe generar una COMANDA."
 */
import { Alert, Platform } from 'react-native';
import { generarHtmlComanda, mapComandaATicket, aplicarComandaNumeroDisplay, formatComandasNumbersLabel } from '../../utils/comandaHtml';
import { compartirComandaPdf } from '../../utils/comandaPdfShare';
import apiConfig from '../../config/apiConfig';

/**
 * Muestra las opciones para imprimir/compartir la comanda (reemplaza mostrarOpcionesBoucher).
 *
 * @param {Object} opts
 * @param {Object} opts.boucher - Boucher creado (registro contable, fuente de datos de pago)
 * @param {Array}  opts.comandas - Comandas afectadas (fuente de datos de platos)
 * @param {Object} opts.mesa - Datos de la mesa
 * @param {Object} opts.plantilla - Plantilla de comanda (opcional, si ya se cargó)
 * @param {Object} opts.configMoneda - Configuración de moneda { simbolo, moneda, decimales }
 * @param {Object} opts.clienteSeleccionado - Cliente seleccionado (opcional)
 * @param {number} opts.total - Total a mostrar
 * @param {Object} opts.etiquetasDefault - Etiquetas por defecto (opcional)
 * @param {Function} opts.onStart - Callback inicio generación
 * @param {Function} opts.onEnd - Callback fin generación
 */
export async function mostrarOpcionesComanda(opts, { onStart, onEnd } = {}) {
  const { boucher, comandas = [], mesa, plantilla: plantillaParam, configMoneda, clienteSeleccionado, total, etiquetasDefault } = opts;

  if (!boucher && (!comandas || comandas.length === 0)) {
    if (onEnd) onEnd();
    return null;
  }

  try {
    if (onStart) onStart();

    // Cargar plantilla de comanda si no se pasa
    let plantilla = plantillaParam;
    if (!plantilla) {
      try {
        const baseURL = apiConfig.isConfigured
          ? apiConfig.getEndpoint('/configuracion/comanda-plantilla')
          : `${apiConfig.getDefaultBaseURL?.() || 'http://localhost:3000/api'}/configuracion/comanda-plantilla`;

        const authHeaders = await getAuthHeaders();
        const response = await fetch(baseURL, { timeout: 15000, headers: authHeaders });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.plantilla) {
            plantilla = data.plantilla;
          }
        }
      } catch (e) {
        console.warn('⚠️ [COMANDA] No se pudo cargar plantilla, usando defaults:', e.message);
      }
    }

    // Construir datos del ticket usando mapComandaATicket
    const primeraComanda = comandas[0];
    let datos = primeraComanda
      ? mapComandaATicket(primeraComanda, boucher, configMoneda)
      : mapComandaATicket(
          { platos: boucher?.platos || [], comandaNumber: boucher?.comandasNumbers?.[0], observaciones: boucher?.observaciones, createdAt: boucher?.fechaPedido || boucher?.fechaPago },
          boucher,
          configMoneda
        );

    // Enriquecer con números agrupados del boucher si hay varias comandas
    const comandasNumbers = boucher?.comandasNumbers
      || comandas.map(c => c.comandaNumber).filter(n => n != null)
      || (datos.comandaNumero ? [datos.comandaNumero] : []);
    datos = aplicarComandaNumeroDisplay({ ...datos, comandasNumbers });

    const serverOrigin = apiConfig.getDefaultBaseURL?.() || 'http://localhost:3000';

    // En web: abrir ventana de impresión con HTML
    if (Platform.OS === 'web') {
      const { html } = generarHtmlComanda({ datos, plantilla: plantilla || {}, serverOrigin });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
      if (onEnd) onEnd();
      return true;
    }

    // En móvil: generar PDF nativo 80mm y compartir (igual que boucherPdfNative)
    const uri = await compartirComandaPdf({ datos, plantilla: plantilla || {}, serverOrigin });
    if (onEnd) onEnd();
    return uri;
  } catch (error) {
    console.error('❌ [COMANDA] Error generando comanda:', error);
    Alert.alert('Error', 'No se pudo generar la comanda');
    if (onEnd) onEnd();
    return null;
  }
}

/**
 * Alias legible — mismo comportamiento que mostrarOpcionesComanda
 */
export async function imprimirComanda(opts, callbacks) {
  return mostrarOpcionesComanda(opts, callbacks);
}

/**
 * Helper para obtener headers de autenticación del mozo.
 */
async function getAuthHeaders() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // No AsyncStorage disponible
  }
  return {};
}