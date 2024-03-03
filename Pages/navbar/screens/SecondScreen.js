import React, { useState, useEffect } from "react";
import {
  Text,
  SafeAreaView,
  View,
  Button,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Comandastyle from "../../../Components/aditionals/Comandastyle";
import Selectable from "../../../Components/selects/selectable";
import axios from "axios";
import mongoose from "mongoose";

const SecondScreen = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [selectedTableInfo, setSelectedTableInfo] = useState(null);
  const [selectedPlatos, setSelectedPlatos] = useState([]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

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
      const selectedPlatos_ = await AsyncStorage.getItem("selectedPlates");
      const platosIds = JSON.parse(selectedPlatos_).map(
        (plato) => new mongoose.Types.ObjectId(plato)
      );
      const response = await axios.post("http://192.168.1.5:8000/api/comanda", {
        mozos: userInfo.id,
        mesas: selectedTableInfo.id,
        platos: platosIds,
        observaciones: additionalDetails,
      });
      Alert.alert("Comanda enviada exitosamente");
    } catch (error) {
      console.error("Error al enviar la comanda:", error);
      Alert.alert("Error", "No se pudo enviar la comanda");
    }
  };

  const handleSelectPlato = (platoId) => {
    const platoIndex = selectedPlatos.findIndex((plato) => plato === platoId);
    if (platoIndex === -1) {
      setSelectedPlatos([...selectedPlatos, platoId]);
    } else {
      const updatedPlatos = selectedPlatos.filter((plato) => plato !== platoId);
      setSelectedPlatos(updatedPlatos);
    }
  };

  const handleLimpiarComanda = async () => {
    try {
      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("additionalDetails");
      setSelectedTableInfo(null);
      setSelectedPlatos([]);
      setAdditionalDetails("");
      Alert.alert("Comanda limpiada exitosamente");
    } catch (error) {
      console.error("Error al limpiar la comanda:", error);
      Alert.alert("Error", "No se pudo limpiar la comanda");
    }
  };

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ flexDirection: "column" }}>
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
            <Comandastyle />
          </View>
          <View style={{ gap:20, marginTop: 32 }}>
            <Button title="Enviar comanda" onPress={handleEnviarComanda} />
            <Button title="Limpiar Comanda" onPress={handleLimpiarComanda} />
          </View>
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
              <Selectable
                onSelectTable={(tableNumber) =>
                  handleSelectMesa(tableNumber.id, tableNumber.nummesa)
                }
              />
              <Button title="Cerrar" onPress={() => setModalVisible(false)} />
            </View>
          </View>
        </Modal>
      </ScrollView>
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
