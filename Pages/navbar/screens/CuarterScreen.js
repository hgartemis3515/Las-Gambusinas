import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET, COMANDA_API, DISHES_API } from "../../../apiConfig";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";

const CuarterScreen = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = CuarterScreenStyles(theme);
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [comandaEditando, setComandaEditando] = useState(null);
  const [platos, setPlatos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("All"); // "All" o "Booked" (Reservado)

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
    } catch (error) {
      console.error("Error al obtener las comandas de hoy:", error.message);
    }
  }, []);

  const obtenerPlatos = async () => {
    try {
      const response = await axios.get(DISHES_API, { timeout: 5000 });
      setPlatos(response.data);
    } catch (error) {
      console.error("Error cargando platos:", error);
    }
  };

  const getComandasPorMesa = (mesaNum) => {
    return comandas.filter(
      (comanda) => comanda.mesas?.nummesa === mesaNum && comanda.IsActive !== false
    );
  };

  // Obtener el estado de la mesa
  const getEstadoMesa = (mesa) => {
    if (mesa.estado) {
      return mesa.estado;
    }
    const comandasMesa = getComandasPorMesa(mesa.nummesa);
    if (comandasMesa.length === 0) return "Libre";
    
    const todasCompletadas = comandasMesa.every(
      (c) => c.status?.toLowerCase() === "entregado" || c.status?.toLowerCase() === "completado"
    );
    
    if (todasCompletadas && comandasMesa.length > 0) return "Pagando";
    return "Pedido";
  };

  // Obtener el mozo de la mesa (del último comanda activa)
  const getMozoMesa = (mesa) => {
    const comandasMesa = getComandasPorMesa(mesa.nummesa);
    if (comandasMesa.length > 0) {
      const ultimaComanda = comandasMesa[comandasMesa.length - 1];
      return ultimaComanda.mozos?.name || "N/A";
    }
    return "N/A";
  };

  // Función para obtener el color según el estado
  const getEstadoColor = (estado) => {
    const estadoLower = estado?.toLowerCase() || "libre";
    switch (estadoLower) {
      case "libre":
        return theme.colors.mesaEstado.libre;
      case "esperando":
        return theme.colors.mesaEstado.esperando;
      case "pedido":
        return theme.colors.mesaEstado.pedido;
      case "preparado":
        return theme.colors.mesaEstado.preparado;
      case "pagando":
        return theme.colors.mesaEstado.pagando;
      case "reservado":
        return theme.colors.mesaEstado.reservado;
      default:
        return theme.colors.mesaEstado.libre;
    }
  };

  // Obtener el texto del badge según el estado
  const getEstadoBadgeText = (estado) => {
    const estadoLower = estado?.toLowerCase() || "libre";
    switch (estadoLower) {
      case "libre":
        return "Available";
      case "esperando":
        return "Waiting";
      case "pedido":
        return "Ordered";
      case "preparado":
        return "Ready";
      case "pagando":
        return "Paying";
      case "reservado":
        return "Booked";
      default:
        return "Available";
    }
  };

  // Filtrar mesas según el filtro
  const mesasFiltradas = filtroEstado === "All" 
    ? mesas 
    : mesas.filter(mesa => getEstadoMesa(mesa) === "Reservado");

  // Manejar selección de mesa
  const handleSelectMesa = async (mesa) => {
    const estado = getEstadoMesa(mesa);
    
    if (estado === "Pedido") {
      // Obtener la comanda activa de esta mesa
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      const comandaActiva = comandasMesa.find(c => 
        c.status?.toLowerCase() !== "entregado" && 
        c.status?.toLowerCase() !== "completado"
      ) || comandasMesa[0];

      if (comandaActiva) {
        await obtenerPlatos();
        await handleEditarComanda(comandaActiva);
      } else {
        Alert.alert("Info", "No hay comanda activa para editar en esta mesa");
      }
    } else {
      Alert.alert(
        `Mesa ${mesa.nummesa}`,
        `Estado: ${estado}\nMozo: ${getMozoMesa(mesa)}`,
        [{ text: "OK" }]
      );
    }
  };

  const handleEditarComanda = async (comanda) => {
    await obtenerPlatos();
    
    const platosEditados = comanda.platos.map((p, index) => {
      let platoData = null;
      const platoId = p.plato?._id || p.plato;
      
      if (p.plato && typeof p.plato === 'object' && p.plato.nombre) {
        platoData = p.plato;
      } else if (platoId) {
        platoData = platos.find(pl => pl._id === platoId || pl._id === platoId.toString());
      }
      
      return {
        plato: platoId,
        platoId: platoData?.id || p.platoId || null,
        estado: p.estado || "pendiente",
        cantidad: comanda.cantidades?.[index] || 1,
        nombre: platoData?.nombre || "Plato desconocido",
        precio: platoData?.precio || 0,
      };
    });

    setComandaEditando({
      ...comanda,
      platosEditados,
      mesaSeleccionada: comanda.mesas,
      observacionesEditadas: comanda.observaciones || "",
    });
    setModalEditVisible(true);
  };

  const handleGuardarEdicion = async () => {
    if (!comandaEditando) return;

    try {
      if (!comandaEditando.platosEditados || comandaEditando.platosEditados.length === 0) {
        Alert.alert("Error", "Debe haber al menos un plato en la comanda");
        return;
      }

      const platosData = comandaEditando.platosEditados.map(p => {
        const platoCompleto = platos.find(pl => pl._id === p.plato || pl._id === p.plato?.toString());
        return {
          plato: p.plato,
          platoId: platoCompleto?.id || p.platoId || null,
          estado: p.estado || "pendiente"
        };
      });

      const cantidades = comandaEditando.platosEditados.map(p => p.cantidad || 1);

      const updateData = {
        mesas: comandaEditando.mesaSeleccionada._id,
        platos: platosData,
        cantidades: cantidades,
        observaciones: comandaEditando.observacionesEditadas || "",
      };

      await axios.put(`${COMANDA_API}/${comandaEditando._id}`, updateData, { timeout: 5000 });
      
      Alert.alert("✅", "Comanda actualizada exitosamente");
      setModalEditVisible(false);
      setComandaEditando(null);
      obtenerComandasHoy();
    } catch (error) {
      console.error("Error actualizando comanda:", error);
      Alert.alert("Error", error.response?.data?.message || "No se pudo actualizar la comanda");
    }
  };

  const handleRemoverPlato = (index) => {
    if (!comandaEditando) return;
    const nuevosPlatos = [...comandaEditando.platosEditados];
    nuevosPlatos.splice(index, 1);
    setComandaEditando({
      ...comandaEditando,
      platosEditados: nuevosPlatos,
    });
  };

  const handleCambiarCantidad = (index, delta) => {
    if (!comandaEditando) return;
    const nuevosPlatos = [...comandaEditando.platosEditados];
    const nuevaCantidad = Math.max(1, (nuevosPlatos[index].cantidad || 1) + delta);
    nuevosPlatos[index].cantidad = nuevaCantidad;
    setComandaEditando({
      ...comandaEditando,
      platosEditados: nuevosPlatos,
    });
  };

  const calcularTotal = () => {
    if (!comandaEditando) return 0;
    return comandaEditando.platosEditados.reduce((total, p) => {
      return total + (p.precio || 0) * (p.cantidad || 1);
    }, 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesas</Text>
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filtroEstado === "All" && styles.filterButtonActive]}
            onPress={() => setFiltroEstado("All")}
          >
            <Text style={[styles.filterButtonText, filtroEstado === "All" && styles.filterButtonTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filtroEstado === "Booked" && styles.filterButtonActive]}
            onPress={() => setFiltroEstado("Booked")}
          >
            <Text style={[styles.filterButtonText, filtroEstado === "Booked" && styles.filterButtonTextActive]}>
              Reservadas
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mesasGrid}>
          {mesasFiltradas.map((mesa) => {
            const estado = getEstadoMesa(mesa);
            const estadoColor = getEstadoColor(estado);
            const mozo = getMozoMesa(mesa);
            const comandasMesa = getComandasPorMesa(mesa.nummesa);
            const tieneComanda = comandasMesa.length > 0;

            return (
              <TouchableOpacity
                key={mesa._id}
                style={styles.mesaCard}
                onPress={() => handleSelectMesa(mesa)}
                activeOpacity={0.8}
              >
                <View style={styles.mesaCardHeader}>
                  <Text style={styles.mesaCardTitle}>Mesa → {mesa.nummesa}</Text>
                </View>
                
                <View style={[styles.estadoBadge, { backgroundColor: estadoColor }]}>
                  <Text style={styles.estadoBadgeText}>{getEstadoBadgeText(estado)}</Text>
                </View>

                <View style={styles.mesaCardContent}>
                  <View style={[styles.ocupacionCircle, tieneComanda && styles.ocupacionCircleOcupada]}>
                    {tieneComanda ? (
                      <Text style={styles.ocupacionText}>
                        {mozo.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    ) : (
                      <Text style={styles.ocupacionText}>N/A</Text>
                    )}
                  </View>
                  
                  <View style={styles.mesaCardInfo}>
                    <Text style={styles.mesaCardLabel}>Mozo:</Text>
                    <Text style={styles.mesaCardValue}>{mozo}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de Edición de Comanda */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEditVisible}
        onRequestClose={() => {
          setModalEditVisible(false);
          setComandaEditando(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Editar Comanda #{comandaEditando?.comandaNumber || comandaEditando?._id.slice(-4)}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalEditVisible(false);
                setComandaEditando(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Mesa: {comandaEditando?.mesaSeleccionada?.nummesa || "N/A"}</Text>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Platos:</Text>
                {comandaEditando?.platosEditados?.map((plato, index) => (
                  <View key={index} style={styles.platoEditItem}>
                    <View style={styles.platoEditInfo}>
                      <Text style={styles.platoEditNombre}>{plato.nombre}</Text>
                      <Text style={styles.platoEditPrecio}>
                        S/. {((plato.precio || 0) * (plato.cantidad || 1)).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.platoEditActions}>
                      <TouchableOpacity
                        style={styles.cantidadButton}
                        onPress={() => handleCambiarCantidad(index, -1)}
                      >
                        <Text style={styles.cantidadButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.cantidadText}>{plato.cantidad || 1}</Text>
                      <TouchableOpacity
                        style={styles.cantidadButton}
                        onPress={() => handleCambiarCantidad(index, 1)}
                      >
                        <Text style={styles.cantidadButtonText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoverPlato(index)}
                      >
                        <MaterialCommunityIcons name="delete" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Observaciones:</Text>
                <Text style={styles.observacionesText}>
                  {comandaEditando?.observacionesEditadas || "Sin observaciones"}
                </Text>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.totalText}>TOTAL: S/. {calcularTotal().toFixed(2)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleGuardarEdicion}
              >
                <Text style={styles.saveButtonText}>💾 Guardar Cambios</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalEditVisible(false);
                  setComandaEditando(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const CuarterScreenStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginBottom: theme.spacing.md,
  },
  filtersContainer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.secondary,
  },
  filterButtonTextActive: {
    color: theme.colors.text.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  mesaCard: {
    width: "47%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  mesaCardHeader: {
    marginBottom: theme.spacing.sm,
  },
  mesaCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  estadoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
  },
  estadoBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  mesaCardContent: {
    alignItems: "center",
  },
  ocupacionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  ocupacionCircleOcupada: {
    backgroundColor: theme.colors.primary,
  },
  ocupacionText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  mesaCardInfo: {
    alignItems: "center",
  },
  mesaCardLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  mesaCardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: "90%",
    maxHeight: "90%",
    padding: theme.spacing.lg,
    ...theme.shadows.large,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
    flex: 1,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  editSection: {
    marginBottom: theme.spacing.md,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  platoEditItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  platoEditInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  platoEditNombre: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoEditPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoEditActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  cantidadButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cantidadButtonText: {
    color: theme.colors.text.white,
    fontSize: 18,
    fontWeight: "700",
  },
  cantidadText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "center",
    color: theme.colors.text.primary,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  observacionesText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontStyle: "italic",
  },
  totalText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.primary,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  saveButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
});

export default CuarterScreen;
