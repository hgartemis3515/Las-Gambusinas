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

/** Caja de mesa: el destello pinta este View nativo (no Reanimated) para no quedar en blanco. */
export function MesaDestelloCaja({ on, colorBase, size, borderRadius = 8, children, style }) {
  const { prefs, fase } = useAlertaSalio();
  const destello = on && prefs?.estilo !== 'apagado';
  const bg = destello ? fondoAlertaSalio(prefs, fase) : colorBase;
  return (
    <View
      key={`mesa-destello-${bg}-${fase}`}
      collapsable={false}
      style={[
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderRadius,
          overflow: 'hidden',
          elevation: 0,
        },
        style,
      ]}
    >
      {destello ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: bg, zIndex: 0 }]}
        />
      ) : null}
      <View collapsable={false} style={{ flex: 1, zIndex: 1, backgroundColor: 'transparent' }}>
        {children}
      </View>
    </View>
  );
}
