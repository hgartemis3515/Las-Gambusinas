import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LOGIN_AUTH_API } from "../../apiConfig";

const Login = () => {
  const navigation = useNavigation();
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  
  // COLORES HARDCODEADOS - SIN DEPENDER DEL TEMA
  const bgColor = '#F5F5F5';
  const surfaceColor = '#FFFFFF';
  const textPrimary = '#000000';
  const textSecondary = '#666666';
  const textLight = '#999999';
  const primaryColor = '#C41E3A';
  const borderColor = '#CCCCCC';
  
  console.log('🔵 Login component rendering...', { bgColor, surfaceColor, textPrimary });

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
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top', 'bottom']}>
        <ScrollView 
          contentContainerStyle={{ 
            flexGrow: 1, 
            justifyContent: 'center', 
            padding: 24,
            backgroundColor: bgColor 
          }}
          style={{ flex: 1, backgroundColor: bgColor }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ 
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 32,
            borderWidth: 3,
            borderColor: '#FF0000',
            minHeight: 400,
          }}>
          <Text style={{ 
            fontSize: 36, 
            fontWeight: '700', 
            textAlign: 'center', 
            marginBottom: 8, 
            color: '#C41E3A',
          }}>Las Gambusinas</Text>
          <Text style={{ 
            fontSize: 16, 
            textAlign: 'center', 
            marginBottom: 32, 
            color: '#666666' 
          }}>Sistema de Gestión</Text>
          
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '600', 
              marginBottom: 8, 
              color: textPrimary,
              textTransform: 'uppercase',
              letterSpacing: 0.5 
            }}>Nombre</Text>
            <View style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: borderColor,
              borderRadius: 12,
              backgroundColor: surfaceColor,
            }}>
              <MaterialCommunityIcons name="account" size={20} color={textSecondary} style={{ marginLeft: 16 }} />
              <TextInput
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  fontSize: 16, 
                  color: textPrimary,
                  backgroundColor: surfaceColor 
                }}
                placeholder="Juan Pérez"
                placeholderTextColor={textLight}
                onChangeText={(text) => setNombre(text)}
                value={nombre}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '600', 
              marginBottom: 8, 
              color: textPrimary,
              textTransform: 'uppercase',
              letterSpacing: 0.5 
            }}>DNI</Text>
            <View style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: borderColor,
              borderRadius: 12,
              backgroundColor: surfaceColor,
            }}>
              <MaterialCommunityIcons name="card-account-details" size={20} color={textSecondary} style={{ marginLeft: 16 }} />
              <TextInput
                style={{ 
                  flex: 1, 
                  padding: 16, 
                  fontSize: 16, 
                  color: textPrimary,
                  backgroundColor: surfaceColor 
                }}
                placeholder="12345678"
                placeholderTextColor={textLight}
                onChangeText={(text) => setDni(text)}
                value={dni}
                keyboardType="numeric"
                maxLength={8}
              />
            </View>
          </View>

          <TouchableOpacity
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: primaryColor,
              borderRadius: 12,
              padding: 18,
              marginTop: 16,
              gap: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
            }}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="login" size={24} color="#FFFFFF" />
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 18, 
              fontWeight: '700', 
              letterSpacing: 1 
            }}>INGRESAR</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// Estilos simplificados - ya no se usan, pero los mantengo por compatibilidad
const LoginStyles = () => StyleSheet.create({});

export default Login;
