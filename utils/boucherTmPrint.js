/**
 * Envía un ticket ePOS-Print XML a Epson TM Print Assistant vía URL scheme.
 * Formato oficial (manual Epson v1.15+):
 *   tmprintassistant://tmprintassistant.epson.com/print?ver=1&data-type=eposprintxml&data=...
 */
import { Alert, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

const TM_PRINT_PACKAGE = 'com.epson.tmassistant';
const PLAY_STORE_URL = `market://details?id=${TM_PRINT_PACKAGE}`;
const MAX_URL_LENGTH = 200 * 1024;

/**
 * Construye la URL oficial de TM Print Assistant para XML ePOS-Print.
 * @param {string} xml
 * @returns {string}
 */
export function buildTmPrintAssistantUrl(xml) {
  return (
    'tmprintassistant://tmprintassistant.epson.com/print' +
    `?ver=1&data-type=eposprintxml&data=${encodeURIComponent(xml)}`
  );
}

async function isTmPrintAssistantInstalled() {
  try {
    const icon = await IntentLauncher.getApplicationIconAsync(TM_PRINT_PACKAGE);
    return Boolean(icon && icon.length > 10);
  } catch {
    return false;
  }
}

/**
 * Abre TM Print Assistant. Intent explícito al paquete Epson + fallback Linking.
 * No usamos Linking.canOpenURL: en Android 11+ suele devolver false aunque la app exista.
 */
async function abrirTmPrintAssistant(url) {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: url,
      packageName: TM_PRINT_PACKAGE,
      flags: 1,
    });
    return true;
  } catch (intentError) {
    console.warn('[BOUCHER] Intent TM Print Assistant:', intentError?.message);
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch (linkError) {
    console.warn('[BOUCHER] Linking TM Print Assistant:', linkError?.message);
    return false;
  }
}

/**
 * @param {string} xml Contenido ePOS-Print XML
 * @returns {Promise<boolean>} true si se abrió TM Print Assistant
 */
export async function imprimirBoucherTmAssistant(xml) {
  if (Platform.OS !== 'android') {
    Alert.alert(
      'No disponible',
      'La impresión térmica vía TM Print Assistant solo está disponible en Android.'
    );
    return false;
  }

  if (!xml || typeof xml !== 'string') {
    Alert.alert('Error', 'No se pudo generar el ticket de impresión.');
    return false;
  }

  const url = buildTmPrintAssistantUrl(xml);

  if (url.length > MAX_URL_LENGTH) {
    Alert.alert(
      'Ticket demasiado largo',
      'El boucher supera el límite de 200 KB para impresión directa. Reduzca ítems o contacte al administrador.'
    );
    return false;
  }

  const opened = await abrirTmPrintAssistant(url);
  if (opened) {
    return true;
  }

  const installed = await isTmPrintAssistantInstalled();
  if (!installed) {
    Alert.alert(
      'TM Print Assistant no encontrado',
      'Instale "Epson TM Print Assistant" desde Play Store y configure la impresora Bluetooth.',
      [
        { text: 'Abrir Play Store', onPress: () => Linking.openURL(PLAY_STORE_URL).catch(() => {}) },
        { text: 'OK', style: 'cancel' },
      ]
    );
    return false;
  }

  Alert.alert(
    'Error de impresión',
    'TM Print Assistant está instalado pero no se pudo abrir. Verifique que la impresora esté configurada en la app Epson.'
  );
  return false;
}
