import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = 'http://192.168.1.5:8000/api/mesas';

const MesasScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState(null);
  const [mesaSeleccionadaNum, setMesaSeleccionadaNum] = useState(null);

  useEffect(() => {
    obtenerMesas();
    obtenerMesaSeleccionada();
  }, []);

  const obtenerMesas = async () => {
    try {
      const response = await axios.get(API_URL);
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

  const handleSelectMesa = async (mesaId, mesaNum) => {
    try {
      // Obtener el estado actual de la mesa
      const mesa = mesas.find((m) => m._id === mesaId);
      const isActive = !mesa.isActive; // Cambiar el estado

      // Actualizar el estado de la mesa en el backend
      await axios.put(`http://192.168.1.5:8000/api/mesas/${mesaId}`, {
        isActive,
      });

      // Almacenar el _id y el nummesa de la mesa seleccionada en AsyncStorage
      const mesaSeleccionada = `${mesaId}-${mesaNum}`;
      await AsyncStorage.setItem("mesaSeleccionada", mesaSeleccionada);
      console.log("Mesa seleccionada:", mesaSeleccionada);
      
      // Actualizar el estado local de la mesa seleccionada
      setMesaSeleccionadaId(mesaId);
      setMesaSeleccionadaNum(mesaNum);

      // Actualizar la lista de mesas
      obtenerMesas();
    } catch (error) {
      console.error("Error al seleccionar la mesa:", error.message);
    }
  };

  return (
    <View>
      {mesas.map((mesa) => (
        <TouchableOpacity
          key={mesa._id}
          style={{
            backgroundColor: mesa.isActive && mesa._id !== mesaSeleccionadaId ? "green" : "red",
            padding: 10,
            margin: 5,
          }}
          onPress={() => handleSelectMesa(mesa._id, mesa.nummesa)}
        >
          <Text style={{ color: "white" }}>{mesa.nummesa}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default MesasScreen;
