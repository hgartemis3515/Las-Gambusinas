import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { MotiView } from "moti";
import moment from "moment-timezone";
import * as Haptics from "expo-haptics";

const TZ = "America/Lima";
const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} };

const parseHM = (str, fbH, fbM) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || "").trim());
  if (!m) return { h: fbH, m: fbM };
  return { h: Math.min(23, Math.max(0, Number(m[1]))), m: Math.min(59, Number(m[2])) };
};

const slotMoment = (diaKey, label) => moment.tz(`${diaKey} ${label}`, "YYYY-MM-DD HH:mm", TZ);

const generarFranjas = (horaApertura, horaCierre) => {
  const ap = parseHM(horaApertura, 11, 0);
  const ci = parseHM(horaCierre, 22, 0);
  const startMin = ap.h * 60 + ap.m;
  const endMin = ci.h * 60 + ci.m;
  const from = Math.ceil(startMin / 15) * 15;
  const arr = [];
  if (endMin < from) return arr;
  for (let t = from; t <= endMin; t += 15) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    if (h > 23) break;
    arr.push({ h, m, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
  }
  return arr;
};

// Selector de hora JS puro: chips de día (Hoy/Mañana/...) + chips de franjas de 15 min.
// Si el día es hoy, se ocultan las horas que ya pasaron.
export default function HoraPicker({ fechaReserva, onChange, cfg, s }) {
  const dias = useMemo(() => {
    const hor = Number(cfg.horizonteReservaDias) || 7;
    const arr = [];
    const hoy = moment.tz(TZ).startOf("day");
    for (let i = 0; i < hor; i++) {
      const d = hoy.clone().add(i, "days");
      arr.push({ key: d.format("YYYY-MM-DD"), label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : d.format("ddd DD") });
    }
    return arr;
  }, [cfg.horizonteReservaDias]);

  const franjas = useMemo(
    () => generarFranjas(cfg.horaApertura, cfg.horaCierre),
    [cfg.horaApertura, cfg.horaCierre]
  );

  const current = moment.tz(fechaReserva, TZ);
  const diaKey = current.isValid() ? current.format("YYYY-MM-DD") : moment.tz(TZ).format("YYYY-MM-DD");
  const horaLabel = current.isValid() ? current.format("HH:mm") : "";
  const esHoy = diaKey === moment.tz(TZ).format("YYYY-MM-DD");

  const franjasVisibles = useMemo(() => {
    if (!esHoy) return franjas;
    const ahora = moment.tz(TZ);
    return franjas.filter((f) => slotMoment(diaKey, f.label).isAfter(ahora));
  }, [franjas, esHoy, diaKey]);

  useEffect(() => {
    if (!esHoy) return;
    const sigueValida = franjasVisibles.some((f) => f.label === horaLabel);
    if (sigueValida) return;
    if (franjasVisibles.length === 0) return;
    const f = franjasVisibles[0];
    const next = slotMoment(diaKey, f.label).format("YYYY-MM-DDTHH:mm");
    if (next !== fechaReserva) onChange(next);
  }, [esHoy, diaKey, horaLabel, franjasVisibles, fechaReserva, onChange]);

  const setDia = (key) => {
    haptic();
    const ahora = moment.tz(TZ);
    const esHoySel = key === ahora.format("YYYY-MM-DD");
    const visibles = esHoySel
      ? franjas.filter((f) => slotMoment(key, f.label).isAfter(ahora))
      : franjas;
    const keep = visibles.find((f) => f.label === horaLabel) || visibles[0];
    if (!keep) {
      onChange(moment.tz(key, TZ).hour(current.hour()).minute(current.minute()).format("YYYY-MM-DDTHH:mm"));
      return;
    }
    onChange(slotMoment(key, keep.label).format("YYYY-MM-DDTHH:mm"));
  };

  const setFranja = (f) => {
    onChange(slotMoment(diaKey, f.label).format("YYYY-MM-DDTHH:mm"));
    haptic();
  };

  return (
    <View>
      <Text style={s.label}>Día de atención</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
        {dias.map((d) => {
          const active = d.key === diaKey;
          return (
            <Pressable key={d.key} onPress={() => setDia(d.key)}>
              <MotiView
                from={{ scale: 0.95 }} animate={{ scale: active ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={[s.dayChip, active && s.dayChipActive]}
              >
                <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{d.label}</Text>
              </MotiView>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={s.label}>Hora de atención</Text>
      {franjasVisibles.length === 0 ? (
        <Text style={s.hint}>{esHoy ? "Hoy ya no hay horarios disponibles. Elige otro día." : "No hay horarios en este rango."}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
          {franjasVisibles.map((f) => {
            const active = f.label === horaLabel;
            return (
              <Pressable key={f.label} onPress={() => setFranja(f)}>
                <MotiView
                  from={{ scale: 0.95 }} animate={{ scale: active ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={[s.timeChip, active && s.timeChipActive]}
                >
                  <Text style={[s.timeChipText, active && s.timeChipTextActive]}>{f.label}</Text>
                </MotiView>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
