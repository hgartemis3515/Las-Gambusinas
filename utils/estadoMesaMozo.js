/**
 * Etiqueta y color de estado de mesa/comanda, alineado a InicioScreen.
 */

const LABELS = {
  libre: 'Libre',
  pedido: 'Pedido',
  preparado: 'Preparado',
  entregado: 'Entregado',
  pagado: 'Pagado',
  pagando: 'Pagando',
  reportado: 'Reportado',
  reservado: 'Reservado',
  pendiente_aprobar: 'Pendiente de aprobación',
  espera: 'Espera...',
};

export function labelEstadoMesaComanda(item) {
  if (!item) return '—';
  const mesa = String(item.mesaEstado || '').toLowerCase();
  const status = String(item.status || '').toLowerCase();
  const platos = Array.isArray(item.platos) ? item.platos.filter((p) => p && p.eliminado !== true && p.anulado !== true) : [];

  if (mesa === 'pendiente_aprobar' || status === 'pendiente_aprobar') return LABELS.pendiente_aprobar;
  if (mesa === 'reportado') return LABELS.reportado;
  if (mesa === 'reservado') return LABELS.reservado;

  const recoger = platos.some((p) => String(p.estado || '').toLowerCase() === 'recoger');
  const enCocina = platos.some((p) => ['pedido', 'en_espera', 'pendiente'].includes(String(p.estado || '').toLowerCase()));
  const todosEntregados = platos.length > 0 && platos.every((p) => ['entregado', 'pagado'].includes(String(p.estado || '').toLowerCase()));

  if (mesa === 'pagado' || mesa === 'pagando') {
    if (enCocina || recoger) return recoger ? LABELS.preparado : LABELS.pedido;
    return mesa === 'pagando' ? LABELS.pagando : LABELS.pagado;
  }

  if (todosEntregados) return LABELS.entregado;
  if (recoger) return LABELS.preparado;
  if (enCocina || mesa === 'pedido' || status === 'en_espera' || status === 'pedido') return LABELS.pedido;
  if (mesa === 'entregado' || status === 'entregado') return LABELS.entregado;
  if (mesa === 'recoger' || status === 'recoger') return LABELS.preparado;

  const raw = mesa || status;
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
}

export function colorEstadoMesa(estado, theme) {
  const e = String(estado || '').toLowerCase();
  const pal = theme?.colors?.mesaEstado || {};
  switch (e) {
    case 'libre': return pal.libre || '#9E9E9E';
    case 'pedido': return pal.pedido || '#2196F3';
    case 'preparado': return pal.preparado || '#FFC107';
    case 'entregado': return pal.entregado || '#00C851';
    case 'pagado': return pal.pagado || '#2E7D32';
    case 'pagando': return pal.pagando || '#00C851';
    case 'pendiente de aprobación':
    case 'espera...': return pal.pendiente_aprobar || '#FF9800';
    case 'reportado': return pal.reportado || '#F44336';
    case 'reservado': return pal.reservado || '#9C27B0';
    default: return pal.pedido || '#2196F3';
  }
}
