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
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COMANDA_API, SELECTABLE_API_GET, DISHES_API, MESAS_API_UPDATE, AREAS_API } from "../../../apiConfig";

const SecondScreen = () => {
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
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null); // "platos-desayuno" o "carta-normal"
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
        console.log("👤 Usuario cargado:", parsed);
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
        console.log("🪑 Mesa cargada:", parsed);
      }
    } catch (error) {
      console.error("Error cargando mesa:", error);
    }
  };

  const loadPlatosData = async () => {
    try {
      const response = await axios.get(DISHES_API, { timeout: 5000 });
      setPlatos(response.data);
      console.log("🍽️ Platos cargados:", response.data.length);
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
        console.log("📋 Platos seleccionados cargados:", parsed.length);
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
      console.log("🪑 Mesas obtenidas:", response.data.length);
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
      console.log("✅ Mesa seleccionada:", mesaData);
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
    console.log("➕ Plato agregado:", plato.nombre);
  };

  const handleRemovePlato = (platoId) => {
    const newPlatos = selectedPlatos.filter(p => p._id !== platoId);
    setSelectedPlatos(newPlatos);
    const newCantidades = { ...cantidades };
    delete newCantidades[platoId];
    setCantidades(newCantidades);
    console.log("➖ Plato removido");
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
      console.log("🚀 Iniciando envío de comanda...");

      // Validaciones
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

      // Preparar datos - incluir tanto _id como id numérico
      const platosData = selectedPlatos.map(plato => ({
        plato: plato._id,
        platoId: plato.id || null, // ID numérico del plato
        estado: "en_espera" // Estado estandarizado: en_espera, recoger, pagado
      }));
      
      console.log("🍽️ Platos preparados:", platosData.map(p => ({
        _id: p.plato,
        id: p.platoId,
        estado: p.estado
      })));

      const cantidadesArray = selectedPlatos.map(plato => cantidades[plato._id] || 1);

      const comandaData = {
        mozos: userInfo._id,
        mesas: selectedMesa._id,
        platos: platosData,
        cantidades: cantidadesArray,
        observaciones: observaciones || "",
        status: "en_espera", // Estado estandarizado: en_espera, recoger, entregado
        IsActive: true
      };

      console.log("📤 Enviando comanda:", JSON.stringify(comandaData, null, 2));

      const response = await axios.post(COMANDA_API, comandaData, { timeout: 5000 });
      
      console.log("✅ Comanda enviada:", response.data);
      
      const comandaNumber = response.data.comanda?.comandaNumber || response.data.comandaNumber || "N/A";
      Alert.alert("✅ Éxito", `Comanda #${comandaNumber} creada. La mesa ahora está en estado "Pedido".`);

      // Limpiar AsyncStorage
      await AsyncStorage.removeItem("mesaSeleccionada");
      await AsyncStorage.removeItem("selectedPlates");
      await AsyncStorage.removeItem("selectedPlatesIds");
      await AsyncStorage.removeItem("cantidadesComanda");
      await AsyncStorage.removeItem("additionalDetails");
      console.log("🧹 AsyncStorage limpiado");
      
      setSelectedMesa(null);
      setSelectedPlatos([]);
      setCantidades({});
      setObservaciones("");
      
      console.log("🧹 Comanda limpiada");
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
      // Guardar objetos completos para la UI
      await AsyncStorage.setItem("selectedPlates", JSON.stringify(selectedPlatos));
      // Guardar también solo los IDs según el modelo especificado
      const selectedPlatesIds = selectedPlatos.map(p => p._id);
      await AsyncStorage.setItem("selectedPlatesIds", JSON.stringify(selectedPlatesIds));
      // Guardar cantidades
      await AsyncStorage.setItem("cantidadesComanda", JSON.stringify(
        selectedPlatos.map(p => cantidades[p._id] || 1)
      ));
      // Guardar observaciones
      await AsyncStorage.setItem("additionalDetails", observaciones);
      console.log("💾 Datos guardados en AsyncStorage");
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

  // Filtrar categorías solo del tipo seleccionado
  const categorias = tipoPlatoFiltro
    ? [...new Set(platos.filter(p => p.tipo === tipoPlatoFiltro).map(p => p.categoria))].filter(Boolean)
    : [];
  
  // Filtrar platos por tipo, búsqueda y categoría
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 CREAR PEDIDO</Text>
        </View>

        {/* Selección de Mesa */}
        <View style={styles.section}>
          <View style={styles.mesaContainer}>
            <Text style={styles.label}>Mesa:</Text>
            <TouchableOpacity
              style={styles.mesaButton}
              onPress={() => {
                fetchMesas();
                setModalMesasVisible(true);
              }}
            >
              <Text style={styles.mesaButtonText}>
                {selectedMesa ? `Mesa ${selectedMesa.nummesa}` : "Seleccionar Mesa"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#C41E3A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                fetchMesas();
                setModalMesasVisible(true);
              }}
            >
              <MaterialCommunityIcons name="clipboard-text" size={20} color="#FFFFFF" />
              <Text style={styles.selectButtonText}> Seleccionar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Platos Seleccionados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            PLATOS SELECCIONADOS ({selectedPlatos.length})
          </Text>
          {selectedPlatos.length === 0 ? (
            <Text style={styles.emptyText}>No hay platos seleccionados</Text>
          ) : (
            selectedPlatos.map((plato) => {
              const cantidad = cantidades[plato._id] || 1;
              const subtotal = plato.precio * cantidad;
              return (
                <View key={plato._id} style={styles.platoItem}>
                  <View style={styles.platoInfo}>
                    <Text style={styles.platoNombre}>{plato.nombre}</Text>
                    <Text style={styles.platoCantidad}>x{cantidad}</Text>
                    <Text style={styles.platoPrecio}>S/. {subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.platoActions}>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, -1)}
                    >
                      <Text style={styles.cantidadButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.cantidadText}>{cantidad}</Text>
                    <TouchableOpacity
                      style={styles.cantidadButton}
                      onPress={() => handleUpdateCantidad(plato._id, 1)}
                    >
                      <Text style={styles.cantidadButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePlato(plato._id)}
                    >
                      <MaterialCommunityIcons name="delete" size={20} color="#C41E3A" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Subtotal y Observaciones */}
        <View style={styles.section}>
          <Text style={styles.subtotalText}>Subtotal: S/. {calcularSubtotal()}</Text>
          <Text style={styles.label}>Observaciones:</Text>
          <TextInput
            style={styles.observacionesInput}
            placeholder="Sin ají..."
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Total */}
        <View style={styles.section}>
          <Text style={styles.totalText}>TOTAL: S/. {calcularSubtotal()}</Text>
        </View>

        {/* Botones */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              loadPlatosData();
              setTipoPlatoFiltro(null); // Resetear tipo al abrir modal
              setCategoriaFiltro(null); // Resetear categoría
              setSearchPlato(""); // Resetear búsqueda
              setModalPlatosVisible(true);
            }}
          >
            <MaterialCommunityIcons name="magnify" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}> + Plato</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, isSendingComanda && styles.sendButtonDisabled]}
            onPress={handleEnviarComanda}
            disabled={isSendingComanda}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            <Text style={styles.sendButtonText}> ENVIAR</Text>
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
            <Text style={styles.modalTitle}>🪑 MESAS DISPONIBLES</Text>
            
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
                    const mesaArea = typeof mesa.area === 'object' 
                      ? mesa.area.nombre 
                      : areas.find(a => a._id === mesa.area)?.nombre || 'Sin área';
                    
                    return (
                      <TouchableOpacity
                        key={mesa._id}
                        style={[
                          styles.mesaCard,
                          selectedMesa?._id === mesa._id && styles.mesaCardSelected
                        ]}
                        onPress={() => handleSelectMesa(mesa)}
                      >
                        <Text style={styles.mesaCardText}>Mesa {mesa.nummesa}</Text>
                        <Text style={styles.mesaCardAreaText}>{mesaArea}</Text>
                        {selectedMesa?._id === mesa._id && (
                          <MaterialCommunityIcons name="check-circle" size={24} color="#00C851" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
            {selectedMesa && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => setModalMesasVisible(false)}
              >
                <Text style={styles.confirmButtonText}>
                  ✅ SELECCIONAR Mesa {selectedMesa.nummesa}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalMesasVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
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
            <Text style={styles.modalTitle}>🍽️ MENÚ</Text>
            
            {/* Selector de Tipo de Plato (OBLIGATORIO) */}
            {!tipoPlatoFiltro ? (
              <View style={styles.tipoSelectorContainer}>
                <Text style={styles.tipoSelectorTitle}>Selecciona el tipo de menú:</Text>
                <View style={styles.tipoButtonsContainer}>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => {
                      setTipoPlatoFiltro("platos-desayuno");
                      console.log("🍳 Tipo seleccionado: Desayuno");
                    }}
                  >
                    <MaterialCommunityIcons name="coffee" size={40} color="#FFFFFF" />
                    <Text style={styles.tipoButtonText}>DESAYUNO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tipoButton}
                    onPress={() => {
                      setTipoPlatoFiltro("carta-normal");
                      console.log("🍽️ Tipo seleccionado: Carta Normal");
                    }}
                  >
                    <MaterialCommunityIcons name="silverware-fork-knife" size={40} color="#FFFFFF" />
                    <Text style={styles.tipoButtonText}>CARTA NORMAL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Botón para cambiar tipo */}
                <TouchableOpacity
                  style={styles.changeTipoButton}
                  onPress={() => {
                    setTipoPlatoFiltro(null);
                    setCategoriaFiltro(null);
                    setSearchPlato("");
                  }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
                  <Text style={styles.changeTipoButtonText}>
                    Cambiar tipo ({tipoPlatoFiltro === "platos-desayuno" ? "Desayuno" : "Carta Normal"})
                  </Text>
                </TouchableOpacity>

                {/* Búsqueda */}
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar: arroz..."
                  value={searchPlato}
                  onChangeText={setSearchPlato}
                />
                
                {/* Filtros de Categoría (solo se muestran después de seleccionar tipo) */}
                <ScrollView horizontal style={styles.categoriasContainer}>
                  <TouchableOpacity
                    style={[styles.categoriaChip, !categoriaFiltro && styles.categoriaChipActive]}
                    onPress={() => setCategoriaFiltro(null)}
                  >
                    <Text style={styles.categoriaChipText}>Todos</Text>
                  </TouchableOpacity>
                  {categorias.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoriaChip, categoriaFiltro === cat && styles.categoriaChipActive]}
                      onPress={() => setCategoriaFiltro(cat)}
                    >
                      <Text style={styles.categoriaChipText}>
                        {getCategoriaIcon(cat)} {cat.split("(")[0].trim()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Lista de Platos */}
                <ScrollView style={styles.modalScrollView}>
                  {platosFiltrados.length === 0 ? (
                    <View style={styles.emptyPlatosContainer}>
                      <Text style={styles.emptyPlatosText}>
                        No hay platos disponibles para esta búsqueda
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
                              style={styles.cantidadButton}
                              onPress={() => {
                                if (cantidad > 0) {
                                  handleUpdateCantidad(plato._id, -1);
                                }
                              }}
                            >
                              <Text style={styles.cantidadButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.cantidadText}>{cantidad || 0}</Text>
                            <TouchableOpacity
                              style={styles.cantidadButton}
                              onPress={() => handleUpdateCantidad(plato._id, 1)}
                            >
                              <Text style={styles.cantidadButtonText}>+</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.addPlatoButton}
                              onPress={() => {
                                handleAddPlato(plato);
                                Alert.alert("✅", `${plato.nombre} agregado`);
                              }}
                            >
                              <Text style={styles.addPlatoButtonText}>➕ AGREGAR</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalPlatosVisible(false);
                setTipoPlatoFiltro(null);
                setCategoriaFiltro(null);
                setSearchPlato("");
              }}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  mesaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  mesaButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C41E3A",
  },
  mesaButtonText: {
    fontSize: 16,
    color: "#333",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C41E3A",
    padding: 12,
    borderRadius: 8,
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  platoItem: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  platoInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  platoNombre: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  platoCantidad: {
    fontSize: 16,
    marginHorizontal: 10,
  },
  platoPrecio: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#C41E3A",
  },
  platoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  cantidadButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#C41E3A",
    alignItems: "center",
    justifyContent: "center",
  },
  cantidadButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  cantidadText: {
    fontSize: 16,
    fontWeight: "bold",
    minWidth: 30,
    textAlign: "center",
  },
  removeButton: {
    padding: 5,
  },
  subtotalText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  observacionesInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  totalText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#C41E3A",
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 10,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D4FF",
    padding: 15,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C41E3A",
    padding: 15,
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontStyle: "italic",
    padding: 20,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  modalScrollView: {
    maxHeight: 400,
  },
  mesasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  mesaCard: {
    width: "30%",
    backgroundColor: "#F8F9FA",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  mesaCardSelected: {
    borderColor: "#00C851",
    backgroundColor: "#E8F5E9",
  },
  mesaCardText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mesaCardAreaText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: "#00C851",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: "#C41E3A",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  categoriasContainer: {
    marginBottom: 15,
  },
  categoriaChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  categoriaChipActive: {
    backgroundColor: "#C41E3A",
    borderColor: "#C41E3A",
  },
  categoriaChipText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
  platoModalItem: {
    backgroundColor: "#F8F9FA",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  platoModalInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  platoModalNombre: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  platoModalPrecio: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#C41E3A",
  },
  platoModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  addPlatoButton: {
    backgroundColor: "#00C851",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPlatoButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  tipoSelectorContainer: {
    padding: 20,
    alignItems: "center",
  },
  tipoSelectorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#333",
    textAlign: "center",
  },
  tipoButtonsContainer: {
    flexDirection: "row",
    gap: 20,
    width: "100%",
    justifyContent: "space-around",
  },
  tipoButton: {
    flex: 1,
    backgroundColor: "#C41E3A",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  tipoButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  changeTipoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9500",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  changeTipoButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 8,
  },
  emptyPlatosContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyPlatosText: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default SecondScreen;
