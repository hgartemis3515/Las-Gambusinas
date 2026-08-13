import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { MotiView } from "moti";
import moment from "moment-timezone";
import * as Haptics from "expo-haptics";

const TZ = "America/Lima";
const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} };

// Selector de hora JS puro: chips de día (Hoy/Mañana/...) + chips de franjas de 15 min.
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

  const franjas = useMemo(() => {
    const arr = [];
    for (let h = 11; h <= 22; h++)
      for (let m = 0; m < 60; m += 15)
        arr.push({ h, m, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` });
    return arr;
  }, []);

  const current = moment.tz(fechaReserva, TZ);
  const diaKey = current.format("YYYY-MM-DD");
  const horaLabel = current.format("HH:mm");

  const setDia = (key) => {
    const d = moment.tz(key, TZ);
    const nuevo = d.clone().hour(current.hour()).minute(current.minute());
    onChange(nuevo.format("YYYY-MM-DDTHH:mm"));
    haptic();
  };
  const setFranja = (f) => {
    const nuevo = current.clone().hour(f.h).minute(f.m);
    onChange(nuevo.format("YYYY-MM-DDTHH:mm"));
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
        {franjas.map((f) => {
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
    </View>
  );
}
