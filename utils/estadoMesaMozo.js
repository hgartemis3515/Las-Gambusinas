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
  const e = String(estado || '').toLowerCase().trim();
  const pal = theme?.colors?.mesaEstado || {};
  switch (e) {
    case 'libre':
      return pal.libre || '#9E9E9E';
    case 'esperando':
      return pal.esperando || '#FFC107';
    case 'pedido':
    case 'en_espera':
      return pal.pedido || '#2196F3';
    case 'preparado':
    case 'recoger':
    case 'salio':
      return pal.preparado || '#FFC107';
    case 'entregado':
      return pal.entregado || '#00C851';
    case 'pagando':
      return pal.pagando || '#00C851';
    case 'pendiente_aprobar':
    case 'pendiente de aprobación':
    case 'espera...':
    case 'espera':
      return pal.pendiente_aprobar || '#FF9800';
    case 'pagado':
      return pal.pagado || '#2E7D32';
    case 'pendiente_pago':
    case 'pendiente de pago':
      return pal.pendiente_pago || '#FF9800';
    case 'reportado':
      return pal.reportado || '#F44336';
    case 'reservado':
      return pal.reservado || '#9C27B0';
    default:
      return pal.libre || '#9E9E9E';
  }
}

export function etiquetaEstadoMesa(estado) {
  const e = String(estado || 'libre').toLowerCase().trim();
  if (e === 'espera...' || e === 'espera') return 'Espera...';
  if (e === 'pendiente_aprobar' || e === 'pendiente de aprobación') return 'Pendiente de aprobación';
  if (e === 'pendiente_pago' || e === 'pendiente de pago') return 'Pendiente de pago';
  if (e === 'recoger' || e === 'salio') return 'Preparado';
  if (e === 'en_espera') return 'Pedido';
  const map = {
    libre: 'Libre',
    esperando: 'Esperando',
    pedido: 'Pedido',
    preparado: 'Preparado',
    entregado: 'Entregado',
    pagando: 'Pagando',
    pagado: 'Pagado',
    reportado: 'Reportado',
    reservado: 'Reservado',
  };
  if (map[e]) return map[e];
  if (!e) return 'Libre';
  return e.charAt(0).toUpperCase() + e.slice(1).replace(/_/g, ' ');
}
