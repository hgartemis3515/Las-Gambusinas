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
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LOGIN_AUTH_API } from "../../apiConfig";
import { colors } from "../../constants/colors";
import { useOrientation } from "../../hooks/useOrientation";
import SettingsModal from "../../Components/SettingsModal";
import apiConfig from "../../config/apiConfig";

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

// Componente de Bienvenida Elegante
const SuccessWelcomeModal = ({ visible, userName, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkRotation = useSharedValue(-45);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Animación de entrada
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      
      // Animación del check con delay
      setTimeout(() => {
        checkScale.value = withSpring(1, { damping: 10, stiffness: 150 });
        checkRotation.value = withSpring(0, { damping: 10, stiffness: 150 });
      }, 200);

      // Animación del progreso
      progressWidth.value = withTiming(100, { duration: 2000 });
    } else {
      opacity.value = 0;
      scale.value = 0;
      checkScale.value = 0;
      checkRotation.value = -45;
      progressWidth.value = 0;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: checkScale.value },
      { rotate: `${checkRotation.value}deg` }
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        },
        containerStyle,
      ]}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          damping: 15,
          stiffness: 200,
        }}
        style={{
          backgroundColor: "rgba(26, 26, 26, 0.95)",
          borderRadius: 24,
          padding: 32,
          alignItems: "center",
          justifyContent: "center",
          width: "85%",
          maxWidth: 400,
          borderWidth: 2,
          borderColor: colors.primary,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        {/* Icono de check animado */}
        <Animated.View style={checkStyle}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.success,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 24,
              shadowColor: colors.success,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 12,
            }}
          >
            <MaterialCommunityIcons
              name="check"
              size={48}
              color="#FFFFFF"
            />
          </View>
        </Animated.View>

        {/* Título */}
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: colors.textPrimary,
            marginBottom: 12,
            textAlign: "center",
            letterSpacing: 1,
          }}
        >
          ¡Bienvenido!
        </Text>

        {/* Nombre del usuario */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: colors.primary,
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {userName}
        </Text>

        {/* Mensaje */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "500",
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          Sesión iniciada correctamente
        </Text>

        {/* Indicador de progreso animado */}
        <View
          style={{
            marginTop: 24,
            width: "100%",
            height: 4,
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={[
              {
                height: "100%",
                backgroundColor: colors.primary,
                borderRadius: 2,
              },
              progressStyle,
            ]}
          />
        </View>
      </MotiView>
    </Animated.View>
  );
};

// Input con animaciones
const AnimatedInput = ({ label, icon, placeholder, value, onChangeText, error, delay = 0, screenWidth, isLandscape = false, ...props }) => {
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
      style={{ 
        marginBottom: isLandscape ? 20 : 28, 
        width: isLandscape ? "100%" : screenWidth * 0.88, 
        maxWidth: 340, 
        alignSelf: "center" 
      }}
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
            height: isLandscape 
              ? (screenWidth < 390 ? 48 : 52) 
              : (screenWidth < 390 ? 52 : 56),
            borderWidth: 2,
            borderColor: isFocused ? colors.primary : error ? colors.danger : "rgba(255,255,255,0.2)",
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.1)",
            paddingHorizontal: 16,
          }}
        >
          <MaterialCommunityIcons
            name={icon}
            size={isLandscape ? 20 : 22}
            color={isFocused ? colors.primary : colors.textSecondary}
            style={{ marginRight: 12 }}
          />
          <TextInput
            style={{
              flex: 1,
              height: isLandscape 
                ? (screenWidth < 390 ? 48 : 52) 
                : (screenWidth < 390 ? 52 : 56),
              fontSize: isLandscape ? 15 : 16,
              color: colors.textPrimary,
              fontWeight: "600",
              textAlignVertical: "center",
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
  const { isLandscape, isTablet: isTabletOrientation } = useOrientation();
  const isTablet = width > 500;
  const isSmallScreen = width < 390;
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useState({ nombre: false, dni: false });
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUserName, setWelcomeUserName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const buttonScale = useSharedValue(1);
  const titlePulse = useSharedValue(1);

  // Verificar estado de configuración
  useEffect(() => {
    const checkConfig = () => {
      setIsConfigured(apiConfig.isConfigured);
    };
    
    checkConfig();
    const interval = setInterval(checkConfig, 2000); // Verificar cada 2 segundos
    
    return () => clearInterval(interval);
  }, []);

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

      // Test de conexión antes de guardar y navegar (evita guardar con IP incorrecta)
      const baseForLogin = apiConfig.baseURL || 'http://192.168.18.11:3000/api';
      const testResult = await apiConfig.testConnection(baseForLogin);
      if (!testResult.success) {
        Alert.alert(
          'Error de Conexión',
          testResult.message || 'No se pudo conectar con el servidor. Revisa la IP en Ajustes.'
        );
        setLoading(false);
        return;
      }

      // Usar endpoint dinámico desde apiConfig
      const loginURL = apiConfig.isConfigured
        ? apiConfig.getEndpoint('/mozos/auth')
        : LOGIN_AUTH_API;

      const response = await axios.post(
        loginURL,
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

      // Mostrar modal de bienvenida elegante
      setWelcomeUserName(mozo.name);
      setShowWelcome(true);
      
      // Auto-cierre y navegación después de 2 segundos
      setTimeout(() => {
        setShowWelcome(false);
        setTimeout(() => {
          navigation.replace("Navbar", { username: mozo.name });
        }, 300);
      }, 2000);
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

  // Animación pulse infinito para marco POS
  useEffect(() => {
    titlePulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  // Generar partículas (reducido para mejor rendimiento)
  const particles = Array.from({ length: 8 }, (_, i) => (
    <FloatingParticle key={`particle-${i}`} delay={i * 200} screenHeight={height} screenWidth={width} />
  ));

  const titlePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titlePulse.value }],
  }));

  return (
    <LinearGradient
      colors={["#C41E3A", "#1A1A1A", "#121212"]}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Header con botón de configuración */}
        <View style={{
          position: 'absolute',
          top: 0,
          right: 0,
          left: 0,
          zIndex: 1000,
          paddingTop: Platform.OS === 'ios' ? 10 : 20,
          paddingHorizontal: 20,
          paddingBottom: 10,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={{
              padding: 10,
              borderRadius: 20,
              backgroundColor: isConfigured 
                ? 'rgba(34, 197, 94, 0.2)' 
                : 'rgba(239, 68, 68, 0.2)',
              borderWidth: 2,
              borderColor: isConfigured ? '#22C55E' : '#EF4444',
              position: 'relative',
            }}
          >
            <MaterialCommunityIcons 
              name="cog-outline" 
              size={24} 
              color={isConfigured ? '#22C55E' : '#EF4444'} 
            />
            {!isConfigured && (
              <View style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: '#EF4444',
                borderWidth: 2,
                borderColor: '#FFFFFF',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: '900',
                }}>!</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: isLandscape ? height * 0.05 : height * 0.1,
              flexDirection: isLandscape ? "row" : "column",
              paddingHorizontal: isLandscape ? 40 : 0,
            }}
          >
            {/* Partículas flotantes */}
            {particles}

            {/* Título POS - Hero Center con Marco Premium */}
            <MotiView
              from={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                damping: 15,
                delay: 200,
              }}
              style={{
                marginTop: isLandscape ? 0 : 140,
                marginBottom: isLandscape ? 0 : 32,
                marginRight: isLandscape ? 40 : 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={titlePulseStyle}>
                <View
                  style={{
                    width: isLandscape ? 100 : 120,
                    height: isLandscape ? 50 : 60,
                    borderRadius: 16,
                    borderWidth: 3,
                    borderColor: colors.primary,
                    backgroundColor: "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#FFFFFF",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: isLandscape 
                        ? (isSmallScreen ? 32 : 36) 
                        : (isSmallScreen ? 38 : 42),
                      fontWeight: "900",
                      fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
                      color: "#FFFFFF",
                      textAlign: "center",
                      letterSpacing: 2,
                      textShadowColor: "#000000",
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 4,
                      shadowColor: "#C41E3A",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 12,
                    }}
                  >
                    POS
                  </Text>
                </View>
              </Animated.View>
            </MotiView>

            {/* Card flotante con inputs */}
            <MotiView
              from={{ opacity: 0, translateY: isLandscape ? 0 : 50 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{
                type: "spring",
                damping: 15,
                delay: 300,
              }}
              style={{
                backgroundColor: "rgba(26,26,26,0.6)",
                borderRadius: 32,
                padding: isLandscape ? 28 : (isTablet ? 40 : 32),
                width: isLandscape ? Math.min(width * 0.45, 400) : width * 0.9,
                maxWidth: isLandscape ? 400 : 360,
                alignSelf: "center",
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
                label="Nombre Mozo"
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
                isLandscape={isLandscape}
                autoCapitalize="words"
              />

              <AnimatedInput
                label="DNI"
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
                isLandscape={isLandscape}
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
                      height: isLandscape ? 52 : 60,
                      paddingHorizontal: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      marginTop: isLandscape ? 16 : 24,
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
      
      {/* Modal de Bienvenida Elegante */}
      <SuccessWelcomeModal
        visible={showWelcome}
        userName={welcomeUserName}
        onClose={() => setShowWelcome(false)}
      />

      {/* Modal de Configuración del Servidor */}
      <SettingsModal
        visible={showSettings}
        onClose={() => {
          setShowSettings(false);
          // Recargar estado de configuración después de cerrar
          setIsConfigured(apiConfig.isConfigured);
        }}
      />
    </LinearGradient>
  );
};

export default Login;
