import React, { useState } from "react";
import {
  Text,
  SafeAreaView,
  Image,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { LOGIN_AUTH_API } from "../../apiConfig";

const Login = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await axios.post(LOGIN_AUTH_API, {
        name: username,
        DNI: password,
      });
      const mozo = response.data.mozo;
      await AsyncStorage.setItem('user', JSON.stringify({
        name: mozo.name, 
        id: mozo._id,
      }));
      console.log(`_id del mozo almacenado: ${mozo._id}`);
      navigation.replace("Navbar", { username: `${mozo.name}` });
    } catch (error) {
      Alert.alert("Error", "Usuario o contraseña incorrectos.");
    }
  };

  return (
    <SafeAreaView style={{ flexDirection: "column", gap: 30 }}>
      <ScrollView>
        <Text
          style={{
            marginTop: 70,
            paddingHorizontal: 30,
            textAlign: "center",
            fontStyle: "italic",
            fontWeight: "bold",
            fontSize: 20,
          }}
        >
          BIENVENIDOS A LA COMANDA VIRTUAL DE LAS GAMBUSINAS
        </Text>
        <View
          style={{
            marginTop: 50,
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
        </View>
        <View style={{ marginTop: 50, gap: 40 }}>
          <Text
            style={{ textAlign: "center", fontWeight: "bold", fontSize: 20 }}
          >
            Usuario:
          </Text>
          <TextInput
            style={{ textAlign: "center", fontSize: 18 }}
            placeholder="Usuario"
            onChangeText={(text) => setUsername(text)}
            value={username}
          />
          <Text
            style={{ textAlign: "center", fontWeight: "bold", fontSize: 20 }}
          >
            Contraseña:
          </Text>
          <TextInput
            style={{ textAlign: "center", fontSize: 18 }}
            placeholder="Contraseña"
            secureTextEntry={true}
            onChangeText={(text) => setPassword(text)}
            value={password}
          />
        </View>
        <View style={{ marginTop: 70, alignItems: "center", justifyContent: "center" }}>
          <TouchableOpacity
            style={{
              borderRadius: 20,
              backgroundColor: "orange",
              width: 180,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleLogin}
          >
            <Text style={{ color: "black", fontSize: 25 }}>Ingresar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Login;
