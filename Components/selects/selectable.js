import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SELECTABLE_API_GET, COMANDASEARCH_API_GET } from "../../apiConfig";
import moment from "moment-timezone";

const MesasScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState(null);
  const [mesaSeleccionadaNum, setMesaSeleccionadaNum] = useState(null);
  const [comandas, setComandas] = useState([]);

  useEffect(() => {
    obtenerMesas();
    obtenerMesaSeleccionada();
    obtenerComandasHoy();
  }, []);

  const obtenerMesas = async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET);
      setMesas(response.data);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  };

  const obtenerMesaSeleccionada = async () => {
    try {
      const mesaSeleccionada = await AsyncStorage.getItem("mesaSeleccionada");
      if (mesaSeleccionada) {
        const [id, nummesa] = mesaSeleccionada.split("-");
        setMesaSeleccionadaId(id);
        setMesaSeleccionadaNum(nummesa);
        console.log("Mesa seleccionada almacenada:", mesaSeleccionada);
      }
    } catch (error) {
      console.error("Error al obtener la mesa seleccionada:", error.message);
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

  const handleSelectMesa = async (mesaId, mesaNum) => {
    try {
      const mesa = mesas.find((m) => m._id === mesaId);
      const isActive = !mesa.isActive;

      await axios.put(`https://backend-lasgambusinas.onrender.com/api/mesas/${mesaId}`, {
        isActive,
      });

      const mesaSeleccionada = `${mesaId}-${mesaNum}`;
      await AsyncStorage.setItem("mesaSeleccionada", mesaSeleccionada);
      console.log("Mesa seleccionada:", mesaSeleccionada);
      setMesaSeleccionadaId(mesaId);
      setMesaSeleccionadaNum(mesaNum);
      obtenerMesas();
    } catch (error) {
      console.error("Error al seleccionar la mesa:", error.message);
    }
  };

  return (
    <ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {mesas.map((mesa) => {
          const tieneComandasHoy = comandas.some(
            (comanda) => comanda.mesas.nummesa === mesa.nummesa
          );
          const mesaStyle = {
            backgroundColor: tieneComandasHoy ? "red" : "green",
            padding: 8,
            margin: 2,
          };
          return (
            <TouchableOpacity
              key={mesa._id}
              style={mesaStyle}
              onPress={() => handleSelectMesa(mesa._id, mesa.nummesa)}
            >
              <Text
                style={{
                  color: "black",
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: 20,
                }}
              >
                {mesa.nummesa}
              </Text>
              <MaterialCommunityIcons name="table-picnic" size={40} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

export default MesasScreen;
