import React, { useState, useEffect, useCallback } from "react";
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
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

const CuarterScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [comandas, setComandas] = useState([]);
  const [comandasMesa, setComandasMesa] = useState([]);

  useEffect(() => {
    const interval = setInterval(obtenerMesas, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mesas.length) {
      obtenerComandasHoy();
    }
  }, [mesas]);

  const obtenerMesas = useCallback(async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET);
      setMesas(response.data);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  }, []);

  const obtenerComandasHoy = useCallback(async () => {
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const response = await axios.get(
        `${COMANDASEARCH_API_GET}/fecha/${currentDate}`
      );
      setComandas(response.data);
    } catch (error) {
      console.error("Error al obtener las comandas de hoy:", error.message);
    }
  }, []);

  const handleMesaClick = useCallback(
    (numMesa) => {
      setSelectedMesa(numMesa);
      const comandasFiltradas = comandas.filter(
        (comanda) => comanda.mesas.nummesa === numMesa
      );
      setComandasMesa(comandasFiltradas);
      setModalVisible(true);
    },
    [comandas]
  );

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
            { text: "Imprimir", onPress: () => handlePrintComanda(item) },
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
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
            Mozo: {item.mozos.name}
          </Text>
          <Text>Nro: {item.comandaNumber}</Text>
        </View>
        <FlatList
          data={item.platos.map((plato, index) => ({
            ...plato,
            cantidad: item.cantidades[index],
          }))}
          renderItem={({ item }) => (
            <Text style={{ fontSize: 15, paddingHorizontal: 4 }}>
              Cantidad: {item.cantidad} - {item.plato.nombre}
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
      total += plato.plato.precio * cantidades[index];
    });
    return total;
  };

  const handlePrintComanda = async (comanda) => {
    const htmlContent = `
      <html>
        <body>
          <h1>Comanda</h1>
          <p>Fecha: ${moment().tz("America/Lima").format("DD/MM/YYYY HH:mm:ss")}</p>
          <p>Mozo: ${comanda.mozos.name}</p>
          <p>Nro: ${comanda.comandaNumber}</p>
          <p>Mesa: ${comanda.mesas.nummesa}</p>
          <h2>Platos</h2>
          <ul>
            ${comanda.platos.map((plato, index) => `
              <li>${comanda.cantidades[index]} : ${plato.plato.nombre} - S/.${plato.plato.precio * comanda.cantidades[index]} </li>
            `).join('')}
          </ul>
          <p>Observaciones: ${comanda.observaciones}</p>
          <p>Cuenta Total: ${calcularTotal(comanda.platos, comanda.cantidades)}</p>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const newUri = `${FileSystem.documentDirectory}comanda.pdf`;
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });
      await shareAsync(newUri, { UTI: '.pdf', mimeType: 'application/pdf' });
      console.log("Comanda impresa exitosamente");
    } catch (error) {
      console.error("Error al imprimir la comanda:", error);
    }
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
              data={comandasMesa}
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
