import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAlertaSalioFase, useAlertaSalioPrefs } from '../context/AlertaSalioContext';
import { fondoAlertaSalio } from '../utils/alertaSalioPrefs';

export function hayPlatoSalio(platos) {
  return (Array.isArray(platos) ? platos : []).some((p) =>
    String(p?.estado || '').toLowerCase() === 'salio' && !p?.anulado && !p?.eliminado
  );
}

function AlertaSalioFondoActivo() {
  const { prefs } = useAlertaSalioPrefs();
  const fase = useAlertaSalioFase();
  if (prefs?.estilo === 'apagado') return null;
  const fondo = fondoAlertaSalio(prefs, fase);
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[StyleSheet.absoluteFillObject, { backgroundColor: fondo, zIndex: 0 }]}
    />
  );
}

/** Capa de parpadeo. Solo monta el ticker si `on` (plato/fila en salio). */
export default function AlertaSalioFondo({ on }) {
  if (!on) return null;
  return <AlertaSalioFondoActivo />;
}

function MesaDestelloActivo({ colorBase, size, borderRadius, children, style }) {
  const { prefs } = useAlertaSalioPrefs();
  const fase = useAlertaSalioFase();
  const destello = prefs?.estilo !== 'apagado';
  const bg = destello ? fondoAlertaSalio(prefs, fase) : colorBase;
  return (
    <View
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

function FilaDestelloActivo({ style, children }) {
  const { prefs } = useAlertaSalioPrefs();
  const fase = useAlertaSalioFase();
  const destello = prefs?.estilo !== 'apagado';
  const bg = destello ? fondoAlertaSalio(prefs, fase) : undefined;
  return (
    <View collapsable={false} style={[style, destello && { backgroundColor: bg, overflow: 'hidden' }]}>
      {destello ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: bg, zIndex: 0 }]}
        />
      ) : null}
      {children}
    </View>
  );
}

/** Fila de lista (Pendientes): mismo destello que mesa/plato, sin tamaño fijo. */
export function FilaDestelloCaja({ on, style, children }) {
  if (!on) {
    return (
      <View collapsable={false} style={style}>
        {children}
      </View>
    );
  }
  return <FilaDestelloActivo style={style}>{children}</FilaDestelloActivo>;
}

/** Caja de mesa: el destello pinta este View nativo (no Reanimated) para no quedar en blanco. */
export function MesaDestelloCaja({ on, colorBase, size, borderRadius = 8, children, style }) {
  if (!on) {
    return (
      <View
        collapsable={false}
        style={[
          {
            width: size,
            height: size,
            backgroundColor: colorBase,
            borderRadius,
            overflow: 'hidden',
            elevation: 0,
          },
          style,
        ]}
      >
        <View collapsable={false} style={{ flex: 1, zIndex: 1, backgroundColor: 'transparent' }}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <MesaDestelloActivo colorBase={colorBase} size={size} borderRadius={borderRadius} style={style}>
      {children}
    </MesaDestelloActivo>
  );
}
