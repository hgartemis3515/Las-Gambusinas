import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, FlatList, Pressable
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import moment from "moment-timezone";
import { useTheme } from "../context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MotiView, AnimatePresence } from "moti";
import * as Haptics from "expo-haptics";
import { apiConfig } from "../apiConfig";
import { getFallbackApiBase } from "../config/envDefaults";
import configuracionService from "../services/configuracionService";
import ModalComplementos from "../Components/ModalComplementos";
import StepIndicator, { PASOS } from "../Components/reserva/StepIndicator";
import HoraPicker from "../Components/reserva/HoraPicker";

// PLAN_RESERVAS_WIZARD_V2 — Wizard de reserva con mesa preseleccionada,
// selector de hora intuitivo, buscador de platos con complementos y PPA con autorización.
const TZ = "America/Lima";
const getApiUrl = (p) => apiConfig.isConfigured ? apiConfig.getEndpoint(p) : `${getFallbackApiBase()}${p}`;
const haptic = (st = Haptics.ImpactFeedbackStyle.Light) => { try { Haptics.impactAsync(st); } catch (e) {} };

export default function ReservaWizardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const tc = useTheme();
  const theme = tc?.theme || { colors: { background: "#F8F9FA", surface: "#FFFFFF", primary: "#C41E3A", border: "#E0E0E0", secondary: "#00C851", warning: "#FF9500", text: { primary: "#1A1A1A", secondary: "#666666" }, mesaEstado: { reservado: "#9C27B0" } } };
  const cText = theme.colors.text?.primary ?? "#1A1A1A";
  const cMuted = theme.colors.text?.secondary ?? "#666666";
  const cBg = theme.colors.background ?? "#F8F9FA";
  const cSurface = theme.colors.surface ?? "#FFFFFF";
  const cBorder = theme.colors.border ?? "#E0E0E0";
  const cPrimary = theme.colors.primary ?? "#C41E3A";
  const cReservado = theme.colors.mesaEstado?.reservado ?? "#9C27B0";
  const cDanger = "#dc3545";
  const cSuccess = theme.colors.secondary ?? "#00C851";
  const cWarn = theme.colors.warning ?? "#FF9500";

  const [paso, setPaso] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [cocineros, setCocineros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cfg, setCfg] = useState({ minutosAntesCocina: 20, horizonteReservaDias: 7 });
  const [mesaId, setMesaId] = useState(null);
  const [mesaPre, setMesaPre] = useState(null);
  const [mesaPreNoDisponible, setMesaPreNoDisponible] = useState(false);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [numPersonas, setNumPersonas] = useState("2");
  const [fechaReserva, setFechaReserva] = useState(() => moment.tz(TZ).add(1, "hours").startOf("hour").format("YYYY-MM-DDTHH:mm"));
  const [encargadoId, setEncargadoId] = useState(null);
  const [selPlatos, setSelPlatos] = useState([]);
  const [notas, setNotas] = useState("");
  const [ppaActivo, setPpaActivo] = useState(false);
  const [ppaMonto, setPpaMonto] = useState("");
  const [ppaMetodo, setPpaMetodo] = useState("efectivo");
  const [searchPlato, setSearchPlato] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [platoParaComplementar, setPlatoParaComplementar] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [exito, setExito] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const m = route.params?.mesa;
    if (m && m._id) { setMesaPre(m); setMesaId(m._id); }
  }, [route.params?.mesa]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDebounced((searchPlato || "").trim()), 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [searchPlato]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const u = await AsyncStorage.getItem("user");
        if (u) setUserInfo(JSON.parse(u));
        const headers = await configuracionService.getMozoAuthHeaders();
        const mr = await axios.get(getApiUrl(`/reservas/mesas-disponibles-para?fechaReserva=${encodeURIComponent(fechaReserva)}`), { timeout: 5000, headers });
        setMesas(mr.data || []);
        if (route.params?.mesa?._id && !(mr.data || []).find((m) => m._id === route.params.mesa._id)) setMesaPreNoDisponible(true);
        const pr = await axios.get(getApiUrl("/platos"), { timeout: 5000, headers });
        setPlatos((pr.data || []).filter((p) => p.isActive !== false));
        const ur = await axios.get(getApiUrl("/mozos"), { timeout: 5000, headers }).catch(() => null);
        if (ur) setCocineros((ur.data || []).filter((x) => x.rol === "cocinero" || x.rol === "supervisor"));
        try { const c = await axios.get(getApiUrl("/configuracion"), { timeout: 5000, headers }); if (c.data?.reservas) setCfg((prev) => ({ ...prev, ...c.data.reservas })); } catch (e) {}
      } catch (e) { setErrorBanner("No se pudieron cargar los datos. Verifica tu conexión."); }
      finally { setLoading(false); }
    })();
  }, []);

  const recargarMesas = useCallback(async () => {
    try {
      const headers = await configuracionService.getMozoAuthHeaders();
      const r = await axios.get(getApiUrl(`/reservas/mesas-disponibles-para?fechaReserva=${encodeURIComponent(fechaReserva)}`), { timeout: 5000, headers });
      setMesas(r.data || []);
      if (mesaPre && !(r.data || []).find((m) => m._id === mesaPre._id)) setMesaPreNoDisponible(true);
      else setMesaPreNoDisponible(false);
    } catch (e) {}
  }, [fechaReserva, mesaPre]);

  const fechaCocina = useMemo(() => {
    const m = moment.tz(fechaReserva, TZ);
    if (!m.isValid()) return null;
    const off = Number(cfg.minutosAntesCocina) || 20;
    const c = m.clone().subtract(off, "minutes");
    const a = moment.tz(TZ);
    return c.isSameOrBefore(a) ? a : c;
  }, [fechaReserva, cfg.minutosAntesCocina]);

  const inmediato = useMemo(() => {
    const m = moment.tz(fechaReserva, TZ);
    if (!m.isValid()) return false;
    return m.clone().subtract(Number(cfg.minutosAntesCocina) || 20, "minutes").isSameOrBefore(moment.tz(TZ));
  }, [fechaReserva, cfg.minutosAntesCocina]);

  const total = useMemo(() => selPlatos.reduce((a, p) => a + (Number(p.precioUnitario ?? p.precio) || 0) * (parseInt(p.cantidad) || 1), 0), [selPlatos]);

  const categorias = useMemo(() => {
    const set = new Set();
    platos.forEach((p) => { if (p.categoria || p.tipo) set.add(p.categoria || p.tipo); });
    return Array.from(set);
  }, [platos]);

  const platosFiltrados = useMemo(() => {
    const search = (searchDebounced || "").toLowerCase();
    let list = platos;
    if (search.length > 0) list = list.filter((p) => (p.nombre || "").toLowerCase().includes(search));
    else if (categoriaFiltro) list = list.filter((p) => (p.categoria || p.tipo) === categoriaFiltro);
    return list;
  }, [platos, searchDebounced, categoriaFiltro]);

  const puedeAvanzar = useMemo(() => {
    if (paso === 0) return !!mesaId && clienteNombre.trim().length >= 2;
    if (paso === 2) return selPlatos.length > 0;
    if (paso === 3) { if (!ppaActivo) return true; const m = Number(ppaMonto) || 0; return m > 0 && m <= total; }
    return true;
  }, [paso, mesaId, clienteNombre, selPlatos, ppaActivo, ppaMonto, total]);

  const sig = () => { if (!puedeAvanzar) return; haptic(); if (paso === 0) recargarMesas(); setPaso((p) => Math.min(p + 1, PASOS.length - 1)); };
  const ant = () => { haptic(); setPaso((p) => Math.max(p - 1, 0)); };

  // --- Platos con instancias + complementos ---
  const agregarPlato = (plato, complementosSeleccionados = [], notaEspecial = "", precioUnitario = null, extraComplementosV3 = null) => {
    const instanceId = `${plato._id}_${Date.now()}`;
    const pu = precioUnitario != null ? Number(precioUnitario) : Number(plato.precio || 0);
    setSelPlatos((c) => [...c, {
      instanceId, _id: plato._id, nombre: plato.nombre, precio: plato.precio,
      precioUnitario: pu, cantidad: 1, notaEspecial: notaEspecial || "",
      complementosElegidos: complementosSeleccionados || [],
      tipoServicio: "mesa", extraComplementosV3: extraComplementosV3 || null,
    }]);
    haptic();
  };

  const tocarPlato = (plato) => {
    if (plato.complementos && plato.complementos.length > 0) {
      setPlatoParaComplementar(plato);
    } else {
      agregarPlato(plato);
    }
  };

  const handleConfirmarComplementos = ({ complementosSeleccionados, notaEspecial, _precioUnitario, _extraComplementos }) => {
    if (platoParaComplementar) agregarPlato(platoParaComplementar, complementosSeleccionados, notaEspecial, _precioUnitario, _extraComplementos);
    setPlatoParaComplementar(null);
  };

  const cantInstancia = (instanceId, d) => setSelPlatos((c) => c.map((p) => p.instanceId === instanceId ? { ...p, cantidad: Math.max(1, (p.cantidad || 1) + d) } : p));
  const quitarInstancia = (instanceId) => { setSelPlatos((c) => c.filter((p) => p.instanceId !== instanceId)); haptic(); };
  const notaInstancia = (instanceId, t) => setSelPlatos((c) => c.map((p) => p.instanceId === instanceId ? { ...p, notaEspecial: t } : p));

  const saldoPendiente = useMemo(() => Math.max(0, total - (Number(ppaMonto) || 0)), [total, ppaMonto]);

  const confirmar = async () => {
    if (!userInfo?._id) { Alert.alert("Error", "No hay sesión de mozo"); return; }
    setSubmitting(true);
    setErrorBanner(null);
    try {
      const headers = await configuracionService.getMozoAuthHeaders();
      const payload = {
        mesa: mesaId, mozo: userInfo._id,
        clienteNombre: clienteNombre.trim(), clienteTelefono: clienteTelefono.trim() || null,
        numPersonas: parseInt(numPersonas) || 2,
        fechaReserva: moment.tz(fechaReserva, TZ).toISOString(),
        platos: selPlatos.map((p) => ({
          plato: p._id, cantidad: p.cantidad, tipoServicio: p.tipoServicio || "mesa",
          notaEspecial: p.notaEspecial || "",
          complementosElegidos: p.complementosElegidos || [],
          precioUnitario: p.precioUnitario ?? p.precio,
        })),
        notas: notas.trim() || null, cocineroEncargado: encargadoId || null,
        pagoAdelantado: ppaActivo ? { activo: true, montoPagado: Number(ppaMonto) || 0, metodoPago: ppaMetodo } : { activo: false }
      };
      const r = await axios.post(getApiUrl("/reservas/desde-mozos"), payload, { timeout: 10000, headers });
      const adelanto = ppaActivo ? (Number(ppaMonto) || 0) : 0;
      setExito({
        mesa: mesas.find((m) => m._id === mesaId)?.nummesa ?? mesaPre?.nummesa ?? "—",
        hora: moment.tz(fechaReserva, TZ).format("DD/MM HH:mm"),
        cocina: fechaCocina ? fechaCocina.format("DD/MM HH:mm") : "—",
        adelanto, saldo: Math.max(0, total - adelanto),
        inmediato, ppa: ppaActivo, metodo: ppaMetodo,
      });
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Error al crear la reserva";
      setErrorBanner(msg);
    } finally { setSubmitting(false); }
  };

  const s = makeStyles(theme);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={cText} />
          </TouchableOpacity>
          <Text style={s.title}>Reservar</Text>
        </View>
        <View style={s.body}>
          <View style={s.skelCard}><View style={s.skelLine} /><View style={s.skelLine} /><View style={s.skelLine} /></View>
          <View style={s.skelCard}><View style={s.skelLine} /><View style={s.skelLine} /></View>
          <Text style={s.muted}>Cargando mesas y platos…</Text>
        </View>
      </View>
    );
  }

  if (exito) {
    return (
      <View style={s.container}>
        <View style={s.exitoWrap}>
          <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }} style={s.exitoIcon}>
            <MaterialCommunityIcons name="check-circle" size={64} color={cSuccess} />
          </MotiView>
          <Text style={s.exitoTitle}>Reserva creada</Text>
          <Text style={s.exitoSub}>Mesa #{exito.mesa} · {exito.hora}</Text>
          <View style={s.exitoCard}>
            <View style={s.exitoRow}><MaterialCommunityIcons name="fire" size={16} color={cWarn} /><Text style={s.exitoLine}>Cocina: {exito.cocina}</Text></View>
            {exito.ppa ? (
              <>
                <View style={s.exitoRow}><MaterialCommunityIcons name="cash-multiple" size={16} color={cPrimary} /><Text style={s.exitoLine}>Adelanto: S/ {exito.adelanto.toFixed(2)} ({exito.metodo})</Text></View>
                <View style={s.exitoRow}><MaterialCommunityIcons name="clock-alert-outline" size={16} color={cMuted} /><Text style={s.exitoLine}>Saldo pendiente: S/ {exito.saldo.toFixed(2)}</Text></View>
                <Text style={s.exitoBadge}>Adelanto enviado a aprobación de cocina</Text>
              </>
            ) : <Text style={s.exitoLine}>Sin adelanto · saldo a cobrar: S/ {total.toFixed(2)}</Text>}
            {exito.inmediato && <Text style={s.warn}>Se activará en cocina de inmediato.</Text>}
          </View>
          <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
            <Text style={s.btnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={cText} />
        </TouchableOpacity>
        <Text style={s.title}>Reservar</Text>
      </View>
      <StepIndicator paso={paso} theme={theme} s={s} />
      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <AnimatePresence exitBeforeEnter>
          <MotiView key={paso} from={{ opacity: 0, translateX: 30 }} animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: -30 }} transition={{ type: "timing", duration: 200 }}>
            {paso === 0 && (
              <View>
                {mesaPre && (
                  <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} style={[s.mesaPreCard, mesaPreNoDisponible && s.mesaPreCardErr]}>
                    <MaterialCommunityIcons name={mesaPreNoDisponible ? "alert-circle" : "armchair"} size={20} color={mesaPreNoDisponible ? cDanger : cReservado} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.mesaPreTitle}>Mesa #{mesaPre.nummesa} preseleccionada</Text>
                      <Text style={s.mesaPreSub}>{mesaPreNoDisponible ? "No disponible en esta franja — elige otra." : "Lista para reservar."}</Text>
                    </View>
                  </MotiView>
                )}
                {errorBanner && (
                  <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} style={s.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={cDanger} />
                    <Text style={s.errorText}>{errorBanner}</Text>
                  </MotiView>
                )}
                <Text style={s.label}>Mesa *</Text>
                <Text style={s.hint}>Solo mesas libres sin reserva en la franja ±2h</Text>
                <View style={s.chips}>
                  {mesas.length === 0 && <Text style={s.muted}>No hay mesas disponibles.</Text>}
                  {mesas.map((m) => {
                    const active = mesaId === m._id;
                    return (
                      <Pressable key={m._id} onPress={() => { setMesaId(m._id); haptic(); }}>
                        <MotiView style={[s.chip, active && s.chipActive]} from={{ scale: 0.95 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>#{m.nummesa}</Text>
                          {m.area?.nombre ? <Text style={s.chipSub}>{m.area.nombre}</Text> : null}
                        </MotiView>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.label}>Nombre del cliente *</Text>
                <TextInput style={s.input} value={clienteNombre} onChangeText={setClienteNombre} placeholder="Mínimo 2 caracteres" placeholderTextColor={cMuted} />
                <Text style={s.label}>Teléfono (recomendado)</Text>
                <TextInput style={s.input} value={clienteTelefono} onChangeText={setClienteTelefono} placeholder="Opcional" placeholderTextColor={cMuted} keyboardType="phone-pad" />
                <Text style={s.label}>Personas</Text>
                <TextInput style={s.input} value={numPersonas} onChangeText={setNumPersonas} keyboardType="numeric" />
              </View>
            )}
            {paso === 1 && (
              <View>
                <HoraPicker fechaReserva={fechaReserva} onChange={setFechaReserva} cfg={cfg} s={s} />
                <View style={s.resumenCocina}>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="clock-outline" size={16} color={cPrimary} /><Text style={s.resumenLine}>Atención: {moment.tz(fechaReserva, TZ).format("DD/MM HH:mm")}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="fire" size={16} color={cWarn} /><Text style={s.resumenLine}>Cocina: {fechaCocina ? fechaCocina.format("DD/MM HH:mm") : "—"} ({(Number(cfg.minutosAntesCocina) || 20)} min antes)</Text></View>
                  {inmediato && <Text style={s.warn}>Se activará en cocina de inmediato.</Text>}
                </View>
                <Text style={s.label}>Encargado de cocina (opcional)</Text>
                <View style={s.chips}>
                  <Pressable onPress={() => { setEncargadoId(null); haptic(); }}>
                    <MotiView style={[s.chip, !encargadoId && s.chipActive]} from={{ scale: 0.95 }} animate={{ scale: !encargadoId ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <Text style={[s.chipText, !encargadoId && s.chipTextActive]}>Auto</Text>
                    </MotiView>
                  </Pressable>
                  {cocineros.map((c) => {
                    const active = encargadoId === c._id;
                    return (
                      <Pressable key={c._id} onPress={() => { setEncargadoId(c._id); haptic(); }}>
                        <MotiView style={[s.chip, active && s.chipActive]} from={{ scale: 0.95 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{c.name}</Text>
                        </MotiView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {paso === 2 && (
              <View>
                <Text style={s.label}>Platos *</Text>
                <View style={s.searchWrap}>
                  <MaterialCommunityIcons name="magnify" size={18} color={cMuted} style={s.searchIcon} />
                  <TextInput style={s.searchInput} value={searchPlato} onChangeText={setSearchPlato} placeholder="Buscar plato…" placeholderTextColor={cMuted} />
                  {searchPlato.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchPlato("")} style={s.searchClear}>
                      <MaterialCommunityIcons name="close-circle" size={18} color={cMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                {searchDebounced.length === 0 && categorias.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
                    <Pressable onPress={() => { setCategoriaFiltro(null); haptic(); }}>
                      <MotiView style={[s.catChip, !categoriaFiltro && s.catChipActive]}><Text style={[s.catChipText, !categoriaFiltro && s.catChipTextActive]}>Todos</Text></MotiView>
                    </Pressable>
                    {categorias.map((cat) => {
                      const active = categoriaFiltro === cat;
                      return (
                        <Pressable key={cat} onPress={() => { setCategoriaFiltro(cat); haptic(); }}>
                          <MotiView style={[s.catChip, active && s.catChipActive]}><Text style={[s.catChipText, active && s.catChipTextActive]}>{cat}</Text></MotiView>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                <FlatList data={platosFiltrados} keyExtractor={(p) => p._id} scrollEnabled nestedScrollEnabled style={s.platosList} renderItem={({ item }) => {
                  const tieneComp = item.complementos && item.complementos.length > 0;
                  const instancias = selPlatos.filter((p) => p._id === item._id);
                  const seleccionado = instancias.length > 0;
                  const cantTotal = instancias.reduce((a, p) => a + (p.cantidad || 1), 0);
                  return (
                    <Pressable onPress={() => tocarPlato(item)}>
                      <MotiView style={[s.platoRow, seleccionado && s.platoRowActive]} from={{ scale: 0.98 }} animate={{ scale: seleccionado ? 1.01 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.platoNombre, seleccionado && s.platoNombreActive]}>{item.nombre}</Text>
                          <Text style={s.muted}>S/ {Number(item.precio || 0).toFixed(2)}</Text>
                        </View>
                        {tieneComp && <MaterialCommunityIcons name="plus-circle-multiple-outline" size={18} color={cPrimary} style={{ marginRight: 8 }} />}
                        {seleccionado ? (
                          <View style={s.platoBadge}>
                            <Text style={s.platoBadgeText}>{cantTotal}</Text>
                          </View>
                        ) : (
                          <View style={s.platoAddBtn}>
                            <MaterialCommunityIcons name="plus" size={18} color={cPrimary} />
                          </View>
                        )}
                      </MotiView>
                    </Pressable>
                  );
                }} />
                <Text style={s.label}>Seleccionados ({selPlatos.length})</Text>
                {selPlatos.length === 0 && <Text style={s.muted}>Toca un plato para agregarlo.</Text>}
                {selPlatos.map((p) => (
                  <MotiView key={p.instanceId} from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} style={s.selPlato}>
                    <View style={s.selTop}>
                      <Text style={s.platoNombre}>{p.cantidad}× {p.nombre}</Text>
                      <Text style={s.muted}>S/ {(Number(p.precioUnitario ?? p.precio) * p.cantidad).toFixed(2)}</Text>
                    </View>
                    {p.complementosElegidos?.length > 0 && (
                      <View style={s.compChips}>
                        {p.complementosElegidos.map((c, i) => (
                          <View key={i} style={s.compChip}><Text style={s.compChipText}>{c.grupo}: {c.nombre}{c.cantidad > 1 ? ` ×${c.cantidad}` : ""}</Text></View>
                        ))}
                      </View>
                    )}
                    <TextInput style={s.notaInput} value={p.notaEspecial} onChangeText={(t) => notaInstancia(p.instanceId, t)} placeholder="Nota especial (opcional)" placeholderTextColor={cMuted} />
                    <View style={s.cantRow}>
                      <TouchableOpacity onPress={() => cantInstancia(p.instanceId, -1)} style={s.cantBtn}><Text style={s.cantBtnText}>−</Text></TouchableOpacity>
                      <Text style={s.cantNum}>{p.cantidad}</Text>
                      <TouchableOpacity onPress={() => cantInstancia(p.instanceId, +1)} style={s.cantBtn}><Text style={s.cantBtnText}>+</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => quitarInstancia(p.instanceId)} style={s.quitarBtn}><MaterialCommunityIcons name="trash-can-outline" size={16} color={cDanger} /></TouchableOpacity>
                    </View>
                  </MotiView>
                ))}
                <MotiView key={total.toFixed(2)} from={{ scale: 0.95, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
                  <Text style={s.total}>Total: S/ {total.toFixed(2)}</Text>
                </MotiView>
              </View>
            )}
            {paso === 3 && (
              <View>
                <Text style={s.label}>Pago adelantado (opcional)</Text>
                <Text style={s.hint}>Si lo activas, cocina lo aprueba en la bandeja PPA. Si no, la reserva se crea igual.</Text>
                <Pressable onPress={() => { setPpaActivo((v) => !v); haptic(); }}>
                  <View style={[s.toggleWrap, ppaActivo && s.toggleWrapActive]}>
                    <MotiView animate={{ scale: ppaActivo ? 1 : 0.85 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} style={[s.checkBox, ppaActivo && s.checkBoxActive]}>
                      {ppaActivo && <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />}
                    </MotiView>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.toggleText, ppaActivo && s.toggleTextActive]}>{ppaActivo ? "Sí, registrar adelanto" : "No, sin adelanto"}</Text>
                      <Text style={s.toggleSub}>{ppaActivo ? "Se envía a aprobación de cocina" : "La reserva se crea sin adelanto"}</Text>
                    </View>
                  </View>
                </Pressable>
                <AnimatePresence>
                  {ppaActivo && (
                    <MotiView from={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "timing", duration: 200 }} style={{ overflow: "hidden" }}>
                      <Text style={s.label}>Monto a adelantar (S/)</Text>
                      <TextInput style={s.input} value={ppaMonto} onChangeText={setPpaMonto} placeholder={`Máx S/ ${total.toFixed(2)}`} keyboardType="numeric" placeholderTextColor={cMuted} />
                      <Text style={s.hint}>Saldo pendiente: S/ {saldoPendiente.toFixed(2)}</Text>
                      <Text style={s.label}>Método</Text>
                      <View style={s.chips}>
                        {["efectivo", "digital", "tarjeta"].map((m) => {
                          const active = ppaMetodo === m;
                          return (
                            <Pressable key={m} onPress={() => { setPpaMetodo(m); haptic(); }}>
                              <MotiView style={[s.chip, active && s.chipActive]} from={{ scale: 0.95 }} animate={{ scale: active ? 1.05 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                <Text style={[s.chipText, active && s.chipTextActive]}>{m}</Text>
                              </MotiView>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={s.ppaResumen}>
                        <View style={s.ppaRow}><Text style={s.ppaLabel}>Total</Text><Text style={s.ppaVal}>S/ {total.toFixed(2)}</Text></View>
                        <View style={s.ppaRow}><Text style={s.ppaLabel}>Adelanto</Text><Text style={[s.ppaVal, { color: cPrimary }]}>− S/ {(Number(ppaMonto) || 0).toFixed(2)}</Text></View>
                        <View style={[s.ppaRow, s.ppaRowSaldo]}><Text style={s.ppaLabelSaldo}>Saldo a cobrar</Text><Text style={s.ppaValSaldo}>S/ {saldoPendiente.toFixed(2)}</Text></View>
                      </View>
                    </MotiView>
                  )}
                </AnimatePresence>
              </View>
            )}
            {paso === 4 && (
              <View>
                <Text style={s.label}>Resumen</Text>
                <View style={s.resumenCard}>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="armchair" size={16} color={cReservado} /><Text style={s.resumenLine}>Mesa: {mesas.find((m) => m._id === mesaId)?.nummesa ?? mesaPre?.nummesa ?? "—"}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="account" size={16} color={cPrimary} /><Text style={s.resumenLine}>Cliente: {clienteNombre.trim()}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="clock-outline" size={16} color={cPrimary} /><Text style={s.resumenLine}>Atención: {moment.tz(fechaReserva, TZ).format("DD/MM HH:mm")}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="fire" size={16} color={cWarn} /><Text style={s.resumenLine}>Cocina: {fechaCocina ? fechaCocina.format("DD/MM HH:mm") : "—"}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="account-group" size={16} color={cMuted} /><Text style={s.resumenLine}>Personas: {numPersonas}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="silverware-fork-knife" size={16} color={cMuted} /><Text style={s.resumenLine}>Platos: {selPlatos.length}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="cash" size={16} color={cSuccess} /><Text style={s.resumenLine}>Total: S/ {total.toFixed(2)}</Text></View>
                  <View style={s.resumenRow}><MaterialCommunityIcons name="cash-multiple" size={16} color={cPrimary} /><Text style={s.resumenLine}>Adelanto: {ppaActivo ? `S/ ${(Number(ppaMonto) || 0).toFixed(2)} (${ppaMetodo})` : "Sin adelanto"}</Text></View>
                  {notas ? <View style={s.resumenRow}><MaterialCommunityIcons name="note-text" size={16} color={cMuted} /><Text style={s.resumenLine}>Notas: {notas.trim()}</Text></View> : null}
                </View>
                {inmediato && <Text style={s.warn}>Se activará en cocina de inmediato.</Text>}
                {errorBanner && (
                  <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} style={s.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={cDanger} />
                    <Text style={s.errorText}>{errorBanner}</Text>
                  </MotiView>
                )}
              </View>
            )}
          </MotiView>
        </AnimatePresence>
      </ScrollView>
      <View style={s.footer}>
        {paso > 0 && (
          <TouchableOpacity style={s.btnSec} onPress={ant} disabled={submitting}>
            <Text style={s.btnSecText}>Atrás</Text>
          </TouchableOpacity>
        )}
        {paso < PASOS.length - 1 ? (
          <TouchableOpacity style={[s.btn, !puedeAvanzar && s.btnDisabled]} onPress={sig} disabled={!puedeAvanzar}>
            <Text style={s.btnText}>Siguiente</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.btn, (submitting || !puedeAvanzar) && s.btnDisabled]} onPress={confirmar} disabled={submitting || !puedeAvanzar}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar reserva</Text>}
          </TouchableOpacity>
        )}
      </View>
      <ModalComplementos
        visible={!!platoParaComplementar}
        plato={platoParaComplementar}
        onConfirm={handleConfirmarComplementos}
        onClose={() => setPlatoParaComplementar(null)}
      />
    </View>
  );
}

const makeStyles = (theme) => {
  const cText = theme.colors.text?.primary ?? "#1A1A1A";
  const cMuted = theme.colors.text?.secondary ?? "#666666";
  const cBg = theme.colors.background ?? "#F8F9FA";
  const cSurface = theme.colors.surface ?? "#FFFFFF";
  const cBorder = theme.colors.border ?? "#E0E0E0";
  const cPrimary = theme.colors.primary ?? "#C41E3A";
  const cReservado = theme.colors.mesaEstado?.reservado ?? "#9C27B0";
  const cDanger = "#dc3545";
  const cSuccess = theme.colors.secondary ?? "#00C851";
  const cWarn = theme.colors.warning ?? "#FF9500";
  const sh = theme.shadows?.small ?? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: cBg },
    header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: cBorder, backgroundColor: cSurface },
    backBtn: { padding: 4 },
    title: { fontSize: 20, fontWeight: "700", color: cText, marginLeft: 8 },
    stepper: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 10, backgroundColor: cSurface, borderBottomWidth: 1, borderBottomColor: cBorder },
    stepWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
    stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: cBg, alignItems: "center", justifyContent: "center", marginRight: 4 },
    stepDotActive: { backgroundColor: cPrimary },
    stepDotDone: { backgroundColor: cSuccess },
    stepText: { fontSize: 10, color: cMuted, marginRight: 4 },
    stepTextActive: { color: cText, fontWeight: "700" },
    stepBar: { flex: 1, height: 2, backgroundColor: cBorder, marginHorizontal: 2 },
    stepBarDone: { backgroundColor: cSuccess },
    body: { flex: 1, padding: 16 },
    label: { fontSize: 14, fontWeight: "600", color: cText, marginTop: 12, marginBottom: 4 },
    hint: { fontSize: 12, color: cMuted, marginBottom: 6 },
    warn: { fontSize: 12, color: cDanger, fontWeight: "600", marginTop: 6 },
    bold: { fontWeight: "700", color: cText },
    muted: { color: cMuted, fontSize: 13, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: cBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: cText, fontSize: 14, marginBottom: 4, backgroundColor: cSurface },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: cBorder, backgroundColor: cSurface, alignItems: "center" },
    chipActive: { backgroundColor: cPrimary, borderColor: cPrimary },
    chipText: { fontSize: 13, color: cText, fontWeight: "600" },
    chipTextActive: { color: "#fff" },
    chipSub: { fontSize: 10, color: cMuted, marginTop: 2 },
    dayScroll: { paddingVertical: 4, gap: 8 },
    dayChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: cBorder, backgroundColor: cSurface },
    dayChipActive: { backgroundColor: cPrimary, borderColor: cPrimary },
    dayChipText: { fontSize: 13, color: cText, fontWeight: "600" },
    dayChipTextActive: { color: "#fff" },
    timeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: cBorder, backgroundColor: cSurface, marginRight: 8 },
    timeChipActive: { backgroundColor: cPrimary, borderColor: cPrimary },
    timeChipText: { fontSize: 13, color: cText, fontWeight: "600" },
    timeChipTextActive: { color: "#fff" },
    mesaPreCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: cReservado + "18", borderWidth: 1, borderColor: cReservado + "55", marginBottom: 10 },
    mesaPreCardErr: { backgroundColor: cDanger + "12", borderColor: cDanger + "55" },
    mesaPreTitle: { fontSize: 14, fontWeight: "700", color: cText },
    mesaPreSub: { fontSize: 12, color: cMuted },
    errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: cDanger + "14", borderWidth: 1, borderColor: cDanger + "44", marginBottom: 10 },
    errorText: { flex: 1, fontSize: 13, color: cDanger, fontWeight: "600" },
    resumenCocina: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: cSurface, borderWidth: 1, borderColor: cBorder, ...sh },
    resumenRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
    resumenLine: { fontSize: 13, color: cText, fontWeight: "500" },
    searchWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: cBorder, borderRadius: 12, paddingHorizontal: 10, backgroundColor: cSurface, marginBottom: 8 },
    searchIcon: { marginRight: 6 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: cText },
    searchClear: { padding: 4 },
    catScroll: { paddingVertical: 4, gap: 8 },
    catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: cBorder, backgroundColor: cSurface, marginRight: 8 },
    catChipActive: { backgroundColor: cPrimary, borderColor: cPrimary },
    catChipText: { fontSize: 12, color: cText, fontWeight: "600" },
    catChipTextActive: { color: "#fff" },
    platoRow: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: cBorder, borderRadius: 12, marginBottom: 6, backgroundColor: cSurface },
    platoRowActive: { borderColor: cPrimary, backgroundColor: cPrimary + "12", borderWidth: 1.5 },
    platoNombre: { fontSize: 14, fontWeight: "600", color: cText },
    platoNombreActive: { color: cPrimary },
    platosList: { maxHeight: 300 },
    platoAddBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: cPrimary, justifyContent: "center", alignItems: "center" },
    platoBadge: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, backgroundColor: cPrimary, justifyContent: "center", alignItems: "center", ...sh },
    platoBadgeText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    selPlato: { padding: 10, backgroundColor: cSurface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: cBorder, ...sh },
    selTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    compChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    compChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: cPrimary + "15" },
    compChipText: { fontSize: 11, color: cPrimary, fontWeight: "600" },
    notaInput: { borderWidth: 1, borderColor: cBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 6, fontSize: 12, color: cText },
    cantRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    cantBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: cBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: cBorder },
    cantBtnText: { fontSize: 18, fontWeight: "700", color: cText },
    cantNum: { fontSize: 15, fontWeight: "700", minWidth: 24, textAlign: "center", color: cText },
    quitarBtn: { marginLeft: "auto", padding: 4 },
    total: { fontSize: 16, fontWeight: "800", color: cText, marginTop: 10, textAlign: "right" },
    toggleWrap: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: cBorder, backgroundColor: cSurface, marginBottom: 8 },
    toggleWrapActive: { backgroundColor: cPrimary + "10", borderColor: cPrimary },
    toggleText: { fontSize: 15, color: cText, fontWeight: "700" },
    toggleTextActive: { color: cPrimary },
    toggleSub: { fontSize: 12, color: cMuted, marginTop: 2 },
    checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: cBorder, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
    checkBoxActive: { backgroundColor: cPrimary, borderColor: cPrimary },
    ppaResumen: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: cSurface, borderWidth: 1, borderColor: cBorder },
    ppaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    ppaLabel: { fontSize: 13, color: cMuted },
    ppaVal: { fontSize: 13, color: cText, fontWeight: "600" },
    ppaRowSaldo: { borderTopWidth: 1, borderTopColor: cBorder, marginTop: 4, paddingTop: 8 },
    ppaLabelSaldo: { fontSize: 14, color: cText, fontWeight: "700" },
    ppaValSaldo: { fontSize: 15, color: cSuccess, fontWeight: "800" },
    resumenCard: { padding: 14, borderRadius: 14, backgroundColor: cSurface, borderWidth: 1, borderColor: cBorder, ...sh },
    skelCard: { padding: 14, borderRadius: 12, backgroundColor: cSurface, borderWidth: 1, borderColor: cBorder, marginBottom: 12 },
    skelLine: { height: 14, borderRadius: 6, backgroundColor: "rgba(150,150,150,0.25)", marginBottom: 8 },
    exitoWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    exitoIcon: { marginBottom: 12 },
    exitoTitle: { fontSize: 24, fontWeight: "800", color: cText, marginBottom: 4 },
    exitoSub: { fontSize: 15, color: cMuted, marginBottom: 16 },
    exitoCard: { width: "100%", padding: 16, borderRadius: 14, backgroundColor: cSurface, borderWidth: 1, borderColor: cBorder, marginBottom: 20, ...sh },
    exitoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
    exitoLine: { fontSize: 14, color: cText, fontWeight: "500" },
    exitoBadge: { marginTop: 8, fontSize: 12, color: cWarn, fontWeight: "700", textAlign: "center" },
    footer: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderTopWidth: 1, borderTopColor: cBorder, backgroundColor: cSurface, gap: 8 },
    btn: { flex: 1, backgroundColor: cPrimary, paddingVertical: 15, borderRadius: 12, alignItems: "center", ...sh },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    btnSec: { paddingVertical: 15, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: cBorder },
    btnSecText: { color: cText, fontWeight: "700" },
  });
};

