import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET } from "../../../apiConfig";
import moment from "moment-timezone";

const CuarterScreen = () => {
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);

  useEffect(() => {
    obtenerMesas();
    obtenerComandasHoy();
    const interval = setInterval(() => {
      obtenerMesas();
      obtenerComandasHoy();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const obtenerMesas = useCallback(async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET, { timeout: 5000 });
      setMesas(response.data);
      console.log("🪑 Mesas obtenidas:", response.data.length);
    } catch (error) {
      console.error("Error al obtener las mesas:", error.message);
    }
  }, []);

  const obtenerComandasHoy = useCallback(async () => {
    try {
      const currentDate = moment().tz("America/Lima").format("YYYY-MM-DD");
      const response = await axios.get(
        `${COMANDASEARCH_API_GET}/fecha/${currentDate}`,
        { timeout: 5000 }
      );
      setComandas(response.data);
      console.log("📋 Comandas obtenidas:", response.data.length);
    } catch (error) {
      console.error("Error al obtener las comandas de hoy:", error.message);
    }
  }, []);

  const getComandasPorMesa = (mesaNum) => {
    return comandas.filter(
      (comanda) => comanda.mesas?.nummesa === mesaNum && comanda.IsActive !== false
    );
  };

  const getEstadoMesa = (mesaNum) => {
    const comandasMesa = getComandasPorMesa(mesaNum);
    if (comandasMesa.length === 0) return "inactiva";
    
    const todasCompletadas = comandasMesa.every(
      (c) => c.status?.toLowerCase() === "entregado" || c.status?.toLowerCase() === "completado"
    );
    
    if (todasCompletadas && comandasMesa.length > 0) return "completada";
    return "activa";
  };

  const mesasActivas = mesas.filter((mesa) => getEstadoMesa(mesa.nummesa) === "activa");
  const mesasCompletadas = mesas.filter((mesa) => getEstadoMesa(mesa.nummesa) === "completada");
  const mesasInactivas = mesas.filter((mesa) => getEstadoMesa(mesa.nummesa) === "inactiva");

  const renderMesaActiva = (mesa) => {
    const comandasMesa = getComandasPorMesa(mesa.nummesa);
    const count = comandasMesa.length;
    return (
      <View key={mesa._id} style={styles.mesaItem}>
        <Text style={styles.mesaText}>
          Mesa {mesa.nummesa}: {count} comanda{count !== 1 ? "s" : ""} activa{count !== 1 ? "s" : ""}
        </Text>
      </View>
    );
  };

  const renderMesaCompletada = (mesa) => {
    return (
      <View key={mesa._id} style={styles.mesaItem}>
        <Text style={styles.mesaText}>
          Mesa {mesa.nummesa}: ✅ Completada
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            🪑 MESAS DEL TURNO ({mesas.length})
          </Text>
        </View>

        {/* Mesas Activas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            ACTIVAS ({mesasActivas.length + mesasCompletadas.length}):
          </Text>
          {mesasActivas.map(renderMesaActiva)}
          {mesasCompletadas.map(renderMesaCompletada)}
          {mesasActivas.length === 0 && mesasCompletadas.length === 0 && (
            <Text style={styles.emptyText}>No hay mesas activas</Text>
          )}
        </View>

        {/* Mesas Inactivas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            INACTIVAS ({mesasInactivas.length}):
          </Text>
          <View style={styles.inactivasContainer}>
            {mesasInactivas.map((mesa, index) => (
              <Text key={mesa._id} style={styles.inactivaText}>
                {mesa.nummesa}
                {index < mesasInactivas.length - 1 ? "," : ""}
              </Text>
            ))}
          </View>
          {mesasInactivas.length === 0 && (
            <Text style={styles.emptyText}>No hay mesas inactivas</Text>
          )}
        </View>

        {/* Vista de Grid de Mesas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vista General:</Text>
          <View style={styles.mesasGrid}>
            {mesas.map((mesa) => {
              const estado = getEstadoMesa(mesa.nummesa);
              const comandasMesa = getComandasPorMesa(mesa.nummesa);
              const count = comandasMesa.length;
              
              let backgroundColor = "#00C851"; // Verde para inactivas
              if (estado === "activa") backgroundColor = "#FF9500"; // Naranja para activas
              if (estado === "completada") backgroundColor = "#00C851"; // Verde para completadas
              
              return (
                <TouchableOpacity
                  key={mesa._id}
                  style={[styles.mesaCard, { backgroundColor }]}
                >
                  <Text style={styles.mesaCardNumber}>{mesa.nummesa}</Text>
                  <MaterialCommunityIcons name="table-picnic" size={30} color="#FFFFFF" />
                  {count > 0 && (
                    <Text style={styles.mesaCardCount}>{count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: "#C41E3A",
    padding: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  mesaItem: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
  },
  mesaText: {
    fontSize: 16,
    color: "#333",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    padding: 10,
  },
  inactivasContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 8,
  },
  inactivaText: {
    fontSize: 16,
    color: "#666",
    marginRight: 5,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  mesaCard: {
    width: "18%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  mesaCardNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  mesaCardCount: {
    fontSize: 12,
    color: "#FFFFFF",
    marginTop: 5,
    fontWeight: "bold",
  },
});

export default CuarterScreen;
