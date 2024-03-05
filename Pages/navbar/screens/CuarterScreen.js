import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { COMANDA_API, SELECTABLE_API_GET } from "../../../apiConfig";

const CuarterScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [comandas, setComandas] = useState([]);

  useEffect(() => {
    obtenerMesas();
  }, []);

  const obtenerMesas = async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET);
      setMesas(response.data);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  };

  const handleMesaClick = async (numMesa) => {
    setSelectedMesa(numMesa);
    setModalVisible(true);
    try {
      const response = await axios.get(`${COMANDA_API}?mesa=${numMesa}`);
      setComandas(response.data);
    } catch (error) {
      console.error("Error al obtener las comandas:", error.message);
    }
  };

  const renderComandaItem = ({ item }) => (
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
      <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
        Observaciones: {item.observaciones}
      </Text>
      <FlatList
        data={item.platos}
        renderItem={({ item }) => (
          <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
            {item.nombre} - S/ {item.precio}
          </Text>
        )}
        keyExtractor={(item) => item._id}
      />
    </View>
  );

  // Filtrar las comandas por la mesa seleccionada
  const comandasFiltradas = comandas.filter(
    (comanda) => comanda.mesas.nummesa === selectedMesa
  );

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
          {mesas.map((mesa) => (
            <TouchableOpacity
              key={mesa._id}
              onPress={() => handleMesaClick(mesa.nummesa)}
            >
              <View
                style={{
                  width: 100,
                  height: 100,
                  justifyContent: "center",
                  alignItems: "center",
                  margin: 5,
                  borderRadius: 10,
                  backgroundColor: mesa.isActive ? "green" : "red",
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  {mesa.nummesa}
                </Text>
                <MaterialCommunityIcons name="table-picnic" size={40} />
              </View>
            </TouchableOpacity>
          ))}
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
            <Text style={{ fontSize: 18, marginBottom: 10, textAlign:"center" }}>
              Número de mesa: {selectedMesa}
            </Text>
            <FlatList
              data={comandasFiltradas}
              renderItem={renderComandaItem}
              keyExtractor={(item) => item._id}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text
                style={{ color: "blue", textAlign: "center", marginTop:10 ,marginBottom: 10 }}
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
