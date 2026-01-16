import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { FileSystem } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import moment from "moment-timezone";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { COMANDA_API, MESAS_API_UPDATE, COMANDASEARCH_API_GET, BOUCHER_API, CLIENTES_API } from "../../../apiConfig";
import ModalClientes from "../../../Components/ModalClientes";

const PagosScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = PagosScreenStyles(theme);
  
  const [comandas, setComandas] = useState([]);
  const [mesa, setMesa] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalClienteVisible, setModalClienteVisible] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  useEffect(() => {
    loadPagoData();
  }, []);

  // Recargar datos cuando se enfoca la pantalla
  useFocusEffect(
    React.useCallback(() => {
      loadPagoData();
    }, [])
  );

  const loadPagoData = async () => {
    try {
      console.log("📋 Cargando datos de pago...");
      
      // Intentar cargar comandas múltiples primero (nuevo formato)
      const comandasData = await AsyncStorage.getItem("comandasPago");
      const mesaData = await AsyncStorage.getItem("mesaPago");
      
      console.log("📦 Datos encontrados:", {
        comandasPago: comandasData ? "Sí" : "No",
        mesaPago: mesaData ? "Sí" : "No"
      });
      
      if (comandasData) {
        const comandasArray = JSON.parse(comandasData);
        console.log("✅ Comandas cargadas:", comandasArray.length);
        
        // Filtrar comandas por cliente: asegurar que todas pertenezcan al mismo cliente
        if (comandasArray.length > 0) {
          const primeraComanda = comandasArray[0];
          const clienteId = primeraComanda.cliente?._id || primeraComanda.cliente;
          
          if (clienteId) {
            // Filtrar solo las comandas del mismo cliente
            const comandasFiltradas = comandasArray.filter(c => {
              const comandaClienteId = c.cliente?._id || c.cliente;
              return comandaClienteId && comandaClienteId.toString() === clienteId.toString();
            });
            
            if (comandasFiltradas.length !== comandasArray.length) {
              console.log(`⚠️ Filtrando comandas: ${comandasFiltradas.length} de ${comandasArray.length} pertenecen al mismo cliente`);
            }
            
            setComandas(comandasFiltradas);
          } else {
            // Si no hay cliente, usar todas las comandas (caso legacy)
            console.log("⚠️ Comandas sin cliente asignado (caso legacy)");
            setComandas(comandasArray);
          }
        } else {
          setComandas(comandasArray);
        }
      } else {
        // Fallback al formato antiguo (una sola comanda)
        const comandaData = await AsyncStorage.getItem("comandaPago");
        if (comandaData) {
          const comanda = JSON.parse(comandaData);
          console.log("✅ Comanda única cargada (formato antiguo)");
          setComandas([comanda]);
        } else {
          console.warn("⚠️ No se encontraron comandas en AsyncStorage");
        }
      }
      
      if (mesaData) {
        const mesa = JSON.parse(mesaData);
        console.log("✅ Mesa cargada:", mesa.nummesa);
        setMesa(mesa);
      } else {
        console.warn("⚠️ No se encontró mesa en AsyncStorage");
      }
    } catch (error) {
      console.error("❌ Error cargando datos de pago:", error);
      Alert.alert("Error", "No se pudieron cargar los datos de pago");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (comandas.length > 0) {
      calcularTotal();
    }
  }, [comandas]);

  const calcularTotal = () => {
    if (!comandas || comandas.length === 0) {
      setTotal(0);
      return;
    }

    let totalCalculado = 0;
    // Acumular total de todas las comandas
    comandas.forEach((comanda) => {
      if (comanda.platos) {
        comanda.platos.forEach((platoItem, index) => {
          const cantidad = comanda.cantidades?.[index] || 1;
          const precio = platoItem.plato?.precio || platoItem.precio || 0;
          totalCalculado += precio * cantidad;
        });
      }
    });
    setTotal(totalCalculado);
  };

  const generarHTMLBoucher = () => {
    const fechaActual = moment().tz("America/Lima").format("DD/MM/YYYY HH:mm:ss");
    const primeraComanda = comandas[0];
    const fecha = moment(primeraComanda?.createdAt || primeraComanda?.fecha).tz("America/Lima");
    const fechaFormateada = fecha.format("DD/MM/YYYY HH:mm:ss");

    let itemsHTML = "";
    // Acumular todos los platos de todas las comandas
    comandas.forEach((comanda, comandaIndex) => {
      if (comanda.platos) {
        comanda.platos.forEach((platoItem, index) => {
          const plato = platoItem.plato || platoItem;
          const cantidad = comanda.cantidades?.[index] || 1;
          const precio = plato.precio || 0;
          const subtotal = precio * cantidad;
          const comandaNum = comanda.comandaNumber || comanda._id.slice(-6);
          itemsHTML += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cantidad}x</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">${plato.nombre || "Plato"} ${comandas.length > 1 ? `(C#${comandaNum})` : ''}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${precio.toFixed(2)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">S/. ${subtotal.toFixed(2)}</td>
            </tr>
          `;
        });
      }
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-size: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .header h1 {
              margin: 5px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .info {
              margin: 10px 0;
              line-height: 1.6;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th {
              background-color: #f0f0f0;
              padding: 8px;
              text-align: left;
              font-weight: bold;
              border-bottom: 2px solid #000;
            }
            .total {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px solid #000;
              text-align: right;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            .observaciones {
              margin-top: 10px;
              padding: 8px;
              background-color: #f9f9f9;
              border-radius: 4px;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LAS GAMBUSINAS</h1>
            <p>Restaurante</p>
          </div>
          
          <div class="info">
            <div class="info-row">
              <span><strong>Comanda(s):</strong></span>
              <span>${comandas.map(c => `#${c.comandaNumber || c._id.slice(-6)}`).join(', ')}</span>
            </div>
            <div class="info-row">
              <span><strong>Mesa:</strong></span>
              <span>${mesa?.nummesa || comandas[0]?.mesas?.nummesa || "N/A"}</span>
            </div>
            <div class="info-row">
              <span><strong>Mozo:</strong></span>
              <span>${comandas[0]?.mozos?.name || "N/A"}</span>
            </div>
            <div class="info-row">
              <span><strong>Fecha Pedido:</strong></span>
              <span>${fechaFormateada}</span>
            </div>
            <div class="info-row">
              <span><strong>Fecha Pago:</strong></span>
              <span>${fechaActual}</span>
            </div>
            ${clienteSeleccionado ? `
            <div class="info-row">
              <span><strong>Cliente:</strong></span>
              <span>${clienteSeleccionado.nombre || 'N/A'}</span>
            </div>
            ` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Cant.</th>
                <th style="width: 45%;">Plato</th>
                <th style="width: 20%; text-align: right;">Precio</th>
                <th style="width: 20%; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          ${comandas.some(c => c.observaciones) ? `
            <div class="observaciones">
              <strong>Observaciones:</strong><br/>
              ${comandas.filter(c => c.observaciones).map(c => `C#${c.comandaNumber || c._id.slice(-6)}: ${c.observaciones}`).join('<br/>')}
            </div>
          ` : ""}

          <div class="total">
            <div class="total-row">
              <span>SUBTOTAL:</span>
              <span>S/. ${total.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>IGV (18%):</span>
              <span>S/. ${(total * 0.18).toFixed(2)}</span>
            </div>
            <div class="total-row" style="font-size: 16px; margin-top: 10px;">
              <span>TOTAL:</span>
              <span>S/. ${(total * 1.18).toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Gracias por su visita</p>
            <p>${fechaActual}</p>
          </div>
        </body>
      </html>
    `;

    return html;
  };

  const generarPDF = async () => {
    try {
      setIsGenerating(true);
      const html = generarHTMLBoucher();
      
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      Alert.alert(
        "✅ PDF Generado",
        "¿Qué deseas hacer?",
        [
          {
            text: "Imprimir",
            onPress: async () => {
              try {
                await Print.printAsync({ uri });
              } catch (error) {
                console.error("Error imprimiendo:", error);
                Alert.alert("Error", "No se pudo imprimir el documento");
              }
            }
          },
          {
            text: "Compartir",
            onPress: async () => {
              try {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                } else {
                  Alert.alert("Error", "La función de compartir no está disponible");
                }
              } catch (error) {
                console.error("Error compartiendo:", error);
                Alert.alert("Error", "No se pudo compartir el documento");
              }
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
    } catch (error) {
      console.error("Error generando PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePagar = async () => {
    if (!comandas || comandas.length === 0 || !mesa) {
      Alert.alert("Error", "No hay información de comandas o mesa");
      return;
    }

    // Verificar si la mesa ya está en estado "pagado"
    const mesaYaPagada = mesa.estado?.toLowerCase() === "pagado";
    
    if (mesaYaPagada) {
      // Si ya está pagada, solo generar el boucher
      Alert.alert(
        "Mesa ya Pagada",
        "Esta mesa ya ha sido pagada. Solo puedes generar el boucher.",
        [
          {
            text: "Generar Boucher",
            onPress: async () => {
              await generarPDF();
            }
          },
          {
            text: "Cancelar",
            style: "cancel"
          }
        ]
      );
      return;
    }

    // Abrir modal de cliente antes de procesar el pago
    setModalClienteVisible(true);
  };

  const procesarPagoConCliente = async (cliente) => {
    try {
      console.log("💳 Procesando pago con cliente:", cliente.nombre || cliente._id);

      // Asociar cliente a todas las comandas y actualizar totales
      for (const comanda of comandas) {
        // Actualizar comanda con cliente
        await axios.put(
          `${COMANDA_API}/${comanda._id}`,
          { cliente: cliente._id },
          { timeout: 5000 }
        );

        // Asociar cliente a comanda y actualizar totales
        const totalComanda = comanda.platos?.reduce((sum, platoItem, index) => {
          const plato = platoItem.plato || platoItem;
          const cantidad = comanda.cantidades?.[index] || 1;
          const precio = plato.precio || 0;
          return sum + (precio * cantidad);
        }, 0) || 0;

        // Asociar cliente a comanda y actualizar totales del cliente
        try {
          const baseUrl = CLIENTES_API.replace('/clientes', '');
          await axios.post(
            `${baseUrl}/comandas/${comanda._id}/cliente`,
            { clienteId: cliente._id, totalComanda: totalComanda },
            { timeout: 5000 }
          );
        } catch (error) {
          console.warn("⚠️ Error al asociar cliente a comanda (continuando):", error);
        }

        // Marcar comanda como pagada solo si no está ya pagada
        if (comanda.status?.toLowerCase() !== "pagado") {
          try {
            await axios.put(
              `${COMANDA_API}/${comanda._id}/status`,
              { nuevoStatus: "pagado" },
              { timeout: 5000 }
            );
            console.log(`✅ Comanda ${comanda.comandaNumber || comanda._id.slice(-4)} marcada como pagada con cliente`);
          } catch (comandaError) {
            // Si la comanda ya está pagada, no es un error crítico
            if (comandaError.response?.status === 400) {
              console.log(`ℹ️ Comanda ${comanda.comandaNumber || comanda._id.slice(-4)} ya está pagada, continuando...`);
            } else {
              throw comandaError; // Re-lanzar si es otro tipo de error
            }
          }
        } else {
          console.log(`ℹ️ Comanda ${comanda.comandaNumber || comanda._id.slice(-4)} ya está pagada, omitiendo actualización`);
        }
      }

      // Actualizar mesa a "pagado" solo si no está ya en "pagado"
      if (mesa.estado?.toLowerCase() !== "pagado") {
        try {
          await axios.put(
            `${MESAS_API_UPDATE}/${mesa._id}/estado`,
            { estado: "pagado" },
            { timeout: 5000 }
          );
          console.log("✅ Mesa actualizada a 'pagado'");
        } catch (mesaError) {
          // Si la mesa ya está en "pagado", no es un error crítico
          if (mesaError.response?.status === 400 && mesaError.response?.data?.message?.includes('Transición no permitida')) {
            console.log("ℹ️ Mesa ya está en estado 'pagado', continuando...");
          } else {
            throw mesaError; // Re-lanzar si es otro tipo de error
          }
        }
      } else {
        console.log("ℹ️ Mesa ya está en estado 'pagado', omitiendo actualización");
      }

      // Preparar datos del boucher
      const platosBoucher = [];
      comandas.forEach((comanda) => {
        if (comanda.platos && Array.isArray(comanda.platos)) {
          comanda.platos.forEach((platoItem, index) => {
            const plato = platoItem.plato || platoItem;
            const cantidad = comanda.cantidades?.[index] || 1;
            const precio = plato.precio || 0;
            const subtotal = precio * cantidad;
            
            platosBoucher.push({
              plato: plato._id || plato,
              platoId: plato.id || null,
              nombre: plato.nombre || "Plato",
              precio: precio,
              cantidad: cantidad,
              subtotal: subtotal,
              comandaNumber: comanda.comandaNumber || null
            });
          });
        }
      });

      const boucherData = {
        mesa: mesa._id,
        numMesa: mesa.nummesa,
        mozo: comandas[0]?.mozos?._id || comandas[0]?.mozos,
        nombreMozo: comandas[0]?.mozos?.name || "N/A",
        cliente: cliente._id, // Asociar cliente al boucher
        comandas: comandas.map(c => c._id),
        comandasNumbers: comandas.map(c => c.comandaNumber).filter(n => n != null),
        platos: platosBoucher,
        subtotal: total,
        igv: total * 0.18,
        total: total * 1.18,
        observaciones: comandas.map(c => c.observaciones).filter(o => o).join("; ") || "",
        fechaPago: new Date(),
        fechaPagoString: moment().tz("America/Lima").format("DD/MM/YYYY HH:mm:ss"),
        usadoEnComanda: comandas[0]?._id || null,
        fechaUso: new Date()
      };

      // Guardar boucher en el backend
      // Nota: La asociación del boucher al cliente se hace automáticamente en el backend
      // cuando se crea el boucher (ver boucher.repository.js)
      try {
        const boucherResponse = await axios.post(BOUCHER_API, boucherData, { timeout: 5000 });
        console.log("✅ Boucher guardado:", boucherResponse.data.boucherNumber || boucherResponse.data._id);
        console.log("✅ Boucher asociado automáticamente al cliente en el backend");
      } catch (boucherError) {
        console.error("⚠️ Error guardando boucher (pero pago procesado):", boucherError);
        // No bloquear el proceso si falla guardar el boucher
      }

      // Limpiar AsyncStorage
      await AsyncStorage.removeItem("comandasPago");
      await AsyncStorage.removeItem("comandaPago");
      await AsyncStorage.removeItem("mesaPago");

      // Generar PDF
      await generarPDF();

      Alert.alert(
        "✅", 
        `Pago procesado y voucher generado.\n\nCliente: ${cliente.nombre}\nLa mesa ahora está en estado 'Pagado'. Puedes liberarla desde la pantalla de Inicio.`
      );
      setComandas([]);
      setMesa(null);
      setClienteSeleccionado(null);
      navigation.navigate("Inicio");
    } catch (error) {
      console.error("Error procesando pago:", error);
      
      // Si el error es 400 y el mensaje indica que ya está pagado, mostrar mensaje más amigable
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || error.message || "";
        if (errorMessage.includes('Transición no permitida') || errorMessage.includes('ya está')) {
          // El proceso probablemente se completó, solo mostrar advertencia
          console.warn("⚠️ Algunas operaciones ya estaban completadas, pero el pago se procesó");
          Alert.alert(
            "⚠️ Advertencia", 
            "El pago se procesó, pero algunas operaciones ya estaban completadas. Verifica que todo esté correcto."
          );
          // Continuar con el flujo normal
          await AsyncStorage.removeItem("comandasPago");
          await AsyncStorage.removeItem("comandaPago");
          await AsyncStorage.removeItem("mesaPago");
          setComandas([]);
          setMesa(null);
          setClienteSeleccionado(null);
          navigation.navigate("Inicio");
          return;
        }
      }
      
      Alert.alert("Error", error.response?.data?.message || "No se pudo procesar el pago");
    }
  };

  const handleClienteSeleccionado = (cliente) => {
    setClienteSeleccionado(cliente);
    setModalClienteVisible(false);
    // Procesar el pago con el cliente seleccionado
    procesarPagoConCliente(cliente);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.emptyText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!comandas || comandas.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("Inicio")}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PAGO</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="receipt" size={64} color={theme.colors.text.light} />
          <Text style={styles.emptyText}>No hay comandas seleccionadas</Text>
          <Text style={styles.emptySubtext}>
            Selecciona una mesa en estado "Preparado" y elige "Pagar"
          </Text>
          <Text style={[styles.emptySubtext, { marginTop: 10, fontSize: 12, color: theme.colors.text.light }]}>
            {loading ? "Cargando datos..." : "No se encontraron datos en AsyncStorage"}
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { marginTop: 20 }]}
            onPress={async () => {
              setLoading(true);
              await loadPagoData();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.text.white} />
            <Text style={styles.backButtonText}>Recargar Datos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { marginTop: 10, backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate("Inicio")}
          >
            <Text style={styles.backButtonText}>Ir a Inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Inicio")}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PAGO</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Comanda(s):</Text>
            <Text style={styles.infoValue}>
              {comandas.map(c => `#${c.comandaNumber || c._id.slice(-6)}`).join(', ')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mesa:</Text>
            <Text style={styles.infoValue}>{mesa?.nummesa || comandas[0]?.mesas?.nummesa || "N/A"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mozo:</Text>
            <Text style={styles.infoValue}>{comandas[0]?.mozos?.name || "N/A"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoValue}>
              {moment(comandas[0]?.createdAt || comandas[0]?.fecha).tz("America/Lima").format("DD/MM/YYYY HH:mm")}
            </Text>
          </View>
        </View>

        <View style={styles.platosCard}>
          <Text style={styles.sectionTitle}>Platos</Text>
          {comandas.map((comanda, comandaIndex) => (
            <View key={comanda._id || comandaIndex}>
              {comandas.length > 1 && (
                <Text style={styles.comandaHeader}>
                  Comanda #{comanda.comandaNumber || comanda._id.slice(-6)}
                </Text>
              )}
              {comanda.platos?.map((platoItem, index) => {
                const plato = platoItem.plato || platoItem;
                const cantidad = comanda.cantidades?.[index] || 1;
                const precio = plato.precio || 0;
                const subtotal = precio * cantidad;
                
                return (
                  <View key={`${comandaIndex}-${index}`} style={styles.platoItem}>
                    <View style={styles.platoInfo}>
                      <Text style={styles.platoNombre}>{plato.nombre || "Plato"}</Text>
                      <Text style={styles.platoCantidad}>x{cantidad}</Text>
                    </View>
                    <Text style={styles.platoSubtotal}>S/. {subtotal.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {comandas.some(c => c.observaciones) && (
          <View style={styles.observacionesCard}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            {comandas.filter(c => c.observaciones).map((c, idx) => (
              <Text key={idx} style={styles.observacionesText}>
                C#{c.comandaNumber || c._id.slice(-6)}: {c.observaciones}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>S/. {total.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IGV (18%):</Text>
            <Text style={styles.totalValue}>S/. {(total * 0.18).toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>TOTAL:</Text>
            <Text style={styles.totalValueFinal}>S/. {(total * 1.18).toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={generarPDF}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color={theme.colors.text.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color={theme.colors.text.white} />
              <Text style={styles.buttonText}>Generar Boucher</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Solo mostrar botón "Pagar" si la mesa no está ya pagada */}
        {mesa?.estado?.toLowerCase() !== "pagado" && (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handlePagar}
            disabled={isGenerating}
          >
            <MaterialCommunityIcons name="cash-multiple" size={24} color={theme.colors.text.white} />
            <Text style={styles.buttonText}>Pagar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Clientes */}
      <ModalClientes
        visible={modalClienteVisible}
        onClose={() => setModalClienteVisible(false)}
        onClienteSeleccionado={handleClienteSeleccionado}
      />
    </SafeAreaView>
  );
};

const PagosScreenStyles = (theme) => StyleSheet.create({
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text.light,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: "700",
  },
  platosCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  comandaHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  platoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  platoInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  platoNombre: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: "600",
    flex: 1,
  },
  platoCantidad: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  platoSubtotal: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  observacionesCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  observacionesText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontStyle: "italic",
  },
  totalCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  totalRowFinal: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 2,
    borderTopColor: theme.colors.text.white,
  },
  totalLabel: {
    fontSize: 16,
    color: theme.colors.text.white,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 16,
    color: theme.colors.text.white,
    fontWeight: "600",
  },
  totalLabelFinal: {
    fontSize: 20,
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  totalValueFinal: {
    fontSize: 20,
    color: theme.colors.text.white,
    fontWeight: "700",
  },
  buttonsContainer: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.accent,
  },
  buttonText: {
    color: theme.colors.text.white,
    fontWeight: "700",
    fontSize: 16,
  },
});

export default PagosScreen;

