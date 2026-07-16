/**
 * Chat Service — App Mozos
 * Cliente de mensajería interna (texto + voz) para mozos.
 * Reusa apiConfig + authToken (AsyncStorage) como el resto de la app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/apiConfig';

const AUTH_TOKEN_KEY = 'authToken';

export async function getAuthToken() {
  return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getConversaciones() {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint('/mensajes/conversaciones');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function getMensajesConv(convId, before = null, limit = 50) {
  const token = await getAuthToken();
  let url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/mensajes?limit=${limit}`);
  if (before) url += `&before=${encodeURIComponent(before)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function enviarMensajeTexto(convId, texto, prioridadCodigo = 'normal', respuestaA = null, entidadTipo = null, entidadId = null) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/mensajes`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, prioridadCodigo, respuestaA, entidadTipo, entidadId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function enviarMensajeVoz(convId, audioUri, prioridadCodigo = 'normal', duracionMs = 0) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/mensajes/voz`);
  const fd = new FormData();
  fd.append('audio', { uri: audioUri, name: `voz-${Date.now()}.m4a`, type: 'audio/m4a' });
  fd.append('prioridadCodigo', prioridadCodigo);
  if (duracionMs) fd.append('duracionMs', String(duracionMs));
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    body: fd
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function marcarLeido(convId, mensajeId = null) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/leido`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensajeId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function getNoLeidosCount() {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint('/mensajes/no-leidos/count');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function crearDM(destinatarioId) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint('/mensajes/conversaciones');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'directo', destinatarioId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export function getAudioUrl(relUrl) {
  // audio.url viene como /uploads/mensajes/xxx.m4a
  const baseOrigin = (apiConfig.wsURL || apiConfig.baseURL || '').replace(/^ws/, 'http').replace(/\/api$/, '');
  return `${baseOrigin}${relUrl}`;
}

// === v2: acciones por conversación ===

export async function setSilenciado(convId, silenciado) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/silenciar`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ silenciado })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function setPineado(convId, pineado) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/fijar`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pineado })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function setArchivado(convId, archivado) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/archivar`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ archivado })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function getAnclados(convId) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/anclados`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function anclarMensaje(convId, mensajeId) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/anclar`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensajeId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function desanclarMensaje(convId, mensajeId) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/anclar/${mensajeId}`);
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}

export async function emitTyping(convId, remitenteNombre) {
  const token = await getAuthToken();
  const url = apiConfig.getEndpoint(`/mensajes/conversaciones/${convId}/typing`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ remitenteNombre })
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json());
}