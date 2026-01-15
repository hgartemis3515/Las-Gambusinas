import React, { useState, useEffect } from "react";
import {
  Text,
  SafeAreaView,
  View,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COMANDA_API, SELECTABLE_API_GET, DISHES_API, MESAS_API_UPDATE, AREAS_API } from "../../../apiConfig";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";

const OrdenesScreen = () => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = OrdenesScreenStyles(theme);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [modalMesasVisible, setModalMesasVisible] = useState(false);
  const [modalPlatosVisible, setModalPlatosVisible] = useState(false);
  const [platos, setPlatos] = useState([]);
  const [selectedPlatos, setSelectedPlatos] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [isSendingComanda, setIsSendingComanda] = useState(false);
  const [areas, setAreas] = useState([]);
  const [filtroAreaMesa, setFiltroAreaMesa] = useState("All"); // Filtro para el modal de mesas

  useEffect(() => {
    loadUserData();
    loadMesaData();
    loadPlatosData();
    loadSelectedPlatos();
    obtenerAreas();
  }, []);

  const obtenerAreas = async () => {
    try {
      const response = await axios.get(AREAS_API, { timeout: 5000 });
      setAreas(response.data.filter(area => area.isActive !== false));
    } catch (error) {
      console.error("Error al obtener las áreas:", error.message);
    }
  };

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        setUserInfo(parsed);
      }
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  const loadMesaData = async () => {
    try {
      const mesaData = await AsyncStorage.getItem("mesaSeleccionada");
      if (mesaData) {
        const parsed = JSON.parse(mesaData);
        setSelectedMesa(parsed);
      }
    } catch (error) {
      console.error("Error cargando mesa:", error);
    }
  };

  const loadPlatosData = async () => {
    try {
      const response = await axios.get(DISHES_API, { timeout: 5000 });
      setPlatos(response.data);
    } catch (error) {
      console.error("Error cargando platos:", error);
      Alert.alert("Error", "No se pudieron cargar los platos");
    }
  };

  const loadSelectedPlatos = async () => {
    try {
      const stored = await AsyncStorage.getItem("selectedPlates");
      const storedCantidades = await AsyncStorage.getItem("cantidadesComanda");
      const storedObs = await AsyncStorage.getItem("additionalDetails");
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setSelectedPlatos(parsed);
      }
      
      if (storedCantidades) {
        const parsed = JSON.parse(storedCantidades);
        const cantidadesObj = {};
        parsed.forEach((cant, index) => {
          if (stored) {
            const platos = JSON.parse(stored);
            if (platos[index]) {
              cantidadesObj[platos[index]._id] = cant;
            }
          }
        });
        setCantidades(cantidadesObj);
      }
      
      if (storedObs) {
        setObservaciones(storedObs);
      }
    } catch (error) {
      console.error("Error cargando platos seleccionados:", error);
    }
  };

  const fetchMesas = async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET, { timeout: 5000 });
      setMesas(response.data);
    } catch (error) {
      console.error("Error obteniendo mesas:", error);
      Alert.alert("Error", "No se pudieron cargar las mesas");
    }
  };

  const handleSelectMesa = async (mesa) => {
    try {
      const mesaData = {
        _id: mesa._id,
        nummesa: mesa.nummesa
      };
      await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaData));
      setSelectedMesa(mesaData);
      setModalMesasVisible(false);
      Alert.alert("✅", `Mesa ${mesa.nummesa} seleccionada`);
    } catch (error) {
      console.error("Error seleccionando mesa:", error);
    }
  };

  const handleAddPlato = (plato) => {
    const exists = selectedPlatos.find(p => p._id === plato._id);
    if (exists) {
      const newCant = (cantidades[plato._id] || 1) + 1;
      setCantidades({ ...cantidades, [plato._id]: newCant });
    } else {
      setSelectedPlatos([...selectedPlatos, plato]);
      setCantidades({ ...cantidades, [plato._id]: 1 });
    }
  };

  const handleRemovePlato = (platoId) => {
    const newPlatos = selectedPlatos.filter(p => p._id !== platoId);
    setSelectedPlatos(newPlatos);
    const newCantidades = { ...cantidades };
    delete newCantidades[platoId];
    setCantidades(newCantidades);
  };

  const handleUpdateCantidad = (platoId, delta) => {
    const current = cantidades[platoId] || 1;
    const newCant = Math.max(1, current + delta);
    setCantidades({ ...cantidades, [platoId]: newCant });
  };

  const calcularSubtotal = () => {
    let total = 0;
    selectedPlatos.forEach(plato => {
      const cantidad = cantidades[plato._id] || 1;
      total += plato.precio * cantidad;
    });
    return total.toFixed(2);
  };

  const handleEnviarComanda = async () => {
    try {
      setIsSendingComanda(true);

      if (!userInfo || !userInfo._id) {
        Alert.alert("Error", "No hay usuario logueado");
        setIsSendingComanda(false);
        return;
      }

      if (!selectedMesa || !selectedMesa._id) {
        Alert.alert("Error", "Por favor selecciona una mesa");
        setIsSendingComanda(false);
        return;
      }

      if (selectedPlatos.length === 0) {
        Alert.alert("Error", "Agrega al menos un plato");
        setIsSendingComanda(false);
        return;
      }

      // Validar estado de la mesa antes de crear la comanda
      const estadoMesa = (selectedMesa.estado || 'libre').toLowerCase();
      if (estadoMesa !== 'libre') {
        if (estadoMesa === 'reservado') {
          Alert.alert(
            "Mesa Reservada",
            "Esta mesa está reservada. Solo un administrador puede liberarla.",
            [{ text: "OK" }]
          );
        } else if (['esperando', 'pedido', 'preparado', 'pagado'].includes(estadoMesa)) {
          Alert.alert(
            "Mesa Ocupada",
            "Esta mesa ya tiene una comanda activa. No se puede crear una nueva comanda.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Mesa No Disponible",
            `La mesa está en estado "${estadoMesa}". Solo se pueden crear comandas en mesas libres.`,
            [{ text: "OK" }]
          );
        }
        setIsSendingComanda(false);
        return;
      }

      const platosData = selectedPlatos.map(plato => ({
        plato: plato._id,
        platoId: plato.id || null,
        estado: "en_espera"
      }));

      const cantidadesArray = selectedPlatos.map(plato => cantidades[plato._id] || 1);

      const comandaData = {
        mozos: userInfo._id,
        mesas: selectedMesa._id,
        platos: platosData,
        cantidades: cantidadesArray,
        observaciones: observaciones || "",
        status: "en_espera",
        IsActive: true
      };

      const response = await axios.post(COMANDA_API, comandaData, { timeout: 5000 });
      
      const comandaNumber = response.data.comanda?.comandaNumber || response.data.comandaNumber || "N/A";
      
      // El backend actualiza automáticamente la mesa a "esperando" al crear la comanda
      // El mozo puede actualizar a "pedido" solo si la mesa está en "esperando"
      // Esto se hace en una acción separada, no automáticamente
      
      Alert.alert("✅ Éxito", `Comanda #${comandaNumber} creada. La mesa ahora está en estado "esperando".`);

      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("selectedPlatesIds");
      await AsyncStorage.removeItem("cantidadesComanda");
      await AsyncStorage.removeItem("additionalDetails");
      
      setSelectedMesa(null);
      setSelectedPlatos([]);
      setCantidades({});
      setObservaciones("");
    } catch (error) {
      console.error("❌ Error enviando comanda:", error);
      
      // Manejar errores HTTP 409 (Conflict) - Mesa ocupada
      if (error.response?.status === 409) {
        Alert.alert(
          "Mesa Ocupada",
          error.response?.data?.message || "La mesa está ocupada con una comanda existente.",
          [{ text: "OK" }]
        );
      } else if (error.response?.status === 400) {
        Alert.alert(
          "Error de Validación",
          error.response?.data?.message || "Los datos proporcionados no son válidos.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Error",
          error.response?.data?.message || "No se pudo crear la comanda. Por favor, intenta nuevamente.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsSendingComanda(false);
    }
  };

  const saveToAsyncStorage = async () => {
    try {
      await AsyncStorage.setItem("selectedPlates", JSON.stringify(selectedPlatos));
      const selectedPlatesIds = selectedPlatos.map(p => p._id);
      await AsyncStorage.setItem("selectedPlatesIds", JSON.stringify(selectedPlatesIds));
      await AsyncStorage.setItem("cantidadesComanda", JSON.stringify(
        selectedPlatos.map(p => cantidades[p._id] || 1)
      ));
      await AsyncStorage.setItem("additionalDetails", observaciones);
    } catch (error) {
      console.error("Error guardando en AsyncStorage:", error);
    }
  };

  useEffect(() => {
    saveToAsyncStorage();
  }, [selectedPlatos, cantidades, observaciones]);

  useEffect(() => {
    if (modalMesasVisible) {
      fetchMesas();
    }
  }, [modalMesasVisible]);

  const categorias = tipoPlatoFiltro
    ? [...new Set(platos.filter(p => p.tipo === tipoPlatoFiltro).map(p => p.categoria))].filter(Boolean)
    : [];
  
  const platosFiltrados = platos.filter(p => {
    const matchTipo = !tipoPlatoFiltro || p.tipo === tipoPlatoFiltro;
    const matchSearch = !searchPlato || p.nombre.toLowerCase().includes(searchPlato.toLowerCase());
    const matchCategoria = !categoriaFiltro || p.categoria === categoriaFiltro;
    return matchTipo && matchSearch && matchCategoria;
  });

  const getCategoriaIcon = (categoria) => {
    if (categoria?.includes("Carnes") || categoria?.includes("CARNE")) return "🥩";
    if (categoria?.includes("Pescado") || categoria?.includes("PESCADO")) return "🐟";
    if (categoria?.includes("Entrada") || categoria?.includes("ENTRADA")) return "🥗";
    if (categoria?.includes("Bebida") || categoria?.includes("JUGOS") || categoria?.includes("Gaseosa")) return "🥤";
    return "🍽️";
  };

  // Función para obtener el color según el estado de la mesa
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

  // Obtener el estado de la mesa (si no tiene estado, asumir "Libre")
  const getMesaEstado = (mesa) => {
    return mesa.estado || "Libre";
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="notebook-edit" size={32} color={theme.colors.text.white} />
          <Text style={styles.headerTitle}>NUEVA ORDEN</Text>
        </View>

        {/* Selección de Mesa */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Mesa</Text>
          <TouchableOpacity
            style={styles.mesaCard}
            onPress={() => {
              fetchMesas();
              setModalMesasVisible(true);
            }}
          >
            <View style={styles.mesaCardContent}>
              <MaterialCommunityIcons 
                name={selectedMesa ? "table-check" : "table-plus"} 
                size={24} 
                color={selectedMesa ? theme.colors.secondary : theme.colors.text.secondary} 
              />
              <Text style={[styles.mesaCardText, selectedMesa && styles.mesaCardTextSelected]}>
                {selectedMesa ? `Mesa ${selectedMesa.nummesa}` : "Seleccionar Mesa"}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Platos Seleccionados */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Platos Seleccionados
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedPlatos.length}</Text>
            </View>
          </View>
          {selectedPlatos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.colors.text.light} />
              <Text style={styles.emptyText}>No hay platos seleccionados</Text>
            </View>
          ) : (
            selectedPlatos.map((plato) => {
              const cantidad = cantidades[plato._id] || 1;
              const subtotal = plato.precio * cantidad;
              return (
                <View key={plato._id} style={styles.platoItem}>
                  <View style={styles.platoInfo}>
                    <Text style={styles.platoNombre}>{plato.nombre}</Text>
                    <View style={styles.platoDetails}>
                      <Text style={styles.platoCantidad}>x{cantidad}</Text>
                      <Text style={styles.platoPrecio}>S/. {subtotal.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.platoActions}>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, -1)}
                    >
                      <MaterialCommunityIcons name="minus" size={16} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    <Text style={styles.cantidadText}>{cantidad}</Text>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, 1)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={theme.colors.text.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlato(plato._id)}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Observaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Observaciones</Text>
          <TextInput
            style={styles.observacionesInput}
            placeholder="Ej: Sin ají, sin cebolla..."
            placeholderTextColor={theme.colors.text.light}
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalText}>S/. {calcularSubtotal()}</Text>
        </View>

        {/* Botones */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              loadPlatosData();
              setTipoPlatoFiltro(null);
              setCategoriaFiltro(null);
              setSearchPlato("");
              setModalPlatosVisible(true);
            }}
          >
            <MaterialCommunityIcons name="plus-circle" size={24} color={theme.colors.text.white} />
            <Text style={styles.addButtonText}>Agregar Plato</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, isSendingComanda && styles.sendButtonDisabled]}
            onPress={handleEnviarComanda}
            disabled={isSendingComanda}
          >
            <MaterialCommunityIcons name="send" size={24} color={theme.colors.text.white} />
            <Text style={styles.sendButtonText}>
              {isSendingComanda ? "Enviando..." : "Enviar Orden"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Mesas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalMesasVisible}
        onRequestClose={() => setModalMesasVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Mesa</Text>
              <TouchableOpacity onPress={() => setModalMesasVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Filtro por Área en Modal */}
            <View style={styles.modalAreaFilterContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.modalAreaFilterScroll}
                contentContainerStyle={styles.modalAreaFilterContent}
              >
                <TouchableOpacity
                  style={[styles.modalAreaFilterButton, filtroAreaMesa === "All" && styles.modalAreaFilterButtonActive]}
                  onPress={() => setFiltroAreaMesa("All")}
                >
                  <Text style={[styles.modalAreaFilterButtonText, filtroAreaMesa === "All" && styles.modalAreaFilterButtonTextActive]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {areas.map((area) => (
                  <TouchableOpacity
                    key={area._id}
                    style={[styles.modalAreaFilterButton, filtroAreaMesa === area._id && styles.modalAreaFilterButtonActive]}
                    onPress={() => setFiltroAreaMesa(area._id)}
                  >
                    <Text style={[styles.modalAreaFilterButtonText, filtroAreaMesa === area._id && styles.modalAreaFilterButtonTextActive]}>
                      {area.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.mesasGrid}>
                {mesas
                  .filter(mesa => {
                    if (filtroAreaMesa === "All") return true;
                    const mesaAreaId = mesa.area?._id || mesa.area;
                    return mesaAreaId === filtroAreaMesa;
                  })
                  .map((mesa) => {
                    const estado = getMesaEstado(mesa);
                    const estadoColor = getEstadoColor(estado);
                    const isSelected = selectedMesa?._id === mesa._id;
                    const mesaArea = typeof mesa.area === 'object' 
                      ? mesa.area.nombre 
                      : areas.find(a => a._id === mesa.area)?.nombre || 'Sin área';
                    
                    return (
                      <TouchableOpacity
                        key={mesa._id}
                        style={[
                          styles.mesaCardModal,
                          { backgroundColor: estadoColor },
                          isSelected && styles.mesaCardSelected
                        ]}
                        onPress={() => handleSelectMesa(mesa)}
                      >
                        <MaterialCommunityIcons 
                          name="table-picnic" 
                          size={32} 
                          color={theme.colors.text.white} 
                        />
                        <Text style={styles.mesaCardTextModal}>
                          {mesa.nummesa}
                        </Text>
                        <Text style={styles.mesaCardAreaModal}>{mesaArea}</Text>
                        <Text style={styles.mesaCardEstadoModal}>{estado}</Text>
                        {isSelected && (
                          <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.text.white} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Platos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalPlatosVisible}
        onRequestClose={() => {
          setModalPlatosVisible(false);
          setTipoPlatoFiltro(null);
          setCategoriaFiltro(null);
          setSearchPlato("");
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Menú</Text>
              <TouchableOpacity onPress={() => {
                setModalPlatosVisible(false);
                setTipoPlatoFiltro(null);
                setCategoriaFiltro(null);
                setSearchPlato("");
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {!tipoPlatoFiltro ? (
              <View style={styles.tipoSelectorContainer}>
                <Text style={styles.tipoSelectorTitle}>Selecciona el tipo de menú</Text>
                <View style={styles.tipoButtonsContainer}>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => setTipoPlatoFiltro("platos-desayuno")}
                  >
                    <MaterialCommunityIcons name="coffee" size={48} color={theme.colors.text.white} />
                    <Text style={styles.tipoButtonText}>DESAYUNO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => setTipoPlatoFiltro("carta-normal")}
                  >
                    <MaterialCommunityIcons name="silverware-fork-knife" size={48} color={theme.colors.text.white} />
                    <Text style={styles.tipoButtonText}>CARTA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.changeTipoButton}
                  onPress={() => {
                    setTipoPlatoFiltro(null);
                    setCategoriaFiltro(null);
                    setSearchPlato("");
                  }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text.white} />
                  <Text style={styles.changeTipoButtonText}>
                    {tipoPlatoFiltro === "platos-desayuno" ? "Desayuno" : "Carta Normal"}
                  </Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar plato..."
                  placeholderTextColor={theme.colors.text.light}
                  value={searchPlato}
                  onChangeText={setSearchPlato}
                />
                
                <ScrollView horizontal style={styles.categoriasContainer} showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.categoriaChip, !categoriaFiltro && styles.categoriaChipActive]}
                    onPress={() => setCategoriaFiltro(null)}
                  >
                    <Text style={[styles.categoriaChipText, !categoriaFiltro && styles.categoriaChipTextActive]}>Todos</Text>
                  </TouchableOpacity>
                  {categorias.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoriaChip, categoriaFiltro === cat && styles.categoriaChipActive]}
                      onPress={() => setCategoriaFiltro(cat)}
                    >
                      <Text style={[styles.categoriaChipText, categoriaFiltro === cat && styles.categoriaChipTextActive]}>
                        {getCategoriaIcon(cat)} {cat.split("(")[0].trim()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <ScrollView style={styles.modalScrollView}>
                  {platosFiltrados.length === 0 ? (
                    <View style={styles.emptyPlatosContainer}>
                      <Text style={styles.emptyPlatosText}>
                        No hay platos disponibles
                      </Text>
                    </View>
                  ) : (
                    platosFiltrados.map((plato) => {
                      const cantidad = cantidades[plato._id] || 0;
                      return (
                        <View key={plato._id} style={styles.platoModalItem}>
                          <View style={styles.platoModalInfo}>
                            <Text style={styles.platoModalNombre}>{plato.nombre}</Text>
                            <Text style={styles.platoModalPrecio}>S/. {plato.precio.toFixed(2)}</Text>
                          </View>
                          <View style={styles.platoModalActions}>
                            <TouchableOpacity
                              style={styles.cantidadButtonSmall}
                              onPress={() => {
                                if (cantidad > 0) {
                                  handleUpdateCantidad(plato._id, -1);
                                }
                              }}
                            >
                              <MaterialCommunityIcons name="minus" size={14} color={theme.colors.text.white} />
                            </TouchableOpacity>
                            <Text style={styles.cantidadTextSmall}>{cantidad || 0}</Text>
                            <TouchableOpacity
                              style={styles.cantidadButtonSmall}
                              onPress={() => handleUpdateCantidad(plato._id, 1)}
                            >
                              <MaterialCommunityIcons name="plus" size={14} color={theme.colors.text.white} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.addPlatoButton}
                              onPress={() => {
                                handleAddPlato(plato);
                                Alert.alert("✅", `${plato.nombre} agregado`);
                              }}
                            >
                              <Text style={styles.addPlatoButtonText}>Agregar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const OrdenesScreenStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    ...theme.shadows.medium,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.white,
    letterSpacing: 0.5,
  },
  section: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: "700",
  },
  mesaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  mesaCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  mesaCardText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontWeight: "500",
  },
  mesaCardTextSelected: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    textAlign: "center",
    color: theme.colors.text.light,
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
    fontSize: 14,
  },
  platoItem: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  platoInfo: {
    marginBottom: theme.spacing.sm,
  },
  platoNombre: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  platoDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  platoCantidad: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  platoPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoActions: {
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
  cantidadButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  cantidadTextSmall: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
    color: theme.colors.text.primary,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  observacionesInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalSection: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  totalText: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  buttonsContainer: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  addButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
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
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  mesaCardModal: {
    width: "30%",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.colors.surface,
    minHeight: 100,
    ...theme.shadows.medium,
  },
  mesaCardSelected: {
    borderColor: theme.colors.text.white,
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  mesaCardTextModal: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginTop: theme.spacing.xs,
  },
  mesaCardEstadoModal: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.text.white,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },
  mesaCardAreaModal: {
    fontSize: 9,
    fontWeight: "500",
    color: theme.colors.text.white,
    marginTop: 2,
    opacity: 0.8,
  },
  modalAreaFilterContainer: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalAreaFilterScroll: {
    maxHeight: 50,
  },
  modalAreaFilterContent: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  modalAreaFilterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 70,
  },
  modalAreaFilterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalAreaFilterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
  modalAreaFilterButtonTextActive: {
    color: theme.colors.text.white,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  categoriasContainer: {
    marginBottom: theme.spacing.md,
  },
  categoriaChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  categoriaChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  categoriaChipTextActive: {
    color: theme.colors.text.white,
  },
  platoModalItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  platoModalInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  platoModalNombre: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoModalPrecio: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  platoModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  addPlatoButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addPlatoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 12,
  },
  tipoSelectorContainer: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  tipoSelectorTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: theme.spacing.xl,
    color: theme.colors.text.primary,
    textAlign: "center",
  },
  tipoButtonsContainer: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    width: "100%",
  },
  tipoButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    ...theme.shadows.medium,
  },
  tipoButtonText: {
    color: theme.colors.text.white,
    fontSize: 16,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  changeTipoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.warning,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  changeTipoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
  },
  emptyPlatosContainer: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  emptyPlatosText: {
    fontSize: 16,
    color: theme.colors.text.light,
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default OrdenesScreen;

