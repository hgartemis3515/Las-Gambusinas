import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MotiView, MotiText } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LOGIN_AUTH_API } from "../../apiConfig";
import { colors } from "../../constants/colors";

// Componente de partículas flotantes
const FloatingParticle = ({ delay = 0, screenHeight, screenWidth }) => {
  const translateY = useSharedValue(screenHeight || 800);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(Math.random() * (screenWidth || 400));

  useEffect(() => {
    if (!screenHeight || !screenWidth) return;
    
    translateY.value = withRepeat(
      withTiming(-100, {
        duration: 3000 + Math.random() * 2000,
      }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.2, { duration: 2000 }),
        withTiming(0.6, { duration: 1000 })
      ),
      -1,
      false
    );
  }, [screenHeight, screenWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.primary,
        },
        animatedStyle,
      ]}
    />
  );
};

// Input con animaciones
const AnimatedInput = ({ label, icon, placeholder, value, onChangeText, error, delay = 0, screenWidth, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const shakeX = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (error) {
      shakeX.value = withSequence(
        withTiming(-5, { duration: 50 }),
        withRepeat(withTiming(5, { duration: 50 }), 3, true),
        withTiming(0, { duration: 50 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error]);

  useEffect(() => {
    glowOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: colors.primary,
    shadowOpacity: interpolate(glowOpacity.value, [0, 1], [0, 0.8]),
    shadowRadius: interpolate(glowOpacity.value, [0, 1], [0, 12]),
    shadowOffset: { width: 0, height: 0 },
    elevation: interpolate(glowOpacity.value, [0, 1], [0, 8]),
  }));

  return (
    <MotiView
      from={{ opacity: 0, translateY: 30 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: "spring",
        damping: 15,
        delay: delay,
      }}
      style={{ marginBottom: 24, width: screenWidth * 0.85, alignSelf: "center" }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          marginBottom: 8,
          color: colors.textPrimary,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <Animated.View style={[shakeStyle, glowStyle]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 2,
            borderColor: isFocused ? colors.primary : error ? colors.danger : "rgba(255,255,255,0.2)",
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.1)",
            paddingHorizontal: 16,
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={24}
            color={isFocused ? colors.primary : colors.textSecondary}
            style={{ marginRight: 12 }}
          />
          <TextInput
            style={{
              flex: 1,
              paddingVertical: 18,
              fontSize: 16,
              color: colors.textPrimary,
              fontWeight: "600",
            }}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.5)"
            onChangeText={onChangeText}
            value={value}
            onFocus={() => {
              setIsFocused(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </View>
      </Animated.View>
    </MotiView>
  );
};

const Login = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const isTablet = width > 500;
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useState({ nombre: false, dni: false });
  const [loading, setLoading] = useState(false);
  const buttonScale = useSharedValue(1);

  const handleLogin = async () => {
    // Validación
    if (!nombre.trim()) {
      setError({ nombre: true, dni: false });
      return;
    }
    if (!dni.trim() || dni.trim().length < 8) {
      setError({ nombre: false, dni: true });
      return;
    }

    setError({ nombre: false, dni: false });
    setLoading(true);

    // Animación del botón al presionar
    buttonScale.value = withSequence(
      withSpring(1.1, { damping: 10 }),
      withTiming(1, { duration: 200 })
    );

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await axios.post(
        LOGIN_AUTH_API,
        {
          name: nombre.trim(),
          DNI: dni.trim(),
        },
        { timeout: 5000 }
      );

      const mozo = response.data.mozo;
      console.log("✅ Login exitoso, mozo:", mozo);

      await AsyncStorage.removeItem("user");

      const userData = {
        _id: mozo._id,
        name: mozo.name,
      };

      await AsyncStorage.setItem("user", JSON.stringify(userData));
      console.log("💾 Usuario guardado en AsyncStorage:", userData);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animación de éxito
      buttonScale.value = withSequence(
        withSpring(1.2, { damping: 8 }),
        withTiming(1, { duration: 200 })
      );

      Alert.alert("✅ Éxito", `Bienvenido ${mozo.name}`);
      
      // Pequeño delay para que se vea la animación antes de navegar
      setTimeout(() => {
        navigation.replace("Navbar", { username: mozo.name });
      }, 300);
    } catch (error) {
      console.error("❌ Error de conexión:", error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (error.code === "ECONNREFUSED" || error.message.includes("Network Error")) {
        Alert.alert(
          "Error de Conexión",
          "No se pudo conectar con el servidor. Verifica que:\n\n1. El backend esté corriendo\n2. Tu teléfono y computadora estén en la misma red WiFi\n3. La IP en apiConfig.js sea correcta"
        );
      } else if (error.response?.status === 401) {
        Alert.alert("Error", "DNI o Nombre incorrectos.");
        setError({ nombre: true, dni: true });
      } else {
        Alert.alert(
          "Error",
          error.response?.data?.message || "Error al conectar con el servidor."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Generar partículas (reducido para mejor rendimiento)
  const particles = Array.from({ length: 8 }, (_, i) => (
    <FloatingParticle key={`particle-${i}`} delay={i * 200} screenHeight={height} screenWidth={width} />
  ));

  return (
    <LinearGradient
      colors={["#C41E3A", "#1A1A1A", "#121212"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: height * 0.1,
            }}
          >
            {/* Partículas flotantes */}
            {particles}

            {/* Logo con animación hero */}
            <MotiView
              from={{ scale: 1.2, opacity: 0, translateY: -50 }}
              animate={{ scale: 1, opacity: 1, translateY: 0 }}
              transition={{
                type: "spring",
                damping: 12,
                stiffness: 100,
              }}
              style={{
                marginBottom: isTablet ? 60 : 40,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: isTablet ? 240 : 200,
                  height: isTablet ? 240 : 200,
                  borderRadius: 30,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: "rgba(196,30,58,0.3)",
                }}
              >
                <Text
                  style={{
                    fontSize: isTablet ? 48 : 36,
                    fontWeight: "900",
                    color: colors.textPrimary,
                    textAlign: "center",
                    letterSpacing: 2,
                  }}
                >
                  Las Gambusinas
                </Text>
              </View>
            </MotiView>

            {/* Card flotante con inputs */}
            <MotiView
              from={{ opacity: 0, translateY: 50 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: "spring",
                damping: 15,
                delay: 300,
              }}
              style={{
                backgroundColor: "rgba(26,26,26,0.6)",
                borderRadius: 32,
                padding: isTablet ? 40 : 32,
                width: width * 0.9,
                maxWidth: 500,
                borderWidth: 1,
                borderColor: "rgba(196,30,58,0.2)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.5,
                shadowRadius: 30,
                elevation: 20,
              }}
            >
              <AnimatedInput
                label="👤 Nombre Mozo"
                icon="account"
                placeholder="Juan Pérez"
                value={nombre}
                onChangeText={(text) => {
                  setNombre(text);
                  setError(prev => ({ ...prev, nombre: false }));
                }}
                error={error.nombre}
                delay={400}
                screenWidth={width}
                autoCapitalize="words"
              />

              <AnimatedInput
                label="🆔 DNI"
                icon="card-account-details"
                placeholder="12345678"
                value={dni}
                onChangeText={(text) => {
                  setDni(text);
                  setError(prev => ({ ...prev, dni: false }));
                }}
                error={error.dni}
                delay={600}
                screenWidth={width}
                keyboardType="numeric"
                maxLength={8}
              />

              {/* Botón INGRESAR */}
              <Animated.View style={buttonAnimatedStyle}>
                <MotiView
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    damping: 10,
                    delay: 800,
                  }}
                >
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 16,
                      paddingVertical: 20,
                      paddingHorizontal: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      marginTop: 8,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.5,
                      shadowRadius: 16,
                      elevation: 12,
                    }}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="login"
                      size={28}
                      color="#FFFFFF"
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 20,
                        fontWeight: "800",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      {loading ? "Ingresando..." : "Ingresar"}
                    </Text>
                  </TouchableOpacity>
                </MotiView>
              </Animated.View>
            </MotiView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Login;
