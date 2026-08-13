import React from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";

// Stepper horizontal animado para el wizard de reservas.
export const PASOS = ["Mesa", "Hora", "Platos", "Pago", "Confirmar"];

const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} };

export default function StepIndicator({ paso, theme, s }) {
  return (
    <View style={s.stepper}>
      {PASOS.map((p, i) => {
        const done = i < paso;
        const active = i === paso;
        return (
          <View key={p} style={s.stepWrap}>
            <MotiView
              from={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: active ? 1.1 : 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              style={[s.stepDot, active && s.stepDotActive, done && s.stepDotDone]}
            >
              <MaterialCommunityIcons
                name={done ? "check-circle" : "numeric-" + (i + 1) + "-circle"}
                size={16}
                color={active || done ? "#fff" : (theme.colors.text?.secondary ?? "#666")}
              />
            </MotiView>
            <Text style={[s.stepText, (active || done) && s.stepTextActive]}>{p}</Text>
            {i < PASOS.length - 1 && <View style={[s.stepBar, i < paso && s.stepBarDone]} />}
          </View>
        );
      })}
    </View>
  );
}
