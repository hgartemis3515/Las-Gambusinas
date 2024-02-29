import React, { useState, useEffect } from "react";
import {
  Text,
  SafeAreaView,
  View,
  Button,
  ScrollView,
  Modal,
  StyleSheet,
  Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Comandastyle from "../../../Components/aditionals/Comandastyle";
import Selectable from "../../../Components/selects/selectable";
import axios from 'axios';

const SecondScreen = () => {
  const [userInfo, setUserInfo] = useState(null); 
  const [selectedTableInfo, setSelectedTableInfo] = useState(null); 
  const [selectedPlatos, setSelectedPlatos] = useState([]); // Estado para almacenar los platos seleccionados
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Obtener datos de usuario
      try {
        const user = await AsyncStorage.getItem('user'); 
        if (user !== null) {
          setUserInfo(JSON.parse(user)); 
        }
      } catch (error) {
        console.error("Error fetching user info: ", error);
      }

      // Obtener datos de mesa seleccionada
      try {
        const mesaSeleccionada = await AsyncStorage.getItem('mesaSeleccionada'); 
        if (mesaSeleccionada !== null) {
          const [id, nummesa] = mesaSeleccionada.split("-");
          setSelectedTableInfo({ id, nummesa }); 
        }
      } catch (error) {
        console.error("Error fetching selected table info: ", error);
      }
    };

    // Llama a la función fetchData al cargar el componente
    fetchData(); 

    // Configura un temporizador para actualizar los datos cada segundo
    const intervalId = setInterval(fetchData, 1000);

    // Limpia el temporizador cuando el componente se desmonta
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
      const response = await axios.post('http://192.168.1.8:8000/api/comanda', {
        mozos: userInfo.id,
        mesas: selectedTableInfo.id,
        platos: selectedPlatos, // Usa el estado selectedPlatos para enviar los platos seleccionados
      });
      Alert.alert('Comanda enviada exitosamente');
    } catch (error) {
      console.error('Error al enviar la comanda:', error);
      Alert.alert('Error', 'No se pudo enviar la comanda');
    }
  };

  // Función para manejar la selección de platos
  const handleSelectPlato = (platoId) => {
    // Verifica si el plato ya está seleccionado
    const platoIndex = selectedPlatos.findIndex(plato => plato === platoId);
    if (platoIndex === -1) {
      // Si el plato no está en la lista, agrégalo
      setSelectedPlatos([...selectedPlatos, platoId]);
    } else {
      // Si el plato está en la lista, quítalo
      const updatedPlatos = [...selectedPlatos];
      updatedPlatos.splice(platoIndex, 1);
      setSelectedPlatos(updatedPlatos);
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
            <Text style={{ marginRight: 20, fontWeight: "bold", fontSize: 17 }}>
              {new Date().toLocaleString()}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginTop: 30, gap:80 }}>
            <Text style={{ fontWeight: "bold", fontSize: 18 }}>Mesa:</Text>
            <Button
              title={selectedTableInfo ? `Mesa ${selectedTableInfo.nummesa}` : "Seleccionar Mesa"} 
              onPress={() => setModalVisible(true)}
            />
          </View>
          <View style={{ marginTop: 40 }}>
            <Comandastyle />
          </View>
          <Button title="Enviar comanda" onPress={handleEnviarComanda} />
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
              <Text style={{ fontSize: 20, marginBottom: 20 }}>Seleccionar Mesa</Text>
              <Selectable onSelectTable={(tableNumber) => handleSelectMesa(tableNumber.id, tableNumber.nummesa)} />
              <Button
                title="Cerrar"
                onPress={() => setModalVisible(false)}
              />
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
