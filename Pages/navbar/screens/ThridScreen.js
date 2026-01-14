import React, { useState, useEffect } from "react";
import {
  View,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMANDASEARCH_API_GET, COMANDA_API_SEARCH_BY_DATE } from "../../../apiConfig";
import moment from "moment-timezone";

const ThirdScreen = () => {
  const [comandas, setComandas] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [fecha, setFecha] = useState(moment().tz("America/Lima").format("YYYY-MM-DD"));

  useEffect(() => {
    loadUserData();
    fetchComandas();
    const interval = setInterval(fetchComandas, 3000);
    return () => clearInterval(interval);
  }, [fecha]);

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        setUserInfo(parsed);
        console.log("👤 Usuario cargado:", parsed);
      }
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  const fetchComandas = async () => {
    try {
      console.log("📋 Buscando comandas para fecha:", fecha);
      const response = await axios.get(
        `${COMANDA_API_SEARCH_BY_DATE}/${fecha}`,
        { timeout: 5000 }
      );
      
      // Filtrar solo las comandas del usuario logueado
      let filtered = response.data;
      if (userInfo && userInfo._id) {
        filtered = response.data.filter(
          comanda => comanda.mozos?._id === userInfo._id || comanda.mozos?._id === userInfo.id
        );
      }
      
      setComandas(filtered);
      console.log(`✅ ${filtered.length} comandas encontradas`);
    } catch (error) {
      console.error("❌ Error obteniendo comandas:", error);
      Alert.alert("Error", "No se pudieron cargar las comandas");
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "entregado":
      case "completado":
        return "✅";
      case "preparando":
      case "prep":
        return "🔄";
      case "listo":
      case "recoger":
        return "🟡";
      default:
        return "⏳";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "entregado":
      case "completado":
        return "#00C851";
      case "preparando":
      case "prep":
        return "#FF9500";
      case "listo":
      case "recoger":
        return "#FFD500";
      default:
        return "#00D4FF";
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "N/A";
    return moment(dateString).tz("America/Lima").format("HH:mm");
  };

  const renderComanda = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    
    return (
      <TouchableOpacity
        style={styles.comandaCard}
        onPress={() => {
          Alert.alert(
            `Comanda #${item.comandaNumber || item._id.slice(-4)}`,
            `Mesa: ${item.mesas?.nummesa || "N/A"}\nHora: ${formatTime(item.createdAt || item.fecha)}\nEstado: ${item.status || "N/A"}`,
            [{ text: "OK" }]
          );
        }}
      >
        <View style={styles.comandaHeader}>
          <Text style={styles.comandaNumber}>
            #{item.comandaNumber || item._id.slice(-4)}
          </Text>
          <Text style={styles.comandaMesa}>
            Mesa {item.mesas?.nummesa || "N/A"}
          </Text>
          <Text style={styles.comandaTime}>
            {formatTime(item.createdAt || item.fecha)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>
            {statusIcon} {item.status || "Pendiente"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 MIS COMANDAS</Text>
        <Text style={styles.headerSubtitle}>Hoy ▼</Text>
      </View>
      
      {comandas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay comandas para hoy</Text>
        </View>
      ) : (
        <FlatList
          data={comandas}
          renderItem={renderComanda}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
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
  headerSubtitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 5,
  },
  listContainer: {
    padding: 15,
  },
  comandaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comandaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  comandaNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#C41E3A",
  },
  comandaMesa: {
    fontSize: 16,
    color: "#333",
  },
  comandaTime: {
    fontSize: 16,
    color: "#666",
  },
  statusBadge: {
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    fontStyle: "italic",
  },
});

export default ThirdScreen;
