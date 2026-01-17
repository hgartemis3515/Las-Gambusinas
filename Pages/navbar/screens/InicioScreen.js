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
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COMANDASEARCH_API_GET, SELECTABLE_API_GET, COMANDA_API, DISHES_API, AREAS_API, MESAS_API_UPDATE } from "../../../apiConfig";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import logger from "../../../utils/logger";

const InicioScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { width, height } = useWindowDimensions();
  const [mesas, setMesas] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [comandaEditando, setComandaEditando] = useState(null);
  const [platos, setPlatos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [horaActual, setHoraActual] = useState(moment().tz("America/Lima"));
  const [adaptMobile, setAdaptMobile] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoPlatoFiltro, setTipoPlatoFiltro] = useState(null);
  const [searchPlato, setSearchPlato] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(null);

  // Detectar si es móvil
  const isMobile = width < 400 || adaptMobile;
  const mesaSize = isMobile ? 70 : 100;
  const canvasWidth = isMobile ? "95%" : "90%";
  const barraWidth = isMobile ? "20%" : "25%";
  const fontSize = isMobile ? 14 : 16;

  const styles = InicioScreenStyles(theme, isMobile, mesaSize, canvasWidth, barraWidth, fontSize);

  // Cargar configuración de adaptación móvil
  useEffect(() => {
    loadConfig();
    loadUserData();
    obtenerAreas();
  }, []);

  // Polling solo cuando la pantalla está enfocada
  useFocusEffect(
    useCallback(() => {
      obtenerMesas();
      obtenerComandasHoy();
      const interval = setInterval(() => {
        obtenerMesas();
        obtenerComandasHoy();
      }, 3000);
      return () => clearInterval(interval);
    }, [])
  );

  // Actualizar hora cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraActual(moment().tz("America/Lima"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const config = await AsyncStorage.getItem("adaptMobile");
      if (config !== null) {
        setAdaptMobile(JSON.parse(config));
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  const saveConfig = async (value) => {
    try {
      await AsyncStorage.setItem("adaptMobile", JSON.stringify(value));
      setAdaptMobile(value);
    } catch (error) {
      console.error("Error guardando configuración:", error);
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

  // Obtener todas las comandas de la mesa (incluyendo pagadas) - para mostrar mozo
  const getTodasComandasPorMesa = (mesaNum) => {
    return comandas.filter(
      (comanda) => 
        comanda.mesas?.nummesa === mesaNum && 
        comanda.IsActive !== false
    );
  };

  // Obtener solo comandas activas (no pagadas) - para operaciones
  const getComandasPorMesa = (mesaNum) => {
    return comandas.filter(
      (comanda) => 
        comanda.mesas?.nummesa === mesaNum && 
        comanda.IsActive !== false &&
        comanda.status?.toLowerCase() !== "pagado" &&
        comanda.status?.toLowerCase() !== "completado"
    );
  };

  const getEstadoMesa = (mesa) => {
    // Si la mesa tiene estado definido, usarlo (prioridad al estado de la mesa)
    if (mesa.estado) {
      const estadoLower = mesa.estado.toLowerCase();
      return estadoLower.charAt(0).toUpperCase() + estadoLower.slice(1);
    }
    
    // Si no tiene estado, determinarlo por las comandas activas
    const comandasMesa = getComandasPorMesa(mesa.nummesa);
    if (comandasMesa.length === 0) return "Libre";
    
    // Verificar si hay comandas en estado "recoger" (preparado)
    const hayPreparadas = comandasMesa.some(
      (c) => c.status?.toLowerCase() === "recoger"
    );
    
    if (hayPreparadas) return "Preparado";
    
    return "Pedido";
  };

  const getMozoMesa = (mesa) => {
    // Si la mesa está libre, no mostrar mozo
    if (mesa.estado?.toLowerCase() === "libre") {
      return "N/A";
    }
    
    // PRIORIDAD: Primero buscar comandas activas (no pagadas)
    const comandasActivas = getComandasPorMesa(mesa.nummesa);
    if (comandasActivas.length > 0) {
      // Ordenar comandas activas por fecha de creación descendente (más reciente primero)
      const comandasOrdenadas = [...comandasActivas].sort((a, b) => {
        // Priorizar createdAt si está disponible
        if (a.createdAt && b.createdAt) {
          const fechaA = new Date(a.createdAt).getTime();
          const fechaB = new Date(b.createdAt).getTime();
          return fechaB - fechaA; // Descendente (más reciente primero)
        }
        // Fallback: usar comandaNumber
        const numA = a.comandaNumber || 0;
        const numB = b.comandaNumber || 0;
        return numB - numA; // Descendente (mayor número = más reciente)
      });
      
      // Tomar la comanda activa más reciente
      const comandaMasReciente = comandasOrdenadas[0];
      if (comandaMasReciente?.mozos?.name) {
        return comandaMasReciente.mozos.name;
      }
    }
    
    // Si no hay comandas activas, buscar en todas las comandas (incluyendo pagadas)
    // Esto es solo para casos donde la mesa tiene estado pero no comandas activas
    const todasComandasMesa = getTodasComandasPorMesa(mesa.nummesa);
    if (todasComandasMesa.length > 0) {
      // Ordenar comandas por fecha de creación descendente (más reciente primero)
      const comandasOrdenadas = [...todasComandasMesa].sort((a, b) => {
        // Priorizar createdAt si está disponible
        if (a.createdAt && b.createdAt) {
          const fechaA = new Date(a.createdAt).getTime();
          const fechaB = new Date(b.createdAt).getTime();
          return fechaB - fechaA; // Descendente (más reciente primero)
        }
        // Fallback: usar comandaNumber
        const numA = a.comandaNumber || 0;
        const numB = b.comandaNumber || 0;
        return numB - numA; // Descendente (mayor número = más reciente)
      });
      
      // Tomar la comanda más reciente
      const comandaMasReciente = comandasOrdenadas[0];
      return comandaMasReciente.mozos?.name || "N/A";
    }
    
    return "N/A";
  };

  const getEstadoColor = (estado) => {
    const estadoLower = estado?.toLowerCase() || "libre";
    switch (estadoLower) {
      case "libre":
        return theme.colors.mesaEstado.libre || "#9E9E9E"; // Gris
      case "esperando":
        return theme.colors.mesaEstado.esperando || "#FFC107"; // Amarillo
      case "pedido":
        return theme.colors.mesaEstado.pedido || "#2196F3"; // Azul
      case "preparado":
        return theme.colors.mesaEstado.preparado || "#FFC107"; // Amarillo
      case "pagado":
        return theme.colors.mesaEstado.pagado || "#4CAF50"; // Verde
      case "pagando":
        return theme.colors.mesaEstado.pagando || "#00C851"; // Verde
      case "reservado":
        return theme.colors.mesaEstado.reservado || "#9C27B0"; // Morado
      default:
        return theme.colors.mesaEstado.libre || "#9E9E9E";
    }
  };

  const handleSelectMesa = async (mesa) => {
    const estado = getEstadoMesa(mesa);
    setMesaSeleccionada(mesa);
    
    if (estado === "Libre") {
      // Solo seleccionar la mesa, no navegar automáticamente
      // El usuario puede usar la barra derecha para navegar
    } else if (estado === "Pedido" || estado?.toLowerCase() === "pedido") {
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      const comandaActiva = comandasMesa.find(c => 
        c.status?.toLowerCase() !== "pagado" && 
        c.status?.toLowerCase() !== "completado"
      ) || comandasMesa[0];

      if (comandaActiva) {
        const mozoComandaId = comandaActiva.mozos?._id || comandaActiva.mozos;
        const mozoActualId = userInfo?._id;
        
        if (mozoComandaId && mozoActualId && mozoComandaId.toString() !== mozoActualId.toString()) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede editarla.",
            [{ text: "OK" }]
          );
          return;
        }

        Alert.alert(
          `Mesa ${mesa.nummesa}`,
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
      }
    } else if (estado === "Preparado" || estado?.toLowerCase() === "preparado") {
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      const comandaPreparada = comandasMesa.find(c => 
        c.status?.toLowerCase() === "recoger"
      );
      
      // Obtener el mozo de la primera comanda para validar
      const primeraComanda = comandasMesa[0];
      const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
      const mozoActualId = userInfo?._id;
      const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();

      if (comandaPreparada) {
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado 'Preparado'.",
            [{ text: "OK" }]
          );
          return;
        }

        // Si es el mismo mozo, mostrar opciones de Pagar y Nueva Comanda
        const opciones = [
          {
            text: "Nueva Comanda",
            onPress: () => {
              // Guardar la mesa seleccionada para crear nueva comanda
              AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesa));
              navigation.navigate("Ordenes");
            }
          },
          {
            text: "Pagar",
            onPress: async () => {
              try {
                console.log("💾 Guardando datos para pago...");
                console.log("📋 Comandas a guardar:", comandasMesa.length);
                console.log("🪑 Mesa a guardar:", mesa.nummesa);
                
                // Guardar todas las comandas de la mesa para el pago
                await AsyncStorage.setItem("comandasPago", JSON.stringify(comandasMesa));
                await AsyncStorage.setItem("mesaPago", JSON.stringify(mesa));
                
                // Verificar que se guardaron correctamente
                const comandasVerificadas = await AsyncStorage.getItem("comandasPago");
                const mesaVerificada = await AsyncStorage.getItem("mesaPago");
                
                if (comandasVerificadas && mesaVerificada) {
                  console.log("✅ Datos guardados correctamente");
                  console.log("📋 Comandas guardadas:", JSON.parse(comandasVerificadas).length);
                  navigation.navigate("Pagos");
                } else {
                  console.error("❌ Error: Los datos no se guardaron correctamente");
                  Alert.alert("Error", "No se pudieron guardar los datos para el pago");
                }
              } catch (error) {
                console.error("❌ Error guardando datos para pago:", error);
                Alert.alert("Error", "No se pudo preparar el pago");
              }
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ];

        Alert.alert(
          `Mesa ${mesa.nummesa} - Preparado`,
          "El pedido está listo. ¿Qué deseas hacer?",
          opciones
        );
      }
    } else if (estado === "Pagado" || estado?.toLowerCase() === "pagado") {
      // Mesa en estado Pagado - mostrar opciones de Imprimir Boucher y Liberar
      const todasComandasMesa = getTodasComandasPorMesa(mesa.nummesa);
      // Obtener todas las comandas pagadas de la mesa
      const comandasPagadas = todasComandasMesa.filter(c => 
        c.status?.toLowerCase() === "pagado" || c.status?.toLowerCase() === "completado"
      );
      
      // Validar que sea el mismo mozo que creó la comanda
      if (comandasPagadas.length > 0) {
        const primeraComanda = comandasPagadas[0];
        const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
        const mozoActualId = userInfo?._id;
        const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();
        
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            "Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado 'Pagado'.",
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Filtrar comandas por cliente: si hay comandas con cliente, solo mostrar las del mismo cliente
      let comandasParaBoucher = comandasPagadas;
      if (comandasPagadas.length > 0) {
        // Obtener el cliente de la primera comanda pagada que tenga cliente
        const primeraComandaConCliente = comandasPagadas.find(c => c.cliente?._id || c.cliente);
        if (primeraComandaConCliente) {
          const clienteId = primeraComandaConCliente.cliente?._id || primeraComandaConCliente.cliente;
          if (clienteId) {
            // Filtrar solo las comandas del mismo cliente
            comandasParaBoucher = comandasPagadas.filter(c => {
              const comandaClienteId = c.cliente?._id || c.cliente;
              return comandaClienteId && comandaClienteId.toString() === clienteId.toString();
            });
            console.log(`🔍 Filtrando comandas por cliente: ${comandasParaBoucher.length} de ${comandasPagadas.length} comandas pertenecen al mismo cliente`);
          }
        }
      }
      
      Alert.alert(
        `Mesa ${mesa.nummesa} - Pagado`,
        `La mesa ha sido pagada.${comandasParaBoucher.length !== comandasPagadas.length ? `\n\nSe mostrarán ${comandasParaBoucher.length} comanda(s) del cliente.` : ''}\n\n¿Qué deseas hacer?`,
        [
          {
            text: "📄 Imprimir Boucher",
            onPress: async () => {
              try {
                // Guardar solo las comandas del mismo cliente para generar el boucher
                await AsyncStorage.setItem("comandasPago", JSON.stringify(comandasParaBoucher));
                await AsyncStorage.setItem("mesaPago", JSON.stringify(mesa));
                navigation.navigate("Pagos");
              } catch (error) {
                console.error("Error guardando datos para boucher:", error);
                Alert.alert("Error", "No se pudo preparar el boucher");
              }
            }
          },
          {
            text: "🔄 Liberar",
            onPress: () => handleLiberarMesa(mesa)
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } else {
      // Otros estados (Esperando, Reservado, etc.) - validar que sea el mismo mozo
      const comandasMesa = getComandasPorMesa(mesa.nummesa);
      
      if (comandasMesa.length > 0) {
        const primeraComanda = comandasMesa[0];
        const mozoComandaId = primeraComanda?.mozos?._id || primeraComanda?.mozos;
        const mozoActualId = userInfo?._id;
        const mismoMozo = mozoComandaId && mozoActualId && mozoComandaId.toString() === mozoActualId.toString();
        
        // Si no es el mismo mozo, mostrar mensaje de acceso denegado
        if (!mismoMozo) {
          Alert.alert(
            "Acceso Denegado",
            `Solo el mozo que creó esta comanda puede realizar acciones en esta mesa cuando está en estado '${estado}'.`,
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Si es el mismo mozo o no hay comandas, mostrar información
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
        estado: p.estado || "en_espera",
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
          estado: p.estado || "en_espera"
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
      obtenerMesas();
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

  const handleLiberarMesa = async (mesa) => {
    Alert.alert(
      "🔄 Liberar Mesa",
      `¿Estás seguro de que deseas liberar la mesa ${mesa.nummesa}?\n\nLa mesa volverá a estado "Libre" y estará disponible para otros mozos.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Liberar",
          onPress: async () => {
            try {
              if (!mesa || !mesa._id) {
                Alert.alert("Error", "No se pudo obtener la información de la mesa");
                return;
              }

              // Extraer el ID de la mesa de forma segura
              let mesaId = mesa._id;
              if (mesaId && typeof mesaId === 'object') {
                mesaId = mesaId.toString();
              }

              console.log("🔄 Liberando mesa:", mesaId);
              
              // Actualizar mesa a "libre"
              await axios.put(
                `${MESAS_API_UPDATE}/${mesaId}/estado`,
                { estado: "libre" },
                { timeout: 5000 }
              );
              
              console.log("✅ Mesa liberada:", mesa.nummesa);
              
              Alert.alert("✅", `Mesa ${mesa.nummesa} liberada exitosamente.\n\nLa mesa está ahora disponible para otros mozos.`);
              
              // Actualizar datos
              obtenerComandasHoy();
              obtenerMesas();
            } catch (error) {
              console.error("❌ Error liberando mesa:", error);
              await logger.error(error, {
                action: 'liberar_mesa',
                mesaId: mesa?._id,
                mesaNum: mesa?.nummesa,
                timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
              });
              
              const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
              Alert.alert("Error", `No se pudo liberar la mesa.\n\n${errorMsg}`);
            }
          }
        }
      ]
    );
  };

  const handleEliminarComanda = async (comanda, mesa) => {
    // Confirmación para eliminar
    Alert.alert(
      "⚠️ Confirmar Eliminación",
      `¿Estás seguro de que deseas eliminar la comanda #${comanda.comandaNumber || comanda._id?.slice(-4) || 'N/A'} de la mesa ${mesa?.nummesa || 'N/A'}?\n\nEsta acción no se puede deshacer.`,
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
              // Validar que tenemos el ID de la comanda
              if (!comanda) {
                Alert.alert("Error", "No se pudo obtener la comanda");
                await logger.error(new Error("Comanda no disponible"), {
                  action: 'eliminar_comanda',
                  comanda: comanda,
                  mesa: mesa
                });
                return;
              }

              // Extraer el ID de forma segura
              let comandaId = comanda._id;
              
              // Si _id es un objeto (puede pasar con populate), extraer el string
              if (comandaId && typeof comandaId === 'object') {
                comandaId = comandaId.toString();
              }
              
              if (!comandaId) {
                Alert.alert("Error", "No se pudo obtener el ID de la comanda");
                await logger.error(new Error("ID de comanda no disponible"), {
                  action: 'eliminar_comanda',
                  comanda: JSON.stringify(comanda),
                  mesa: mesa
                });
                return;
              }
              
              console.log("🗑️ Eliminando comanda:");
              console.log("  - ID:", comandaId);
              console.log("  - Tipo:", typeof comandaId);
              console.log("  - URL:", `${COMANDA_API}/${comandaId}`);
              console.log("  - Comanda completa:", JSON.stringify(comanda, null, 2));
              
              // Eliminar la comanda
              const deleteResponse = await axios.delete(`${COMANDA_API}/${comandaId}`, { timeout: 5000 });
              console.log("✅ Comanda eliminada");
              
              // Actualizar comandas localmente (remover la eliminada del estado)
              let comandasActualizadas = comandas.filter(c => {
                const cId = c._id?.toString ? c._id.toString() : c._id;
                const comandaIdStr = comandaId?.toString ? comandaId.toString() : comandaId;
                return cId !== comandaIdStr;
              });
              
              // Actualizar el estado inmediatamente
              setComandas(comandasActualizadas);
              
              // Verificar si hay más comandas activas en la mesa (usando estado local actualizado)
              const comandasMesaRestantes = comandasActualizadas.filter(c => {
                return c.mesas?.nummesa === mesa.nummesa &&
                       c.IsActive !== false && 
                       c.status?.toLowerCase() !== "pagado" && 
                       c.status?.toLowerCase() !== "completado";
              });
              
              const hayComandasActivas = comandasMesaRestantes.length > 0;
              
              // Solo actualizar la mesa a "libre" si no hay más comandas activas
              if (!hayComandasActivas && mesa) {
                try {
                  let mesaId = mesa._id;
                  if (mesaId && typeof mesaId === 'object') {
                    mesaId = mesaId.toString();
                  }
                  
                  if (!mesaId) {
                    console.warn("⚠️ No se pudo obtener el ID de la mesa para actualizar");
                  } else {
                    // Actualizar la mesa - el backend retorna todaslasmesas en la respuesta
                    const mesaResponse = await axios.put(
                      `${MESAS_API_UPDATE}/${mesaId}/estado`,
                      { estado: "libre" },
                      { timeout: 5000 }
                    );
                    
                    // Usar los datos que vienen del backend en lugar de hacer otra petición
                    if (mesaResponse.data?.todaslasmesas) {
                      setMesas(mesaResponse.data.todaslasmesas);
                      console.log("✅ Mesas actualizadas desde respuesta del servidor");
                    }
                    
                    console.log("✅ Mesa liberada:", mesa.nummesa);
                  }
                } catch (mesaError) {
                  // Solo registrar error si no es un error de que la mesa ya está en el estado correcto
                  const errorStatus = mesaError.response?.status;
                  const errorMessage = mesaError.response?.data?.error || mesaError.response?.data?.message || mesaError.message;
                  
                  const esErrorNoCritico = errorStatus === 400 && (
                    errorMessage?.toLowerCase().includes('ya está') ||
                    errorMessage?.toLowerCase().includes('already') ||
                    errorMessage?.toLowerCase().includes('estado actual')
                  );
                  
                  if (!esErrorNoCritico) {
                    console.error("⚠️ Error actualizando mesa (pero comanda eliminada):", mesaError);
                    // No mostrar alerta para no interrumpir el flujo cuando se eliminan múltiples comandas
                  } else {
                    console.log("ℹ️ La mesa ya está en el estado correcto");
                  }
                }
              } else if (hayComandasActivas) {
                console.log("ℹ️ No se actualiza la mesa porque aún tiene comandas activas");
              }
              
              Alert.alert("✅", "Comanda eliminada exitosamente.");
              
              // Cerrar modal si está abierto
              setModalEditVisible(false);
              setComandaEditando(null);
              setTipoPlatoFiltro(null);
              setSearchPlato("");
              setCategoriaFiltro(null);
              
              // Actualizar comandas desde el servidor (con debounce para evitar múltiples peticiones)
              // Solo si no hay más eliminaciones en proceso
              setTimeout(async () => {
                try {
                  await obtenerComandasHoy();
                } catch (error) {
                  // Silenciar errores de red durante actualizaciones rápidas
                  console.log("ℹ️ Actualización de comandas diferida debido a operaciones en curso");
                }
              }, 300);
            } catch (error) {
              // Guardar error en log
              await logger.error(error, {
                action: 'eliminar_comanda',
                comandaId: comanda?._id,
                comandaNumber: comanda?.comandaNumber,
                mesaId: mesa?._id,
                mesaNum: mesa?.nummesa,
                url: `${COMANDA_API}/${comanda?._id}`,
                timestamp: moment().tz("America/Lima").format("YYYY-MM-DD HH:mm:ss"),
              });
              
              console.error("❌ Error eliminando comanda:", error);
              console.error("Error completo:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText,
                comandaId: comanda?._id,
                comanda: comanda
              });
              
              let errorMessage = "No se pudo eliminar la comanda";
              
              if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 400) {
                  errorMessage = data?.message || `Solicitud inválida (400). ID: ${comanda?._id}`;
                } else if (status === 404) {
                  errorMessage = "Comanda no encontrada";
                } else if (status === 500) {
                  errorMessage = "Error del servidor al eliminar la comanda";
                } else {
                  errorMessage = data?.message || `Error ${status}: No se pudo eliminar la comanda`;
                }
              } else if (error.request) {
                errorMessage = "No se recibió respuesta del servidor. Verifica tu conexión.";
              } else {
                errorMessage = error.message || "Error desconocido al eliminar la comanda";
              }
              
              Alert.alert("Error", errorMessage);
            }
          }
        }
      ]
    );
  };

  // Obtener mesas por área/sección
  const getMesasPorArea = (areaId) => {
    if (areaId === "All") return mesas;
    return mesas.filter(mesa => {
      const mesaAreaId = mesa.area?._id || mesa.area;
      return mesaAreaId === areaId;
    });
  };

  // Obtener todas las áreas únicas de las mesas
  const areasConMesas = areas.filter(area => 
    mesas.some(mesa => {
      const mesaAreaId = mesa.area?._id || mesa.area;
      return mesaAreaId === area._id;
    })
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.profileButton}>
          <MaterialCommunityIcons name="account-circle" size={32} color={theme.colors.text.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LAS GAMBUSINAS</Text>
        <Text style={styles.headerTime}>{horaActual.format("HH:mm:ss")}</Text>
      </View>

      {/* Barra de Tabs de Áreas */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          <TouchableOpacity
            style={[
              styles.tabButton,
              seccionActiva === null && styles.tabButtonActive
            ]}
            onPress={() => setSeccionActiva(null)}
          >
            <Text style={[
              styles.tabButtonText,
              seccionActiva === null && styles.tabButtonTextActive
            ]}>
              Default
            </Text>
          </TouchableOpacity>
          {areasConMesas.map((area) => (
            <TouchableOpacity
              key={area._id}
              style={[
                styles.tabButton,
                seccionActiva === area._id && styles.tabButtonActive
              ]}
              onPress={() => setSeccionActiva(seccionActiva === area._id ? null : area._id)}
            >
              <Text style={[
                styles.tabButtonText,
                seccionActiva === area._id && styles.tabButtonTextActive
              ]}>
                {seccionActiva === area._id ? "☆ " : ""}{area.nombre.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Contenido Principal */}
      <View style={styles.mainContent}>
        {/* Canvas de Mesas */}
        <View style={[styles.canvas, { width: canvasWidth }]}>
          <ScrollView 
            style={styles.canvasScroll}
            contentContainerStyle={styles.canvasContent}
          >
            {seccionActiva ? (
              getMesasPorArea(seccionActiva).map((mesa) => {
                const estado = getEstadoMesa(mesa);
                const estadoColor = getEstadoColor(estado);
                const mozo = getMozoMesa(mesa);
                const isSelected = mesaSeleccionada?._id === mesa._id;

                return (
                  <TouchableOpacity
                    key={mesa._id}
                      style={[
                      styles.mesaCard,
                      {
                        width: mesaSize,
                        height: mesaSize,
                        backgroundColor: estadoColor,
                        borderWidth: isSelected ? 3 : 0,
                        borderColor: isSelected ? theme.colors.secondary : "transparent",
                      }
                    ]}
                    onPress={() => handleSelectMesa(mesa)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.mesaNumber}>M{mesa.nummesa}</Text>
                    <Text style={styles.mesaMozo}>{mozo !== "N/A" ? mozo.split(' ')[0] : ""}</Text>
                    <MaterialCommunityIcons 
                      name="circle" 
                      size={8} 
                      color={theme.colors.text.white} 
                      style={styles.mesaIcon}
                    />
                  </TouchableOpacity>
                );
              })
            ) : (
              mesas.map((mesa) => {
                const estado = getEstadoMesa(mesa);
                const estadoColor = getEstadoColor(estado);
                const mozo = getMozoMesa(mesa);
                const isSelected = mesaSeleccionada?._id === mesa._id;

                return (
                  <TouchableOpacity
                    key={mesa._id}
                      style={[
                      styles.mesaCard,
                      {
                        width: mesaSize,
                        height: mesaSize,
                        backgroundColor: estadoColor,
                        borderWidth: isSelected ? 3 : 0,
                        borderColor: isSelected ? theme.colors.secondary : "transparent",
                      }
                    ]}
                    onPress={() => handleSelectMesa(mesa)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.mesaNumber}>M{mesa.nummesa}</Text>
                    <Text style={styles.mesaMozo}>{mozo !== "N/A" ? mozo.split(' ')[0] : ""}</Text>
                    <MaterialCommunityIcons 
                      name="circle" 
                      size={8} 
                      color={theme.colors.text.white} 
                      style={styles.mesaIcon}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Barra Vertical Derecha */}
        <View style={[styles.barraDerecha, { width: barraWidth }]}>
          <ScrollView style={styles.barraScroll} showsVerticalScrollIndicator={false}>
            {/* Funciones */}
            <TouchableOpacity
              style={styles.barraItem}
              onPress={async () => {
                // Si hay una mesa seleccionada, guardarla y navegar
                if (mesaSeleccionada) {
                  try {
                    await AsyncStorage.setItem("mesaSeleccionada", JSON.stringify(mesaSeleccionada));
                    navigation.navigate("Ordenes");
                  } catch (error) {
                    console.error("Error guardando mesa seleccionada:", error);
                    navigation.navigate("Ordenes");
                  }
                } else {
                  // Si no hay mesa seleccionada, navegar normalmente
                  navigation.navigate("Ordenes");
                }
              }}
            >
              <Text style={styles.barraItemText}>➕ NUEVA ORDEN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                const comandasAbiertas = comandas.filter(c => 
                  c.status?.toLowerCase() !== "pagado" && 
                  c.status?.toLowerCase() !== "completado"
                );
                Alert.alert("Cerrar Cuenta", `${comandasAbiertas.length} comandas abiertas`);
              }}
            >
              <Text style={styles.barraItemText}>💰 Cerrar Cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                obtenerMesas();
                obtenerComandasHoy();
                Alert.alert("Recargar", "Datos actualizados");
              }}
            >
              <Text style={styles.barraItemText}>🔄 Recargar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Pedidos", "Ver pedidos pendientes");
              }}
            >
              <Text style={styles.barraItemText}>🛵 Pedidos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Juntar Mesas", "Selecciona las mesas a juntar");
              }}
            >
              <Text style={styles.barraItemText}>🔗 Juntar Mesas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Reservar", "Crear una reserva");
              }}
            >
              <Text style={styles.barraItemText}>📅 Reservar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Agregar Mesa", "Agregar una nueva mesa");
              }}
            >
              <Text style={styles.barraItemText}>➕ Agregar Mesa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Separar Mesas", "Separar mesas juntas");
              }}
            >
              <Text style={styles.barraItemText}>✂️ Separar Mesas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Quitar Mesa", "Eliminar una mesa");
              }}
            >
              <Text style={styles.barraItemText}>➖ Quitar Mesa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.barraItem}
              onPress={() => {
                Alert.alert("Nombre", "Editar nombre");
              }}
            >
              <Text style={styles.barraItemText}>✏️ Nombre</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

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

const InicioScreenStyles = (theme, isMobile, mesaSize, canvasWidth, barraWidth, fontSize) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...theme.shadows.medium,
  },
  profileButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.white,
    letterSpacing: 1,
  },
  headerTime: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text.white,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  canvas: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  canvasScroll: {
    flex: 1,
  },
  canvasContent: {
    padding: theme.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  mesaCard: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.medium,
  },
  mesaNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.white,
    marginBottom: 4,
  },
  mesaMozo: {
    fontSize: 10,
    color: theme.colors.text.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  mesaIcon: {
    marginTop: 4,
  },
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
  },
  tabsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  tabButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: fontSize,
    fontWeight: "600",
    color: theme.colors.text.secondary,
  },
  tabButtonTextActive: {
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  barraDerecha: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.medium,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  barraScroll: {
    flex: 1,
  },
  barraItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  barraItemText: {
    fontSize: fontSize,
    color: theme.colors.text.primary,
    fontWeight: "500",
  },
  barraItemSalir: {
    marginTop: "auto",
  },
  barraItemTextSalir: {
    color: theme.colors.primary,
    fontWeight: "700",
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
    fontSize: 14,
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
    fontSize: 14,
  },
});

export default InicioScreen;

