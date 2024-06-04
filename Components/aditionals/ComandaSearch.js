import React, { useEffect, useState } from "react";
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, Alert } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMANDASEARCH_API_GET } from "../../apiConfig";
import moment from "moment-timezone";

const ComandaSearch = () => {
  const [comandaData, setComandaData] = useState([]);
  const [mozoName, setMozoName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentDate = moment().tz('America/Lima').format('YYYY-MM-DD');
        const response = await axios.get(`${COMANDASEARCH_API_GET}/fecha/${currentDate}`);
        const user = await AsyncStorage.getItem("user");
        if (user !== null) {
          const userInfo = JSON.parse(user);
          setMozoName(userInfo.name);
          const filteredComandas = response.data.filter(comanda => comanda.mozos.name === userInfo.name);
          setComandaData(filteredComandas);
        }
      } catch (error) {
        console.error("Error fetching comanda data:", error);
      }
    };
    fetchData();

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleComandaPress = (comandaId) => {
    Alert.alert(
      "Eliminar comanda",
      "¿Estás seguro de que quieres eliminar esta comanda?",
      [
        {
          text: "Cancelar",
          onPress: () => console.log("Cancelado"),
          style: "cancel",
        },
        { text: "Eliminar", onPress: () => handleEliminarComanda(comandaId) },
      ],
      { cancelable: false }
    );
  };

  const handleEliminarComanda = async (comandaId) => {
    try {
      await axios.delete(`https://backend-lasgambusinas.onrender.com/api/comanda/${comandaId}`);
      const updatedComandas = comandaData.filter(comanda => comanda._id !== comandaId);
      setComandaData(updatedComandas);
      console.log(`Comanda con ID ${comandaId} eliminada`);
    } catch (error) {
      console.error("Error al eliminar la comanda:", error);
    }
  };

  const calcularTotal = (platos, cantidades) => {
    let total = 0;
    platos.forEach((plato, index) => {
      total += plato.precio * cantidades[index];
    });
    return total;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleComandaPress(item._id)}>
      <View style={{ borderColor: "orange", borderWidth: 4, borderRadius: 30, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20, marginBottom: 20 }}>
          <Text>
            Mesa: {item.mesas.nummesa}
          </Text>
          <Text>
            Mozo: {item.mozos.name}
          </Text>
        </View>
        <View style={{ flexDirection: "column" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: "lightgray",
              backgroundColor: "lightblue",
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "bold", width:"25%" }}>
              Cantidad
            </Text>
            <Text style={{ textAlign: "center", fontWeight: "bold", width:"75%" }}>
              Pedido
            </Text>
          </View>
          <FlatList
            data={item.platos.map((plato, index) => ({ ...plato, cantidad: item.cantidades[index] }))}
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "lightgray",
                }}
              >
                <Text style={{ textAlign: "center", width:"25%" }}>{item.cantidad}</Text>
                <Text style={{ textAlign: "center", width:"75%" }}>{item.nombre}</Text>
              </View>
            )}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
        <View style={{ marginTop:20 }}>
          <Text style={{ textAlign:"center", fontWeight: "bold", fontSize: 20 }}>Detalles del Pedido</Text>
          <Text style={{ textAlign:"center", marginTop: 20, fontWeight: "bold" }}>{item.observaciones}</Text>
        </View>
        <View style={{ marginTop:30, marginBottom:20 }}>
          <Text style={{ textAlign:"center", fontWeight: "normal", fontSize: 20 }}>Cuenta Total: {calcularTotal(item.platos, item.cantidades)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView>
      <FlatList
        data={comandaData}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </SafeAreaView>
  );
};

export default ComandaSearch;