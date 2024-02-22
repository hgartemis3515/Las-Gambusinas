import React, { useState, useEffect } from "react";
import {
  Text,
  SafeAreaView,
  View,
  Button,
  ScrollView,
  Modal,
  StyleSheet
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Comandastyle from "../../../Components/aditionals/Comandastyle";
import Selectable from "../../../Components/selects/selectable";

const SecondScreen = () => {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString();
  const formattedTime = currentDate.toLocaleTimeString();
  const [modalVisible, setModalVisible] = useState(false);
  const [userInfo, setUserInfo] = useState(null); // Estado para almacenar la información del usuario
  const [selectedTable, setSelectedTable] = useState(null); // Estado para almacenar el número de la mesa seleccionada

  useEffect(() => {
    // Función asincrónica para obtener la información del usuario del AsyncStorage
    const fetchUserInfo = async () => {
      try {
        const user = await AsyncStorage.getItem('user'); // Recupera la información del usuario del AsyncStorage
        if (user !== null) {
          setUserInfo(JSON.parse(user)); // Establece la información del usuario en el estado
        }
      } catch (error) {
        console.error("Error fetching user info: ", error);
      }
    };

    fetchUserInfo(); // Llama a la función para obtener la información del usuario al cargar el componente
  }, []);

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
              {formattedDate} {formattedTime}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 20, marginTop: 30, gap:80 }}>
            <Text style={{ fontWeight: "bold", fontSize: 18 }}>Mesa:</Text>
            <Button
              title={selectedTable ? `Mesa ${selectedTable}` : "Seleccionar Mesa"} // Modifica el título del botón para mostrar el número de la mesa seleccionada si existe
              onPress={() => setModalVisible(true)}
            />
          </View>
          <View style={{ marginTop: 40 }}>
            <Comandastyle />
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
              <Text style={{ fontSize: 20, marginBottom: 20 }}>Seleccionar Mesa</Text>
              <Selectable onSelectTable={(tableNumber) => {
                setSelectedTable(tableNumber); // Actualiza el número de la mesa seleccionada
                setModalVisible(false); // Cierra el modal después de seleccionar una mesa
              }} />
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
