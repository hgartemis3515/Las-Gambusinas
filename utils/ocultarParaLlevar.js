import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ocultarParaLlevar';

export async function leerOcultarParaLlevar() {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function guardarOcultarParaLlevar(activo) {
  try {
    await AsyncStorage.setItem(KEY, activo ? '1' : '0');
  } catch {
    /* la preferencia queda en memoria de esta pantalla */
  }
}
