/**
 * Alerta Service — App Mozos
 * Cliente para recibir alertas operativas (overlay banner).
 * Reusa apiConfig + authToken.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/apiConfig';

const AUTH_TOKEN_KEY = 'authToken';

export async function getAuthToken() {
  return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getAlertasActivas() {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint('/alertas/activas');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function ackAlerta(alertaId) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/alertas/${alertaId}/ack`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}
