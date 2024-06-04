import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET } from "../../../apiConfig";
import moment from "moment-timezone";

const CuarterScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [comandas, setComandas] = useState([]);

  useEffect(() => {
    const interval = setInterval(obtenerMesas, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    obtenerComandasHoy();
  }, [mesas]);

  const obtenerMesas = async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET);
      setMesas(response.data);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  };

  const obtenerComandasHoy = async () => {
    try {
      const currentDate = moment().tz('America/Lima').format('YYYY-MM-DD');
      const response = await axios.get(
        `${COMANDASEARCH_API_GET}/fecha/${currentDate}`
      );
      setComandas(response.data);
    } catch (error) {
      console.error("Error al obtener las comandas de hoy:", error.message);
    }
  };

  const handleMesaClick = async (numMesa) => {
    setSelectedMesa(numMesa);
    setModalVisible(true);
  };

  const renderComandaItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        Alert.alert(
          "¿Comanda cancelada?",
          "",
          [
            {
              text: "No",
              onPress: () => console.log("Cancel Pressed"),
              style: "cancel",
            },
            { text: "Sí", onPress: () => handleCancelComanda(item._id) },
          ],
          { cancelable: false }
        );
      }}
    >
      <View
        style={{
          borderWidth: 4,
          borderColor: "orange",
          borderRadius: 14,
          gap: 10,
          marginBottom: 20,
          padding: 2,
        }}
      >
        <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
          Mozo: {item.mozos.name}
        </Text>
        <FlatList
          data={item.platos.map((plato, index) => ({
            ...plato,
            cantidad: item.cantidades[index],
          }))}
          renderItem={({ item }) => (
            <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
              Cantidad: {item.cantidad} - {item.nombre}
            </Text>
          )}
          keyExtractor={(item) => item._id}
        />
        <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
          Observaciones: {item.observaciones}
        </Text>
        <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
          Cuenta Total: {calcularTotal(item.platos, item.cantidades)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const handleCancelComanda = async (comandaId) => {
    try {
      await axios.put(`${COMANDASEARCH_API_GET}/${comandaId}/estado`, {
        nuevoEstado: false,
      });
      obtenerComandasHoy();
    } catch (error) {
      console.error("Error al cancelar la comanda:", error.message);
    }
  };

  const calcularTotal = (platos, cantidades) => {
    let total = 0;
    platos.forEach((plato, index) => {
      total += plato.precio * cantidades[index];
    });
    return total;
  };

  return (
    <SafeAreaView>
      <ScrollView>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {mesas.map((mesa) => {
            const tieneComandasHoy = comandas.some(
              (comanda) => comanda.mesas.nummesa === mesa.nummesa
            );
            const mesaStyle = {
              width: 100,
              height: 100,
              justifyContent: "center",
              alignItems: "center",
              margin: 5,
              borderRadius: 10,
              backgroundColor: tieneComandasHoy ? "red" : "green",
            };
            return (
              <TouchableOpacity
                key={mesa._id}
                onPress={() => handleMesaClick(mesa.nummesa)}
              >
                <View style={mesaStyle}>
                  <Text
                    style={{
                      textAlign: "center",
                      color: "black",
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    {mesa.nummesa}
                  </Text>
                  <MaterialCommunityIcons name="table-picnic" size={40} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 20,
              borderRadius: 10,
              width: "80%",
              maxHeight: "80%",
            }}
          >
            <Text
              style={{ fontSize: 18, marginBottom: 10, textAlign: "center" }}
            >
              Número de mesa: {selectedMesa}
            </Text>
            <FlatList
              data={comandas}
              renderItem={renderComandaItem}
              keyExtractor={(item) => item._id}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text
                style={{
                  color: "blue",
                  textAlign: "center",
                  marginTop: 10,
                  marginBottom: 10,
                }}
              >
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CuarterScreen;
