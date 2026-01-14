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
import { LOGIN_AUTH_API } from "../../apiConfig";

const Login = () => {
  const navigation = useNavigation();
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
      
      const userData = {
        _id: mozo._id,
        name: mozo.name
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      console.log('💾 Usuario guardado en AsyncStorage:', userData);
      
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
        <Text style={styles.title}>LOGIN</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>DNI/Nombre:</Text>
          <TextInput
            style={styles.input}
            placeholder="Juan Pérez"
            onChangeText={(text) => setNombre(text)}
            value={nombre}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>DNI:</Text>
          <TextInput
            style={styles.input}
            placeholder="12345678"
            onChangeText={(text) => setDni(text)}
            value={dni}
            keyboardType="numeric"
            maxLength={8}
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>INGRESAR</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 50,
    color: '#C41E3A',
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#C41E3A',
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default Login;
