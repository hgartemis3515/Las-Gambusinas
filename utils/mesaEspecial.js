export function esMesaEspecial(mesa) {
  return mesa?.especial === true;
}

export function etiquetaMesa(mesa) {
  const nombre = String(mesa?.nombreMesa || '').trim();
  if (nombre) return nombre;
  const comb = String(mesa?.nombreCombinado || '').trim();
  if (comb) return comb;
  const propio = String(mesa?.nombre || '').trim();
  if (propio) return propio;
  if (mesa?.nummesa != null && mesa.nummesa !== '') return `M${mesa.nummesa}`;
  return 'Mesa';
}

export function esMesaInvitados(mesa) {
  return String(mesa?.nombreMesa || '').trim().toLowerCase() === 'invitados';
}

export function mesaSoloAdmin(mesa) {
  if (esMesaInvitados(mesa)) return false;
  return esMesaEspecial(mesa) && mesa?.funcionesEspeciales?.soloAdmin === true;
}

export function mesaPermiteDescuentoAdmin(mesa) {
  return esMesaEspecial(mesa) && mesa?.funcionesEspeciales?.permiteDescuentoAdmin === true;
}

export function coloresBarraEspecial(mesa) {
  if (!esMesaEspecial(mesa) && !esMesaInvitados(mesa)) return null;
  const ok = (v, fallback) => (/^#[0-9A-Fa-f]{6}$/.test(String(v || '')) ? v : fallback);
  return [
    ok(mesa?.barraEspecial?.colorA, '#D4AF37'),
    ok(mesa?.barraEspecial?.colorB, '#7A1F2B'),
  ];
}

export function mesaBloqueada(mesa) {
  const invitados = esMesaInvitados(mesa);
  if (!esMesaEspecial(mesa) && !invitados) return false;
  const f = mesa?.funcionesEspeciales || {};
  if (!invitados && !f.requiereAutorizacion && !f.bloquearAlPagoTotal) return false;
  if (!mesa.usoEspecial || mesa.usoEspecial.bloqueada == null) return true;
  return mesa.usoEspecial.bloqueada === true;
}
