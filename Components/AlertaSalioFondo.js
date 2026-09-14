import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAlertaSalio } from '../context/AlertaSalioContext';
import { fondoAlertaSalio } from '../utils/alertaSalioPrefs';

export function hayPlatoSalio(platos) {
  return (Array.isArray(platos) ? platos : []).some((p) =>
    String(p?.estado || '').toLowerCase() === 'salio' && !p?.anulado && !p?.eliminado
  );
}

function AlertaSalioFondoInner() {
  const { prefs, fase } = useAlertaSalio();
  if (prefs?.estilo === 'apagado') return null;
  const fondo = fondoAlertaSalio(prefs, fase);
  return (
    <View
      key={`alerta-bg-${fondo}-${fase & 1}`}
      pointerEvents="none"
      collapsable={false}
      style={[StyleSheet.absoluteFillObject, { backgroundColor: fondo }]}
    />
  );
}

export default function AlertaSalioFondo({ on }) {
  if (!on) return null;
  return <AlertaSalioFondoInner />;
}
