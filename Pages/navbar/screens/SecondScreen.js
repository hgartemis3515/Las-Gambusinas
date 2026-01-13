import React, { useState, useEffect } from "react";
import {
  Text,
  SafeAreaView,
  View,
  Button,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Comandastyle from "../../../Components/aditionals/Comandastyle";
import Selectable from "../../../Components/selects/selectable";
import axios from "axios";
import { COMANDA_API } from "../../../apiConfig";

const SecondScreen = () => {
  const [cleanComanda, setCleanComanda] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedTableInfo, setSelectedTableInfo] = useState(null);
  const [selectedPlatos, setSelectedPlatos] = useState([]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [cantidadesComanda, setCantidadesComanda] = useState([]);
  const [isSendingComanda, setIsSendingComanda] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        if (user !== null) {
          setUserInfo(JSON.parse(user));
        }
      } catch (error) {
        console.error("Error fetching user info: ", error);
      }

      try {
        const mesaSeleccionada = await AsyncStorage.getItem("mesaSeleccionada");
        if (mesaSeleccionada !== null) {
          const [id, nummesa] = mesaSeleccionada.split("-");
          setSelectedTableInfo({ id, nummesa });
        }
      } catch (error) {
        console.error("Error fetching selected table info: ", error);
      }

      try {
        const storedDetails = await AsyncStorage.getItem("additionalDetails");
        if (storedDetails !== null) {
          setAdditionalDetails(storedDetails);
        }
      } catch (error) {
        console.error("Error fetching additional details: ", error);
      }

      try {
        const storedCantidades = await AsyncStorage.getItem("cantidadesComanda");
        if (storedCantidades !== null) {
          const cantidades = JSON.parse(storedCantidades);
          setCantidadesComanda(cantidades);
        }
      } catch (error) {
        console.error("Error al obtener las cantidades de la comanda:", error);
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSelectMesa = async (mesaId, mesaNum) => {
    try {
      const mesaSeleccionada = `${mesaId}-${mesaNum}`;
      await AsyncStorage.setItem("mesaSeleccionada", mesaSeleccionada);
      setSelectedTableInfo({ id: mesaId, nummesa: mesaNum });
      setModalVisible(false);
    } catch (error) {
      console.error("Error al seleccionar la mesa:", error.message);
    }
  };

  const handleEnviarComanda = async () => {
    try {
      setIsSendingComanda(true);
      
      console.log('🚀 Iniciando envío de comanda...');
      console.log('📋 Datos disponibles:');
      console.log('  - userInfo:', userInfo);
      console.log('  - selectedTableInfo:', selectedTableInfo);
      console.log('  - cantidadesComanda:', cantidadesComanda);
      console.log('  - additionalDetails:', additionalDetails);

      // Validar que el usuario esté logueado
      if (!userInfo || !userInfo.id) {
        Alert.alert("Error", "No hay usuario logueado. Por favor inicia sesión.");
        setIsSendingComanda(false);
        return;
      }

      // Validar que haya una mesa seleccionada
      if (!selectedTableInfo || !selectedTableInfo.id) {
        Alert.alert("Error", "Por favor selecciona una mesa antes de enviar la comanda.");
        setIsSendingComanda(false);
        return;
      }

      // Obtener platos seleccionados de AsyncStorage
      const selectedPlatos_ = await AsyncStorage.getItem("selectedPlates");
      if (!selectedPlatos_) {
        Alert.alert("Error", "No hay platos seleccionados. Por favor agrega al menos un plato.");
        setIsSendingComanda(false);
        return;
      }

      const platos = JSON.parse(selectedPlatos_);
      console.log('🍽️ Platos seleccionados:', platos);

      if (!Array.isArray(platos) || platos.length === 0) {
        Alert.alert("Error", "No hay platos seleccionados. Por favor agrega al menos un plato.");
        setIsSendingComanda(false);
        return;
      }

      // Validar que las cantidades coincidan con los platos
      const cantidades = cantidadesComanda || [];
      if (cantidades.length !== platos.length) {
        Alert.alert("Error", `La cantidad de platos (${platos.length}) no coincide con las cantidades (${cantidades.length}). Por favor verifica.`);
        setIsSendingComanda(false);
        return;
      }

      // Formatear platos con estado 'pendiente' y validar _id
      const platosData = platos.map((plato, index) => {
        if (!plato._id) {
          throw new Error(`El plato en la posición ${index} no tiene _id válido`);
        }
        return {
          plato: plato._id,
          estado: 'pendiente'
        };
      });

      // Convertir cantidades a números y validar
      const cantidadesNumericas = cantidades.map((cant, index) => {
        const num = parseInt(cant, 10);
        if (isNaN(num) || num <= 0) {
          throw new Error(`La cantidad en la posición ${index} no es válida: ${cant}`);
        }
        return num;
      });

      // Preparar el body para el backend
      const comandaData = {
        mozos: userInfo.id,  // ObjectId del mozo
        mesas: selectedTableInfo.id,  // ObjectId de la mesa
        platos: platosData,  // Array con { plato: ObjectId, estado: 'pendiente' }
        cantidades: cantidadesNumericas,  // Array de números
        observaciones: additionalDetails || "",  // String (opcional)
        status: "ingresante",  // Estado inicial de la comanda
        IsActive: true  // Comanda activa
      };

      console.log('📤 Datos a enviar al backend:');
      console.log(JSON.stringify(comandaData, null, 2));

      // Enviar al backend
      const response = await axios.post(COMANDA_API, comandaData);
      
      console.log('✅ Respuesta del backend:', response.data);
      console.log('✅ Comanda enviada exitosamente');

      // Limpiar formulario después de envío exitoso
      await handleLimpiarComanda();
      
      Alert.alert("✅ Éxito", "Comanda enviada exitosamente. La cocina la recibirá en breve.");
      
    } catch (error) {
      console.error("❌ Error al enviar la comanda:");
      console.error("  - Error completo:", error);
      console.error("  - Mensaje:", error.message);
      console.error("  - Response:", error.response?.data);
      console.error("  - Status:", error.response?.status);
      
      let errorMessage = "No se pudo enviar la comanda.";
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("❌ Error", errorMessage);
    } finally {
      setIsSendingComanda(false);
    }
  };

  const handleLimpiarComanda = async () => {
    try {
      console.log('🧹 Limpiando comanda...');
      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("additionalDetails");
      await AsyncStorage.removeItem("cantidadesComanda");
      setSelectedTableInfo(null);
      setSelectedPlatos([]);
      setAdditionalDetails("");
      setCantidadesComanda([]);
      setCleanComanda(true);
      console.log('✅ Comanda limpiada exitosamente');
    } catch (error) {
      console.error("❌ Error al limpiar la comanda:", error);
      Alert.alert("Error", "No se pudo limpiar la comanda");
    }
  };

  const handleCantidadesChange = (cantidades) => {
    setCantidadesComanda(cantidades);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flexDirection: "column", flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <Text style={{ fontWeight: "bold", fontSize: 18, marginLeft: 20 }}>
              Mozo: {userInfo ? `${userInfo.name}` : "Nombre de usuario"}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              marginLeft: 20,
              marginTop: 30,
              gap: 80,
            }}
          >
            <Text style={{ fontWeight: "bold", fontSize: 18 }}>Mesa:</Text>
            <Button
              title={
                selectedTableInfo
                  ? `Mesa ${selectedTableInfo.nummesa}`
                  : "Seleccionar Mesa"
              }
              onPress={() => setModalVisible(true)}
            />
          </View>
          <View style={{ marginTop: 40 }}>
            <Comandastyle onCantidadesChange={handleCantidadesChange} cleanComanda={cleanComanda} setCleanComanda={setCleanComanda} />
          </View>
          <View style={{ gap:20, marginTop: 32, maxWidth: "60%", justifyContent:"center", alignSelf: "center"  }}>
            <Button 
              title={isSendingComanda ? "Enviando..." : "Enviar comanda"} 
              onPress={handleEnviarComanda} 
              disabled={isSendingComanda} 
            />
            <Button 
              title="Limpiar Comanda" 
              onPress={handleLimpiarComanda}
              disabled={isSendingComanda}
            />
          </View>

          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => {
              setModalVisible(false);
            }}
          >
            <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text style={{ fontSize: 20, marginBottom: 20 }}>
                Seleccionar Mesa
              </Text>
              <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true}>
                <Selectable
                  onSelectTable={(tableNumber) => {
                    handleSelectMesa(tableNumber.id, tableNumber.nummesa);
                    setModalVisible(false);
                  }}
                />
              </ScrollView>
              <Button title="Cerrar" onPress={() => setModalVisible(false)} />
            </View>
            </View>
          </Modal>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    height: "60%",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SecondScreen;
