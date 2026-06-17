/**
 * Servicio unificado de boucher: Imprimir (ePOS XML) / Compartir (PDF 80mm).
 */
import { Alert } from 'react-native';
import { generarXmlBoucher } from '../../utils/boucherEposXml';
import { imprimirBoucherTmAssistant } from '../../utils/boucherTmPrint';
import { compartirBoucherPdf } from '../../utils/boucherPdfShare';

/**
 * @param {Object} opts - Datos del boucher (boucher, comandas, mesa, plantilla, etc.)
 * @param {Object} actions
 * @param {() => void} [actions.onStart] - Antes de generar
 * @param {() => void} [actions.onEnd] - Al terminar (finally)
 */
export async function mostrarOpcionesBoucher(opts, { onStart, onEnd } = {}) {
  const boucher = opts.boucher;
  if (!boucher) {
    const comandas = opts.comandas || [];
    if (!comandas.length) return null;
    const conPlatos = comandas.filter((c) => c.platos?.length > 0);
    if (!conPlatos.length) return null;
  }

  try {
    onStart?.();
    const xml = generarXmlBoucher(opts);

    return await new Promise((resolve) => {
      Alert.alert('✅ Boucher Generado', '¿Qué deseas hacer?', [
        {
          text: 'Imprimir',
          onPress: async () => {
            try {
              await imprimirBoucherTmAssistant(xml);
            } catch (error) {
              console.error('Error imprimiendo:', error);
              Alert.alert('Error', 'No se pudo imprimir el boucher');
            }
            resolve(xml);
          },
        },
        {
          text: 'Compartir',
          onPress: async () => {
            try {
              await compartirBoucherPdf(opts);
            } catch (error) {
              console.error('Error compartiendo:', error);
              Alert.alert('Error', 'No se pudo compartir el boucher');
            }
            resolve(xml);
          },
        },
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(xml),
        },
      ]);
    });
  } catch (error) {
    console.error('Error generando boucher:', error);
    Alert.alert('Error', 'No se pudo generar el boucher');
    return null;
  } finally {
    onEnd?.();
  }
}
