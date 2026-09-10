import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import moment from "moment-timezone";
import { useTheme } from "../context/ThemeContext";
import { themeLight } from "../constants/theme";
import { textoOpcionComplemento } from "../utils/precioComplementos";
import { esFilaComandaSinMesa } from "../utils/sinMesaOrden";

const ZONA = "America/Lima";

const LABEL_STATUS = {
  en_espera: "En espera",
  pedido: "Pedido",
  recoger: "Preparado",
  salio: "Salió",
  entregado: "Entregado",
  pagado: "Pagado",
  pendiente_aprobar: "Pendiente de aprobación",
  completado: "Completado",
  cancelado: "Cancelado",
};

const LABEL_PLATO = {
  pendiente: "Pendiente",
  pedido: "Pedido",
  en_espera: "En cocina",
  recoger: "Preparado",
  salio: "Salió",
  entregado: "Entregado",
  pagado: "Pagado",
};

function fmtHora(d) {
  if (!d) return "—";
  const m = moment(d).tz(ZONA);
  return m.isValid() ? m.format("HH:mm") : "—";
}

function fmtFechaHora(d) {
  if (!d) return "—";
  const m = moment(d).tz(ZONA);
  return m.isValid() ? m.format("DD/MM/YYYY HH:mm") : "—";
}

function labelStatusComanda(c) {
  const st = String(c?.status || "").toLowerCase();
  if (["pagado", "completado"].includes(st) || c?.tiempoPagado) return "Pagado";
  const platos = (c?.platos || []).filter((p) => p && p.eliminado !== true && p.anulado !== true);
  if (platos.length && platos.every((p) => p.pagoAdelantado?.cobrado === true)) {
    return "Pagado (adelantado)";
  }
  return LABEL_STATUS[st] || st || "—";
}

function nombreMesa(c) {
  if (esFilaComandaSinMesa(c) || c?.sinMesa === true) return "Sin mesa";
  const mesa = c?.mesas;
  if (mesa?.nombreCombinado) return String(mesa.nombreCombinado);
  const num = mesa?.nummesa ?? mesa?.numero ?? c?.mesaNumero;
  if (num != null && num !== "") return `Mesa ${num}`;
  return "—";
}

function nombreMozo(c) {
  const m = c?.mozos;
  if (Array.isArray(m)) {
    const n = m.map((x) => x?.name).filter(Boolean).join(", ");
    if (n) return n;
  }
  if (m?.name) return m.name;
  return c?.mozoNombre || "—";
}

function nombrePlato(p) {
  return p?.plato?.nombre || p?.plato?.nombreCocina || p?.nombre || p?.platoNombre || "Plato";
}

function precioPlato(p) {
  return Number(p?.precioUnitario ?? p?.precio ?? p?.plato?.precio) || 0;
}

function cantidadPlato(p, c, i) {
  return Number(p?.cantidad ?? c?.cantidades?.[i] ?? 1) || 1;
}

function labelComplemento(comp) {
  if (!comp) return "";
  const op = textoOpcionComplemento(comp);
  const cant = Number(comp.cantidad) || 1;
  if (!op) return "";
  return `· ${op}${cant > 1 ? ` x${cant}` : ""}`;
}

function InfoRow({ label, value, styles, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function BloqueComanda({ comanda, styles, theme }) {
  const platos = (comanda.platos || []).filter((p) => p && p.eliminado !== true && p.anulado !== true);
  const nPlatos = platos.reduce((s, p, i) => s + cantidadPlato(p, comanda, i), 0);
  const bruto = Number(comanda.totalSinDescuento) > 0
    ? Number(comanda.totalSinDescuento)
    : platos.reduce((s, p, i) => s + precioPlato(p) * cantidadPlato(p, comanda, i), 0);
  const desc = Number(comanda.montoDescuento) || 0;
  const total = Number(comanda.totalCalculado) > 0
    ? Number(comanda.totalCalculado)
    : Math.max(0, bruto - desc);
  const status = labelStatusComanda(comanda);
  const chipColor = status.startsWith("Pagado")
    ? (theme.colors.mesaEstado?.pagado || "#2E7D32")
    : (theme.colors.primary);

  return (
    <View style={styles.bloque}>
      <View style={styles.bloqueHeader}>
        <Text style={styles.bloqueTitle}>
          Comanda #{comanda.comandaNumber ?? String(comanda._id || "").slice(-4)}
        </Text>
        <View style={[styles.statusChip, { backgroundColor: `${chipColor}22` }]}>
          <Text style={[styles.statusChipText, { color: chipColor }]}>{status}</Text>
        </View>
      </View>
      <Text style={styles.subHeader}>
        {nombreMesa(comanda)} — {nombreMozo(comanda)}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Información general</Text>
        <InfoRow styles={styles} label="Creada" value={fmtFechaHora(comanda.createdAt)} />
        <InfoRow styles={styles} label="Enviada a cocina" value={fmtHora(comanda.tiempoEnEspera)} />
        <InfoRow styles={styles} label="Preparada" value={fmtHora(comanda.tiempoRecoger)} />
        <InfoRow styles={styles} label="Entregada" value={fmtHora(comanda.tiempoEntregado)} />
        <InfoRow styles={styles} label="Pagada" value={fmtHora(comanda.tiempoPagado)} />
        <InfoRow styles={styles} label="Observaciones" value={comanda.observaciones || "Sin observaciones"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Platos</Text>
        {platos.length === 0 ? (
          <Text style={styles.emptyPlatos}>Sin platos</Text>
        ) : platos.map((p, i) => {
          const cant = cantidadPlato(p, comanda, i);
          const unit = precioPlato(p);
          const ppa = p.pagoAdelantado?.cobrado === true
            || ["pendiente_aprobacion", "aprobado"].includes(String(p.pagoAdelantado?.estadoTicket || "").toLowerCase());
          const comps = (p.complementosSeleccionados || []).map(labelComplemento).filter(Boolean);
          const estadoP = LABEL_PLATO[String(p.estado || "").toLowerCase()] || p.estado || "—";
          return (
            <View key={String(p._id || i)} style={styles.platoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.platoNombre}>{nombrePlato(p)}</Text>
                {p.tipoServicio === "para_llevar" ? (
                  <Text style={styles.badgeLlevar}>Para llevar</Text>
                ) : null}
                {comps.map((t, ci) => (
                  <Text key={ci} style={styles.compText}>{t}</Text>
                ))}
                {ppa ? (
                  <Text style={styles.badgePpa}>
                    PPA {p.pagoAdelantado?.estadoTicket === "aprobado" ? "aprobado" : "cobrado"}
                  </Text>
                ) : null}
                <Text style={styles.platoMeta}>
                  {estadoP}
                  {p.procesadoPor?.alias || p.procesandoPor?.alias || p.procesandoPor?.nombre
                    ? ` · ${p.procesadoPor?.alias || p.procesandoPor?.alias || p.procesandoPor?.nombre}`
                    : ""}
                </Text>
              </View>
              <View style={styles.platoMontos}>
                <Text style={styles.platoCant}>x{cant}</Text>
                <Text style={styles.platoPrecio}>{formatPendienteCobro(unit * cant)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        {desc > 0 ? (
          <>
            <InfoRow styles={styles} label={`Subtotal (${nPlatos} platos)`} value={formatPendienteCobro(bruto)} />
            <InfoRow styles={styles} label="Descuento" value={`-${formatPendienteCobro(desc)}`} valueColor="#16a34a" />
          </>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL · {nPlatos} platos</Text>
          <Text style={styles.totalValue}>{formatPendienteCobro(total)}</Text>
        </View>
      </View>
    </View>
  );
}

const ModalVerComandaMozo = ({ visible, comandas = [], loading = false, onClose }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const lista = Array.isArray(comandas) ? comandas.filter(Boolean) : [];

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {lista.length > 1 ? `Comandas (${lista.length})` : "Detalle de comanda"}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.text?.white || "#FFF"} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Cargando detalle...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {lista.map((c) => (
                <BloqueComanda key={String(c._id)} comanda={c} styles={styles} theme={theme} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text?.white || "#FFF",
  },
  body: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: theme.colors.text?.secondary || "#888",
  },
  bloque: { gap: 10 },
  bloqueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  bloqueTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text?.primary || "#111",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  subHeader: {
    fontSize: 13,
    color: theme.colors.text?.secondary || "#666",
    marginBottom: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    ...theme.shadows.medium,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: theme.colors.text?.secondary || "#888",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: theme.colors.text?.secondary || "#888",
    fontWeight: "600",
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 13,
    color: theme.colors.text?.primary || "#111",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  platoRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border || "#333",
    gap: 8,
  },
  platoNombre: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text?.primary || "#111",
  },
  platoMeta: {
    fontSize: 11,
    color: theme.colors.text?.secondary || "#888",
    marginTop: 2,
  },
  platoMontos: { alignItems: "flex-end" },
  platoCant: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text?.secondary || "#888",
  },
  platoPrecio: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text?.primary || "#111",
  },
  compText: {
    fontSize: 11,
    fontStyle: "italic",
    color: theme.colors.text?.secondary || "#6B7280",
  },
  badgeLlevar: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: "#8B5CF6",
  },
  badgePpa: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    color: "#16a34a",
  },
  emptyPlatos: {
    color: theme.colors.text?.secondary || "#888",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text?.primary || "#111",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FF9500",
  },
});

export default ModalVerComandaMozo;
