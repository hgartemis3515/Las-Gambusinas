import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";

const FAQ = [
  {
    q: "¿Por qué no veo platos listos al instante?",
    a: "La cocina actualiza el estado en el KDS (app web). El servidor envía eventos por WebSocket al canal /mozos. Comprueba el indicador de conexión, la URL del servidor en Ajustes y que tu sesión esté activa.",
  },
  {
    q: "¿Qué es el namespace /mozos?",
    a: "Es la conexión en tiempo real del app de mozos con el backend. Ahí llegan eventos como plato-actualizado, comanda-actualizada y mesa-actualizada.",
  },
  {
    q: "Cambiamos de Wi‑Fi y dejó de funcionar",
    a: "Abre Configuración del servidor (Más) y verifica que la URL del API sea alcanzable desde la nueva red (IP o hostname correcto, puerto 3000 o el que use el restaurante).",
  },
  {
    q: "¿Quién gestiona usuarios y permisos?",
    a: "El administrador del restaurante en el panel y base de datos. Si no puedes cobrar o editar comandas, es por tu rol (mozo, capitán, cajero, etc.).",
  },
];

const HelpScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = buildStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Soporte operativo Las Gambusinas. Si el problema persiste, contacta al administrador del local con
          captura de pantalla y hora aproximada.
        </Text>
        {FAQ.map((item) => (
          <View key={item.q} style={styles.card}>
            <Text style={styles.question}>{item.q}</Text>
            <Text style={styles.answer}>{item.a}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const buildStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    scroll: { padding: theme.spacing.lg, paddingBottom: 48 },
    intro: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small,
    },
    question: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    answer: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
  });

export default HelpScreen;
