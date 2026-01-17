import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COMANDASEARCH_API_GET, COMANDA_API_SEARCH_BY_DATE, COMANDA_API, SELECTABLE_API_GET, DISHES_API, AREAS_API } from "../../../apiConfig";
import moment from "moment-timezone";

const ThirdScreen = () => {
  const [comandas, setComandas] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [fecha, setFecha] = useState(moment().tz("America/Lima").format("YYYY-MM-DD"));
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [comandaEditando, setComandaEditando] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);
  const [modalMesasVisible, setModalMesasVisible] = useState(false);
  const [areas, setAreas] = useState([]);
  const [filtroAreaMesa, setFiltroAreaMesa] = useState("All"); // Filtro para el modal de mesas

  useEffect(() => {
    loadUserData();
    fetchComandas();
    obtenerAreas();
    const interval = setInterval(fetchComandas, 3000);
    return () => clearInterval(interval);
  }, [fecha]);

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

  const fetchMesas = async () => {
    try {
      const response = await axios.get(SELECTABLE_API_GET, { timeout: 5000 });
      setMesas(response.data);
      console.log("🪑 Mesas cargadas:", response.data.length);
    } catch (error) {
      console.error("Error cargando mesas:", error);
    }
  };

  const fetchPlatos = async () => {
    try {
      const response = await axios.get(DISHES_API, { timeout: 5000 });
      setPlatos(response.data);
      console.log("🍽️ Platos cargados:", response.data.length);
    } catch (error) {
      console.error("Error cargando platos:", error);
    }
  };

  const handleEditarComanda = async (comanda) => {
    // Verificar que el usuario sea el creador
    const comandaMozoId = comanda.mozos?._id || comanda.mozos?.id;
    const usuarioId = userInfo?._id || userInfo?.id;
    
    if (comandaMozoId !== usuarioId) {
      Alert.alert("Error", "Solo puedes editar tus propias comandas");
      return;
    }

    console.log("📋 Comanda a editar:", JSON.stringify(comanda, null, 2));
    console.log("🍽️ Platos en comanda:", comanda.platos);
    
    // Cargar platos primero para poder buscar los datos completos si no están populados
    await fetchPlatos();
    
    // Mapear platos con manejo mejorado
    const platosEditados = comanda.platos.map((p, index) => {
      let platoData = null;
      const platoId = p.plato?._id || p.plato;
      const platoNumId = p.platoId || p.plato?.id; // ID numérico del plato
      
      // Si el plato está populado, usar esos datos
      if (p.plato && typeof p.plato === 'object' && p.plato.nombre) {
        platoData = p.plato;
      } else if (platoId) {
        // Si no está populado, buscar en la lista de platos cargados por _id
        platoData = platos.find(pl => pl._id === platoId || pl._id === platoId.toString());
      }
      
      // Si no se encontró por _id, buscar por id numérico
      if (!platoData && platoNumId) {
        platoData = platos.find(pl => pl.id === platoNumId);
        console.log(`🔍 Buscando plato por id numérico ${platoNumId}:`, platoData?.nombre || 'No encontrado');
      }
      
      console.log(`Plato ${index}:`, {
        platoId,
        platoNumId,
        platoData: platoData ? { nombre: platoData.nombre, precio: platoData.precio, id: platoData.id } : 'No encontrado',
        pOriginal: p
      });
      
      return {
        plato: platoId,
        platoId: platoNumId || platoData?.id || null, // Guardar el id numérico
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
    await fetchMesas();
    setModalEditVisible(true);
  };

  const handleEliminarComanda = (comanda) => {
    // Verificar que el usuario sea el creador
    const comandaMozoId = comanda.mozos?._id || comanda.mozos?.id;
    const usuarioId = userInfo?._id || userInfo?.id;
    
    if (comandaMozoId !== usuarioId) {
      Alert.alert("Error", "Solo puedes eliminar tus propias comandas");
      return;
    }

    Alert.alert(
      "⚠️ Eliminar Comanda",
      `¿Estás seguro de eliminar la comanda #${comanda.comandaNumber || comanda._id.slice(-4)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🗑️ Eliminando comanda:", comanda._id);
              await axios.delete(`${COMANDA_API}/${comanda._id}`, { timeout: 5000 });
              Alert.alert("✅", "Comanda eliminada exitosamente");
              fetchComandas();
            } catch (error) {
              console.error("Error eliminando comanda:", error);
              Alert.alert("Error", "No se pudo eliminar la comanda");
            }
          },
        },
      ]
    );
  };

  const handleGuardarEdicion = async () => {
    if (!comandaEditando) return;

    try {
      // Validar que haya al menos un plato
      if (!comandaEditando.platosEditados || comandaEditando.platosEditados.length === 0) {
        Alert.alert("Error", "Debe haber al menos un plato en la comanda");
        return;
      }

      // Validar que haya una mesa seleccionada
      if (!comandaEditando.mesaSeleccionada || !comandaEditando.mesaSeleccionada._id) {
        Alert.alert("Error", "Debe seleccionar una mesa");
        return;
      }

      // Preparar datos para actualizar - incluir tanto _id como id numérico
      const platosData = comandaEditando.platosEditados.map(p => {
        // Buscar el plato completo en la lista de platos para obtener el id numérico
        const platoCompleto = platos.find(pl => pl._id === p.plato || pl._id === p.plato?.toString());
        return {
          plato: p.plato,
          platoId: platoCompleto?.id || p.platoId || null, // ID numérico del plato
          estado: p.estado || "pendiente"
        };
      });
      
      console.log("🍽️ Platos preparados para actualizar:", platosData.map(p => ({
        _id: p.plato,
        id: p.platoId,
        estado: p.estado
      })));

      const cantidades = comandaEditando.platosEditados.map(p => p.cantidad || 1);

      const updateData = {
        mesas: comandaEditando.mesaSeleccionada._id,
        platos: platosData,
        cantidades: cantidades,
        observaciones: comandaEditando.observacionesEditadas || "",
      };

      console.log("📤 Actualizando comanda:", comandaEditando._id);
      console.log("📋 Datos:", JSON.stringify(updateData, null, 2));

      await axios.put(`${COMANDA_API}/${comandaEditando._id}`, updateData, { timeout: 5000 });
      
      Alert.alert("✅", "Comanda actualizada exitosamente");
      setModalEditVisible(false);
      setComandaEditando(null);
      fetchComandas();
    } catch (error) {
      console.error("Error actualizando comanda:", error);
      Alert.alert("Error", error.response?.data?.message || "No se pudo actualizar la comanda");
    }
  };

  const handleAgregarPlato = (plato) => {
    if (!comandaEditando) return;
    
    const nuevoPlato = {
      plato: plato._id,
      estado: "pendiente",
      cantidad: 1,
      nombre: plato.nombre,
      precio: plato.precio,
    };

    setComandaEditando({
      ...comandaEditando,
      platosEditados: [...comandaEditando.platosEditados, nuevoPlato],
    });
    Alert.alert("✅", `${plato.nombre} agregado`);
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

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "pagado":
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
      case "pagado":
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

  const calcularTotal = () => {
    if (!comandaEditando) return 0;
    return comandaEditando.platosEditados.reduce((total, p) => {
      return total + (p.precio || 0) * (p.cantidad || 1);
    }, 0);
  };

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

  const renderComanda = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const comandaMozoId = item.mozos?._id || item.mozos?.id;
    const usuarioId = userInfo?._id || userInfo?.id;
    const puedeEditar = comandaMozoId === usuarioId;
    
    return (
      <View style={styles.comandaCard}>
        <TouchableOpacity
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
        
        {puedeEditar && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditarComanda(item)}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.editButtonText}> Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleEliminarComanda(item)}
            >
              <MaterialCommunityIcons name="delete" size={20} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}> Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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

      {/* Modal de Edición */}
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
            <Text style={styles.modalTitle}>
              ✏️ EDITAR COMANDA #{comandaEditando?.comandaNumber || comandaEditando?._id.slice(-4)}
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              {/* Selección de Mesa */}
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Mesa:</Text>
                <TouchableOpacity
                  style={styles.mesaSelectButton}
                  onPress={async () => {
                    await fetchMesas();
                    setModalMesasVisible(true);
                  }}
                >
                  <Text style={styles.mesaSelectText}>
                    {comandaEditando?.mesaSeleccionada?.nummesa
                      ? `Mesa ${comandaEditando.mesaSeleccionada.nummesa}`
                      : "Seleccionar Mesa"}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#C41E3A" />
                </TouchableOpacity>
              </View>

              {/* Platos Actuales */}
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Platos en la comanda:</Text>
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
                        <MaterialCommunityIcons name="delete" size={20} color="#C41E3A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Agregar Platos */}
              <View style={styles.editSection}>
                <TouchableOpacity
                  style={styles.addPlatoButton}
                  onPress={async () => {
                    await fetchPlatos();
                    setTipoPlatoFiltro(null);
                    setSearchPlato("");
                    setCategoriaFiltro(null);
                    // Mostrar selector de tipo
                    Alert.alert(
                      "Agregar Plato",
                      "Selecciona el tipo de menú:",
                      [
                        { text: "Cancelar" },
                        {
                          text: "Desayuno",
                          onPress: () => setTipoPlatoFiltro("platos-desayuno"),
                        },
                        {
                          text: "Carta Normal",
                          onPress: () => setTipoPlatoFiltro("carta-normal"),
                        },
                      ]
                    );
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                  <Text style={styles.addPlatoButtonText}> Agregar Plato</Text>
                </TouchableOpacity>

                {tipoPlatoFiltro && (
                  <>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar plato..."
                      value={searchPlato}
                      onChangeText={setSearchPlato}
                    />
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
                    <ScrollView style={styles.platosListContainer}>
                      {platosFiltrados.map((plato) => (
                        <TouchableOpacity
                          key={plato._id}
                          style={styles.platoSelectItem}
                          onPress={() => handleAgregarPlato(plato)}
                        >
                          <Text style={styles.platoSelectNombre}>{plato.nombre}</Text>
                          <Text style={styles.platoSelectPrecio}>S/. {plato.precio.toFixed(2)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>

              {/* Observaciones */}
              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Observaciones:</Text>
                <TextInput
                  style={styles.observacionesInput}
                  placeholder="Sin ají..."
                  value={comandaEditando?.observacionesEditadas || ""}
                  onChangeText={(text) =>
                    setComandaEditando({
                      ...comandaEditando,
                      observacionesEditadas: text,
                    })
                  }
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Total */}
              <View style={styles.editSection}>
                <Text style={styles.totalText}>TOTAL: S/. {calcularTotal().toFixed(2)}</Text>
              </View>
            </ScrollView>

            {/* Botones */}
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

      {/* Modal de Selección de Mesas */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalMesasVisible}
        onRequestClose={() => setModalMesasVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.mesasModalContainer}>
            <Text style={styles.modalTitle}>🪑 Seleccionar Mesa</Text>
            
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

            <ScrollView style={styles.mesasGridScroll}>
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
                          comandaEditando?.mesaSeleccionada?._id === mesa._id && styles.mesaCardSelected
                        ]}
                        onPress={() => {
                          setComandaEditando({
                            ...comandaEditando,
                            mesaSeleccionada: mesa,
                          });
                          setModalMesasVisible(false);
                        }}
                      >
                        <Text style={styles.mesaCardText}>Mesa {mesa.nummesa}</Text>
                        <Text style={styles.mesaCardAreaText}>{mesaArea}</Text>
                        {comandaEditando?.mesaSeleccionada?._id === mesa._id && (
                          <MaterialCommunityIcons name="check-circle" size={24} color="#00C851" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalMesasVisible(false)}
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
  actionsContainer: {
    flexDirection: "row",
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D4FF",
    padding: 10,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C41E3A",
    padding: 10,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
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
    maxHeight: "90%",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#C41E3A",
  },
  modalScrollView: {
    maxHeight: 500,
  },
  editSection: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  mesaSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C41E3A",
  },
  mesaSelectText: {
    fontSize: 16,
    color: "#333",
  },
  platoEditItem: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  platoEditInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  platoEditNombre: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  platoEditPrecio: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#C41E3A",
  },
  platoEditActions: {
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
  addPlatoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C851",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  addPlatoButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  categoriasContainer: {
    marginBottom: 10,
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
  platosListContainer: {
    maxHeight: 200,
    marginBottom: 10,
  },
  platoSelectItem: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  platoSelectNombre: {
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
  },
  platoSelectPrecio: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#C41E3A",
  },
  observacionesInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  totalText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#C41E3A",
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#00C851",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#C41E3A",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  mesasModalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    width: "90%",
    maxHeight: "70%",
    padding: 20,
  },
  mesasGridScroll: {
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
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  modalAreaFilterContainer: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalAreaFilterScroll: {
    maxHeight: 50,
  },
  modalAreaFilterContent: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 20,
  },
  modalAreaFilterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minWidth: 70,
  },
  modalAreaFilterButtonActive: {
    backgroundColor: "#C41E3A",
    borderColor: "#C41E3A",
  },
  modalAreaFilterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  modalAreaFilterButtonTextActive: {
    color: "#FFFFFF",
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
});

export default ThirdScreen;
