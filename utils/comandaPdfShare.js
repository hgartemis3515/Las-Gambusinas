/**
 * Compartir comanda como PDF 80mm nativo (pdf-lib, sin expo-print).
 * Reemplaza compartirBoucherPdf para la plantilla de comanda.
 */
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { generarPdfComandaNativo } from './comandaPdfNative';

/**
 * Genera y comparte un PDF de comanda térmica 80mm.
 *
 * @param {Object} opts
 * @param {Object} opts.datos - Datos mapeados de comanda (de mapComandaATicket)
 * @param {Object} opts.plantilla - Plantilla de comanda
 * @param {string} opts.serverOrigin - URL base del servidor (para resolver logo)
 * @returns {Promise<string|null>} URI del PDF o null si falla
 */
export async function compartirComandaPdf(opts) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Error', 'La función de compartir no está disponible en este dispositivo.');
      return null;
    }

    const uri = await generarPdfComandaNativo(opts);

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Comanda #${opts.datos?.comandaNumero || ''}`,
    });
    return uri;
  } catch (error) {
    console.error('[COMANDA] Error compartiendo PDF:', error);
    Alert.alert('Error', 'No se pudo compartir la comanda.');
    return null;
  }
}