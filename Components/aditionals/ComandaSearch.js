import React, { useEffect, useState } from "react";
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from "axios";

const ComandaSearch = () => {
  const [comandaData, setComandaData] = useState([]);
  const [mozoName, setMozoName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await AsyncStorage.getItem("user");
        if (user !== null) {
          const userInfo = JSON.parse(user);
          setMozoName(userInfo.name);
        }
      } catch (error) {
        console.error("Error fetching user info: ", error);
      }
      
      axios.get("http://192.168.1.5:8000/api/comanda")
        .then(response => {
          const filteredComandas = response.data.filter(comanda => comanda.mozos.name === mozoName);
          setComandaData(filteredComandas);
        })
        .catch(error => {
          console.error("Error fetching comanda data:", error);
        });
    };

    fetchData();

    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [mozoName]);

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
      await axios.delete(`http://192.168.1.5:8000/api/comanda/${comandaId}`);
      const updatedComandas = comandaData.filter(comanda => comanda._id !== comandaId);
      setComandaData(updatedComandas);
      console.log(`Comanda con ID ${comandaId} eliminada`);
    } catch (error) {
      console.error("Error al eliminar la comanda:", error);
    }
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
            <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold" }}>
              Cantidad
            </Text>
            <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold" }}>
              Pedido
            </Text>
          </View>
          <FlatList
            data={item.platos}
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
                <Text style={{ flex: 1, textAlign: "center" }}>{item.cantidad}</Text>
                <Text style={{ flex: 1, textAlign: "center" }}>{item.nombre}</Text>
              </View>
            )}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
        <View style={{ marginTop:20, marginBottom: 30 }}>
          <Text style={{ textAlign:"center", fontWeight: "bold", fontSize: 20 }}>Detalles del Pedido</Text>
          <Text style={{ textAlign:"center", marginTop: 20, fontWeight: "bold" }}>{item.observaciones}</Text>
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
