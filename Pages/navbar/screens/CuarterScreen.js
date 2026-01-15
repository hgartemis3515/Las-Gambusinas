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
  TextInput,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET, COMANDA_API, DISHES_API, AREAS_API, MESAS_API_UPDATE } from "../../../apiConfig";
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
  const [areas, setAreas] = useState([]);
  const [filtroArea, setFiltroArea] = useState("All"); // "All" o ID del área
  const [userInfo, setUserInfo] = useState(null);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);

  useEffect(() => {
    loadUserData();
    obtenerMesas();
    obtenerComandasHoy();
    obtenerAreas();
    const interval = setInterval(() => {
      obtenerMesas();
      obtenerComandasHoy();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const obtenerAreas = useCallback(async () => {
    try {
      const response = await axios.get(AREAS_API, { timeout: 5000 });
      setAreas(response.data.filter(area => area.isActive !== false));
    } catch (error) {
      console.error("Error al obtener las áreas:", error.message);
    }
  }, []);

  const getComandasPorMesa = (mesaNum) => {
    return comandas.filter(
      (comanda) => comanda.mesas?.nummesa === mesaNum && comanda.IsActive !== false
    );
  };

  // Obtener el estado de la mesa
  const getEstadoMesa = (mesa) => {
    // Si la mesa tiene estado definido, usarlo (normalizar a formato con primera letra mayúscula)
    if (mesa.estado) {
      const estadoLower = mesa.estado.toLowerCase();
      // Convertir a formato con primera letra mayúscula
      return estadoLower.charAt(0).toUpperCase() + estadoLower.slice(1);
    }
    // Fallback: determinar estado basado en comandas
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

  // Filtrar mesas según el filtro de estado y área
  const mesasFiltradas = mesas.filter(mesa => {
    // Filtro por estado
    const pasaFiltroEstado = filtroEstado === "All" || getEstadoMesa(mesa) === "Reservado";
    
    // Filtro por área
    const pasaFiltroArea = filtroArea === "All" || 
      (mesa.area?._id || mesa.area) === filtroArea ||
      (typeof mesa.area === 'object' && mesa.area._id === filtroArea);
    
    return pasaFiltroEstado && pasaFiltroArea;
  });

  // Manejar selección de mesa
  const handleSelectMesa = async (mesa) => {
    const estado = getEstadoMesa(mesa);
    
    if (estado === "Pedido" || estado?.toLowerCase() === "pedido") {
      // Obtener la comanda activa de esta mesa
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      const comandaActiva = comandasMesa.find(c => 
        c.status?.toLowerCase() !== "entregado" && 
        c.status?.toLowerCase() !== "completado"
      ) || comandasMesa[0];

      if (comandaActiva) {
        // Verificar que el mozo actual sea el que creó la comanda
        const mozoComandaId = comandaActiva.mozos?._id || comandaActiva.mozos;
        const mozoActualId = userInfo?._id;
        
        if (mozoComandaId && mozoActualId && mozoComandaId.toString() !== mozoActualId.toString()) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede editarla o eliminarla.",
            [{ text: "OK" }]
          );
          return;
        }

        // Mostrar opciones: Editar o Eliminar
        Alert.alert(
          `Comanda #${comandaActiva.comandaNumber || comandaActiva._id.slice(-4)}`,
          "¿Qué deseas hacer?",
          [
            {
              text: "Editar",
              onPress: async () => {
                await obtenerPlatos();
                await handleEditarComanda(comandaActiva);
              }
            },
            {
              text: "Eliminar",
              style: "destructive",
              onPress: () => handleEliminarComanda(comandaActiva, mesa)
            },
            {
              text: "Cancelar",
              style: "cancel"
            }
          ]
        );
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
      setTipoPlatoFiltro(null);
      setSearchPlato("");
      setCategoriaFiltro(null);
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

  const handleAgregarPlato = (plato) => {
    if (!comandaEditando) return;
    
    // Verificar si el plato ya existe en la comanda
    const platoExistente = comandaEditando.platosEditados.find(
      p => (p.plato === plato._id || p.plato?.toString() === plato._id?.toString())
    );
    
    if (platoExistente) {
      // Si ya existe, aumentar la cantidad
      const index = comandaEditando.platosEditados.indexOf(platoExistente);
      handleCambiarCantidad(index, 1);
      Alert.alert("✅", `Cantidad de ${plato.nombre} aumentada`);
    } else {
      // Si no existe, agregarlo
      const nuevoPlato = {
        plato: plato._id,
        platoId: plato.id || null,
        estado: "en_espera",
        cantidad: 1,
        nombre: plato.nombre,
        precio: plato.precio,
      };

      setComandaEditando({
        ...comandaEditando,
        platosEditados: [...comandaEditando.platosEditados, nuevoPlato],
      });
      Alert.alert("✅", `${plato.nombre} agregado`);
    }
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

  const handleEliminarComanda = async (comanda, mesa) => {
    // Confirmación para eliminar
    Alert.alert(
      "⚠️ Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar la comanda #${comanda.comandaNumber || comanda._id.slice(-4)} de la mesa ${mesa.nummesa}?\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Eliminar la comanda
              await axios.delete(`${COMANDA_API}/${comanda._id}`, { timeout: 5000 });
              
              // Actualizar el estado de la mesa a "libre"
              await axios.put(
                `${MESAS_API_UPDATE}/${mesa._id}/estado`,
                { estado: "libre" },
                { timeout: 5000 }
              );
              
              Alert.alert("✅", "Comanda eliminada exitosamente. La mesa ha sido liberada.");
              
              // Cerrar modal si está abierto
              setModalEditVisible(false);
              setComandaEditando(null);
              
              // Actualizar datos
              obtenerComandasHoy();
              obtenerMesas();
            } catch (error) {
              console.error("Error eliminando comanda:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || "No se pudo eliminar la comanda"
              );
            }
          }
        }
      ]
    );
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
        
        {/* Filtro por Área */}
        <View style={styles.areaFilterContainer}>
          <Text style={styles.areaFilterLabel}>Áreas:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.areaFilterScroll}
            contentContainerStyle={styles.areaFilterContent}
          >
            <TouchableOpacity
              style={[styles.areaFilterButton, filtroArea === "All" && styles.areaFilterButtonActive]}
              onPress={() => setFiltroArea("All")}
            >
              <Text style={[styles.areaFilterButtonText, filtroArea === "All" && styles.areaFilterButtonTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>
            {areas.map((area) => (
              <TouchableOpacity
                key={area._id}
                style={[styles.areaFilterButton, filtroArea === area._id && styles.areaFilterButtonActive]}
                onPress={() => setFiltroArea(area._id)}
              >
                <Text style={[styles.areaFilterButtonText, filtroArea === area._id && styles.areaFilterButtonTextActive]}>
                  {area.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                  {mesa.area && (
                    <Text style={styles.mesaCardArea}>
                      {typeof mesa.area === 'object' ? mesa.area.nombre : areas.find(a => a._id === mesa.area)?.nombre || 'Sin área'}
                    </Text>
                  )}
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
          setTipoPlatoFiltro(null);
          setSearchPlato("");
          setCategoriaFiltro(null);
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
                setTipoPlatoFiltro(null);
                setSearchPlato("");
                setCategoriaFiltro(null);
              }}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
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

              {/* Agregar Platos */}
              <View style={styles.editSection}>
                <TouchableOpacity
                  style={styles.addPlatoButton}
                  onPress={async () => {
                    await obtenerPlatos();
                    setTipoPlatoFiltro(null);
                    setSearchPlato("");
                    setCategoriaFiltro(null);
                    // Mostrar selector de tipo
                    Alert.alert(
                      "Agregar Plato",
                      "Selecciona el tipo de menú:",
                      [
                        { text: "Cancelar", style: "cancel" },
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
                  <MaterialCommunityIcons name="plus-circle" size={20} color={theme.colors.text.white} />
                  <Text style={styles.addPlatoButtonText}> Agregar Plato</Text>
                </TouchableOpacity>

                {tipoPlatoFiltro && (
                  <>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar plato..."
                      placeholderTextColor={theme.colors.text.light}
                      value={searchPlato}
                      onChangeText={setSearchPlato}
                    />
                    <ScrollView 
                      horizontal 
                      style={styles.categoriasContainer} 
                      showsHorizontalScrollIndicator={false}
                    >
                      <TouchableOpacity
                        style={[styles.categoriaChip, !categoriaFiltro && styles.categoriaChipActive]}
                        onPress={() => setCategoriaFiltro(null)}
                      >
                        <Text style={[styles.categoriaChipText, !categoriaFiltro && styles.categoriaChipTextActive]}>
                          Todos
                        </Text>
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
                    <View style={styles.platosListContainer}>
                      {platosFiltrados.length === 0 ? (
                        <View style={styles.emptyPlatosContainer}>
                          <Text style={styles.emptyPlatosText}>No hay platos disponibles</Text>
                        </View>
                      ) : (
                        <ScrollView 
                          style={styles.platosScrollView}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {platosFiltrados.map((plato) => {
                            const cantidadEnComanda = comandaEditando?.platosEditados?.find(
                              p => (p.plato === plato._id || p.plato?.toString() === plato._id?.toString())
                            )?.cantidad || 0;
                            
                            return (
                              <TouchableOpacity
                                key={plato._id}
                                style={styles.platoSelectItem}
                                onPress={() => handleAgregarPlato(plato)}
                              >
                                <View style={styles.platoSelectInfo}>
                                  <Text style={styles.platoSelectNombre}>{plato.nombre}</Text>
                                  <Text style={styles.platoSelectPrecio}>S/. {plato.precio.toFixed(2)}</Text>
                                </View>
                                {cantidadEnComanda > 0 && (
                                  <View style={styles.cantidadBadge}>
                                    <Text style={styles.cantidadBadgeText}>x{cantidadEnComanda}</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      )}
                    </View>
                  </>
                )}
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Observaciones:</Text>
                <TextInput
                  style={styles.observacionesInput}
                  placeholder="Sin observaciones..."
                  placeholderTextColor={theme.colors.text.light}
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
                style={styles.deleteButton}
                onPress={() => {
                  if (comandaEditando?.mesaSeleccionada) {
                    handleEliminarComanda(comandaEditando, comandaEditando.mesaSeleccionada);
                  }
                }}
              >
                <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalEditVisible(false);
                  setComandaEditando(null);
                  setTipoPlatoFiltro(null);
                  setSearchPlato("");
                  setCategoriaFiltro(null);
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
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  filtersContainer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  areaFilterContainer: {
    marginTop: theme.spacing.sm,
  },
  areaFilterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  areaFilterScroll: {
    maxHeight: 50,
  },
  areaFilterContent: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  areaFilterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 80,
  },
  areaFilterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  areaFilterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
  areaFilterButtonTextActive: {
    color: theme.colors.text.white,
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
    color: theme.colors.text.primary,
  },
  mesaCardArea: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
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
    color: theme.colors.text.primary,
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
    minHeight: 400,
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
  modalScrollContent: {
    paddingBottom: theme.spacing.md,
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
  observacionesInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  totalText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.primary,
    textAlign: "center",
  },
  addPlatoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addPlatoButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
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
  platosListContainer: {
    height: 250,
    marginBottom: theme.spacing.md,
  },
  platosScrollView: {
    flex: 1,
  },
  platoSelectItem: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  platoSelectInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  platoSelectNombre: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    color: theme.colors.text.primary,
  },
  platoSelectPrecio: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
    marginLeft: theme.spacing.sm,
  },
  cantidadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    marginLeft: theme.spacing.sm,
  },
  cantidadBadgeText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: "700",
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
  modalButtons: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: "wrap",
  },
  saveButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  saveButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
  },
  deleteButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#DC3545",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  deleteButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 14,
  },
});

export default CuarterScreen;
