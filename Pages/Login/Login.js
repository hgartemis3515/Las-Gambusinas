import React, { useState } from "react";
import {
  Text,
  SafeAreaView,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LOGIN_AUTH_API } from "../../apiConfig";
import { useTheme } from "../../context/ThemeContext";
import { themeLight } from "../../constants/theme";

const Login = () => {
  const navigation = useNavigation();
  let themeContext;
  try {
    themeContext = useTheme();
  } catch (error) {
    console.error('Error obteniendo tema:', error);
    themeContext = { theme: themeLight, isDarkMode: false, toggleTheme: () => {} };
  }
  
  // Asegurar que siempre tenemos un tema válido
  const theme = themeContext?.theme || themeLight;
  const styles = LoginStyles(theme);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");

  const handleLogin = async () => {
    try {
      console.log('🔐 Intentando login con:', { nombre: nombre.trim(), DNI: dni.trim() });
      console.log('📡 Conectando a:', LOGIN_AUTH_API);
      
      const response = await axios.post(
        LOGIN_AUTH_API,
        {
          name: nombre.trim(),
          DNI: dni.trim(),
        },
        { timeout: 5000 }
      );
      
      const mozo = response.data.mozo;
      console.log('✅ Login exitoso, mozo:', mozo);
      
      // Limpiar datos antiguos del usuario antes de guardar el nuevo
      await AsyncStorage.removeItem('user');
      
      const userData = {
        _id: mozo._id,
        name: mozo.name
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      console.log('💾 Usuario guardado en AsyncStorage:', userData);
      console.log('🔍 Verificación - ID del mozo guardado:', userData._id);
      console.log('🔍 Verificación - Nombre del mozo guardado:', userData.name);
      
      Alert.alert("✅ Éxito", `Bienvenido ${mozo.name}`);
      navigation.replace("Navbar", { username: mozo.name });
    } catch (error) {
      console.error('❌ Error de conexión:', error.message);
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        Alert.alert("Error de Conexión", "No se pudo conectar con el servidor. Verifica que:\n\n1. El backend esté corriendo\n2. Tu teléfono y computadora estén en la misma red WiFi\n3. La IP en apiConfig.js sea correcta");
      } else if (error.response?.status === 401) {
        Alert.alert("Error", "DNI o Nombre incorrectos.");
      } else {
        Alert.alert("Error", error.response?.data?.message || "Error al conectar con el servidor.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.loginCard}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={64} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Las Gambusinas</Text>
          <Text style={styles.subtitle}>Sistema de Gestión</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="account" size={20} color={theme.colors.text.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Juan Pérez"
                placeholderTextColor={theme.colors.text.light}
                onChangeText={(text) => setNombre(text)}
                value={nombre}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>DNI</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="card-account-details" size={20} color={theme.colors.text.secondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={theme.colors.text.light}
                onChangeText={(text) => setDni(text)}
                value={dni}
                keyboardType="numeric"
                maxLength={8}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="login" size={24} color={theme.colors.text.white} />
            <Text style={styles.buttonText}>INGRESAR</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const LoginStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  loginCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    color: theme.colors.text.secondary,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
  },
  inputIcon: {
    marginLeft: theme.spacing.md,
  },
  input: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md + 2,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  buttonText: {
    color: theme.colors.text.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default Login;
