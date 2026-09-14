import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAlertaSalio } from '../context/AlertaSalioContext';
import { fondoAlertaSalio } from '../utils/alertaSalioPrefs';

export function hayPlatoSalio(platos) {
  return (Array.isArray(platos) ? platos : []).some((p) =>
    String(p?.estado || '').toLowerCase() === 'salio' && !p?.anulado && !p?.eliminado
  );
}

/** Capa de parpadeo. El hook vive aquí (no en un hijo) para que `fase` pinte sí o sí. */
export default function AlertaSalioFondo({ on }) {
  const { prefs, fase } = useAlertaSalio();
  if (!on || prefs?.estilo === 'apagado') return null;
  const fondo = fondoAlertaSalio(prefs, fase);
  return (
    <View
      key={`alerta-bg-${fondo}-${fase}`}
      pointerEvents="none"
      collapsable={false}
      style={[StyleSheet.absoluteFillObject, { backgroundColor: fondo, zIndex: 0 }]}
    />
  );
}
