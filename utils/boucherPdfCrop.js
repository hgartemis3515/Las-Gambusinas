/**
 * Recorta el PDF generado por expo-print en Android.
 * El motor WebView suele ignorar width/height y deja página Carta/A4;
 * aquí ajustamos MediaBox/CropBox al ticket 80 mm × alto real.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument } from 'pdf-lib';
import { PUNTOS_ANCHO } from './boucherPrint';

const uint8ToBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
};

/**
 * @param {string} uri - URI del PDF temporal de expo-print
 * @param {{ ancho?: number, alto: number }} opts
 * @returns {Promise<string>} URI del PDF recortado
 */
export async function recortarPdfTicket(uri, { ancho = PUNTOS_ANCHO, alto }) {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  while (pdfDoc.getPageCount() > 1) {
    pdfDoc.removePage(pdfDoc.getPageCount() - 1);
  }

  const page = pdfDoc.getPage(0);
  const { width: pageW, height: pageH } = page.getSize();

  const cropW = Math.min(Math.ceil(ancho), Math.ceil(pageW));
  const cropH = Math.min(Math.ceil(alto), Math.ceil(pageH));
  const x = 0;
  const y = Math.max(0, pageH - cropH);

  page.setMediaBox(x, y, cropW, cropH);
  page.setCropBox(x, y, cropW, cropH);
  try {
    page.setTrimBox(x, y, cropW, cropH);
    page.setBleedBox(x, y, cropW, cropH);
  } catch (_) {
    // Algunos visores no usan estas cajas; MediaBox/CropBox bastan.
  }

  const pdfBytes = await pdfDoc.save();
  const outUri = `${FileSystem.cacheDirectory}boucher_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, uint8ToBase64(pdfBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (_) {}

  return outUri;
}
