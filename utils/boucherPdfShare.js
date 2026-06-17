/**
 * Compartir boucher como PDF 80 mm (pdf-lib nativo, sin expo-print).
 */
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { generarPdfBoucherNativo } from './boucherPdfNative';

/**
 * @param {Object} opts - Mismos parámetros que generarXmlBoucher
 */
export async function compartirBoucherPdf(opts) {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Error', 'La función de compartir no está disponible en este dispositivo.');
      return false;
    }

    const uri = await generarPdfBoucherNativo(opts);

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Compartir boucher',
    });
    return true;
  } catch (error) {
    console.error('[BOUCHER] Error compartiendo PDF:', error);
    Alert.alert('Error', 'No se pudo compartir el boucher.');
    return false;
  }
}
