import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWindowDimensions } from "react-native";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import { colors } from "../constants/colors";
import * as Haptics from 'expo-haptics';
import { CLIENTES_API, apiConfig } from "../apiConfig";
import {
  METODOS_PAGO,
  MONEDA_DEFAULT,
  simboloMoneda,
  labelMetodoPago,
  parseMonto,
  calcularVueltoPreview,
  convertirMoneda,
  formatearMontoConMoneda,
  requiereEfectivo,
  validarEfectivo,
} from "../utils/pagoMetodoHelpers";

const ModalClientes = ({
  visible,
  onClose,
  onClienteSeleccionado,
  // Nuevas props de pago (opcionales para compatibilidad, pero recomendadas)
  onPagoConfirmado,
  totalACobrar = 0,
  tipoCambioUsd = null,
  permitirUsd = false,
  decimales = 2,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || {};
  const styles = modalStyles(theme);
  const { width } = useWindowDimensions();
  const escala = width < 390 ? 0.88 : 1;

  // Estado de cliente (original)
  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [esInvitado, setEsInvitado] = useState(true);
  const [loading, setLoading] = useState(false);

  // Estado de pago
  const [monedaSeleccionada, setMonedaSeleccionada] = useState(MONEDA_DEFAULT); // 'PEN' | 'USD'
  const [metodoPago, setMetodoPago] = useState(null); // 'efectivo' | 'digital' | 'tarjeta'
  const [montoRecibidoStr, setMontoRecibidoStr] = useState("");

  // Total en la moneda seleccionada
  const totalEnMoneda = useMemo(() => {
    return convertirMoneda(totalACobrar, monedaSeleccionada, tipoCambioUsd);
  }, [totalACobrar, monedaSeleccionada, tipoCambioUsd]);

  const montoRecibidoNum = useMemo(() => parseMonto(montoRecibidoStr), [montoRecibidoStr]);

  const vueltoPreview = useMemo(() => {
    if (metodoPago !== 'efectivo') return null;
    if (totalEnMoneda == null) return null;
    return calcularVueltoPreview(totalEnMoneda, montoRecibidoNum);
  }, [metodoPago, totalEnMoneda, montoRecibidoNum]);

  const validacionEfectivo = useMemo(() => {
    if (metodoPago !== 'efectivo' || totalEnMoneda == null) return { ok: true };
    return validarEfectivo(totalEnMoneda, montoRecibidoNum);
  }, [metodoPago, totalEnMoneda, montoRecibidoNum]);

  // USD disponible solo si el admin lo permitió Y hay tipo de cambio válido
  const usdDisponible = permitirUsd === true && tipoCambioUsd != null && tipoCambioUsd > 0;

  const puedeContinuar = useMemo(() => {
    if (!metodoPago) return false;
    if (metodoPago === 'efectivo') {
      if (totalEnMoneda == null) return false;
      if (!validacionEfectivo.ok) return false;
    }
    return true;
  }, [metodoPago, totalEnMoneda, validacionEfectivo]);

  const resetEstadoPago = () => {
    setMonedaSeleccionada(MONEDA_DEFAULT);
    setMetodoPago(null);
    setMontoRecibidoStr("");
  };

  const handleContinuar = async () => {
    if (!metodoPago) {
      Alert.alert("Falta método de pago", "Selecciona un método de pago para continuar.");
      return;
    }
    if (metodoPago === 'efectivo' && !validacionEfectivo.ok) {
      Alert.alert("Monto insuficiente", validacionEfectivo.mensaje);
      return;
    }

    setLoading(true);
    try {
      let clienteData = null;

      const clientesURL = apiConfig.isConfigured
        ? apiConfig.getEndpoint('/clientes')
        : CLIENTES_API;

      if (esInvitado || (!dni && !nombre && !telefono)) {
        const response = await axios.post(clientesURL, {}, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        clienteData = response.data;
      } else {
        const datosCliente = {};
        if (dni && !nombre && !telefono) {
          datosCliente.dni = dni.trim();
          datosCliente.nombre = "Invitado";
        } else if (nombre && !dni && !telefono) {
          datosCliente.nombre = nombre.trim();
        } else {
          if (dni && dni.trim()) datosCliente.dni = dni.trim();
          if (nombre && nombre.trim()) datosCliente.nombre = nombre.trim();
          if (telefono && telefono.trim()) datosCliente.telefono = telefono.trim();
        }
        const response = await axios.post(clientesURL, datosCliente, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        clienteData = response.data;
      }

      // Construir payload de pago
      const datosPago = {
        cliente: clienteData,
        metodoPago,
        montoRecibido: requiereEfectivo(metodoPago)
          ? Math.round(montoRecibidoNum * 100) / 100
          : null,
        vuelto: requiereEfectivo(metodoPago) ? vueltoPreview : null,
        moneda: monedaSeleccionada,
        tipoCambioUsdUsado: monedaSeleccionada === 'USD' ? tipoCambioUsd : null,
        totalEnMonedaCobro: totalEnMoneda,
      };

      // Solo usar el callback nuevo (onPagoConfirmado) que incluye cliente + datos de pago.
      // No llamar onClienteSeleccionado porque PagosScreen pasa ambos callbacks,
      // y handleClienteSeleccionado termina llamando handlePagoConfirmado también,
      // causando doble alerta de confirmación.
      if (onPagoConfirmado) {
        onPagoConfirmado(datosPago);
      } else if (onClienteSeleccionado) {
        // Fallback legacy solo si onPagoConfirmado no está definido
        onClienteSeleccionado(clienteData);
      }

      // Limpiar formulario
      setDni("");
      setNombre("");
      setTelefono("");
      setEsInvitado(true);
      resetEstadoPago();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      const isNetworkError = error.code === 'ECONNABORTED' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout') ||
        !error.response;
      if (isNetworkError) {
        Alert.alert(
          "Error de Conexión",
          "No se pudo crear el cliente debido a un error de red. Verifica tu conexión e intenta nuevamente.",
          [
            { text: "Reintentar", onPress: () => setTimeout(() => handleContinuar(), 500) },
            { text: "Cancelar", style: "cancel" }
          ]
        );
      } else {
        const status = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message || "Error desconocido";
        Alert.alert("Error", `No se pudo crear el cliente (Error ${status}): ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    setDni("");
    setNombre("");
    setTelefono("");
    setEsInvitado(true);
    resetEstadoPago();
    onClose && onClose();
  };

  const handleToggleMoneda = (nuevaMoneda) => {
    if (nuevaMoneda === monedaSeleccionada) return;
    if (nuevaMoneda === 'USD' && !usdDisponible) {
      const motivo = !permitirUsd
        ? 'El cobro en dólares no está habilitado. Pide al administrador que active "Permitir USD" en Configuración → Moneda y Precios.'
        : 'No se ha configurado un tipo de cambio USD válido. Pide al administrador que lo defina en Configuración → Moneda y Precios.';
      Alert.alert("USD no disponible", motivo);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMonedaSeleccionada(nuevaMoneda);
    setMontoRecibidoStr("");
  };

  const handleSeleccionarMetodo = (metodo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMetodoPago(metodo);
    if (metodo !== 'efectivo') {
      setMontoRecibidoStr("");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancelar}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalOverlayContent}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información del pago</Text>
              <TouchableOpacity onPress={handleCancelar} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.modalBody}>
                {/* Total a cobrar */}
                <View style={styles.totalCobroContainer}>
                  <Text style={styles.totalCobroLabel}>Total a cobrar:</Text>
                  <Text style={styles.totalCobroValue}>
                    {totalEnMoneda == null
                      ? '—'
                      : formatearMontoConMoneda(totalEnMoneda, monedaSeleccionada, decimales)}
                  </Text>
                </View>

                {/* Selector de moneda (toggle) */}
                <View style={styles.bloqueSeccion}>
                  <Text style={styles.bloqueLabel}>Moneda</Text>
                  <View style={styles.toggleMonedaContainer}>
                    <TouchableOpacity
                      style={[
                        styles.toggleMonedaOpcion,
                        monedaSeleccionada === 'PEN' && styles.toggleMonedaOpcionActiva,
                      ]}
                      onPress={() => handleToggleMoneda('PEN')}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleMonedaTexto,
                          monedaSeleccionada === 'PEN' && styles.toggleMonedaTextoActivo,
                        ]}
                      >
                        Soles (PEN)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleMonedaOpcion,
                        monedaSeleccionada === 'USD' && styles.toggleMonedaOpcionActiva,
                        !usdDisponible && styles.toggleMonedaOpcionDisabled,
                      ]}
                      onPress={() => handleToggleMoneda('USD')}
                      disabled={loading || !usdDisponible}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.toggleMonedaTexto,
                          monedaSeleccionada === 'USD' && styles.toggleMonedaTextoActivo,
                          !usdDisponible && styles.toggleMonedaTextoDisabled,
                        ]}
                      >
                        Dólares (USD)
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {!usdDisponible && (
                    <Text style={styles.notaMoneda}>
                      {permitirUsd
                        ? 'USD no disponible: define un tipo de cambio válido en Configuración.'
                        : 'USD bloqueado: pide al admin activar "Permitir USD" en Configuración.'}
                    </Text>
                  )}
                  {monedaSeleccionada === 'USD' && usdDisponible && (
                    <Text style={styles.notaMoneda}>
                      Tipo de cambio: 1 USD = S/. {Number(tipoCambioUsd).toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Método de pago */}
                <View style={styles.bloqueSeccion}>
                  <Text style={styles.bloqueLabel}>Método de pago *</Text>
                  <View style={styles.metodosContainer}>
                    {METODOS_PAGO.map((m) => {
                      const activo = metodoPago === m.value;
                      return (
                        <TouchableOpacity
                          key={m.value}
                          style={[
                            styles.metodoOpcion,
                            activo && styles.metodoOpcionActiva,
                          ]}
                          onPress={() => handleSeleccionarMetodo(m.value)}
                          disabled={loading}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.radioExterno, activo && styles.radioExternoActivo]}>
                            {activo && <View style={styles.radioInterno} />}
                          </View>
                          <Text style={[styles.metodoTexto, activo && styles.metodoTextoActivo]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Bloque efectivo: monto recibido + vuelto */}
                {requiereEfectivo(metodoPago) && (
                  <View style={styles.bloqueEfectivo}>
                    <View style={styles.inputContainer}>
                      <MaterialCommunityIcons
                        name="cash"
                        size={20}
                        color={theme.colors?.primary || "#667eea"}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: "#333333", fontSize: 16 }]}
                        placeholder={`Con cuánto pagará (${simboloMoneda(monedaSeleccionada)})`}
                        value={montoRecibidoStr}
                        onChangeText={setMontoRecibidoStr}
                        keyboardType="decimal-pad"
                        placeholderTextColor="#999999"
                        returnKeyType="done"
                      />
                    </View>
                    {totalEnMoneda != null && (
                      <View style={styles.vueltoContainer}>
                        <Text style={styles.vueltoLabel}>Vuelto:</Text>
                        <Text style={styles.vueltoValue}>
                          {formatearMontoConMoneda(vueltoPreview ?? 0, monedaSeleccionada, decimales)}
                        </Text>
                      </View>
                    )}
                    {!validacionEfectivo.ok && (
                      <Text style={styles.errorInline}>{validacionEfectivo.mensaje}</Text>
                    )}
                  </View>
                )}

                {/* Separador */}
                <View style={styles.separadorSecciones} />

                {/* Checkbox para Invitado */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => {
                    setEsInvitado(true);
                    setDni("");
                    setNombre("");
                    setTelefono("");
                  }}
                >
                  <View style={[styles.checkbox, esInvitado && styles.checkboxChecked]}>
                    {esInvitado && (
                      <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Continuar como Invitado (se generará automáticamente)
                  </Text>
                </TouchableOpacity>

                {/* Formulario opcional de cliente */}
                <View style={styles.formContainer}>
                  <Text style={styles.formTitle}>Registrar datos del cliente:</Text>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="account"
                      size={20}
                      color={theme.colors?.primary || "#667eea"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: "#333333", fontSize: 16 }]}
                      placeholder="Nombre (opcional)"
                      value={nombre}
                      onChangeText={(text) => {
                        setNombre(text);
                        if (text) setEsInvitado(false);
                      }}
                      placeholderTextColor="#999999"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="card-account-details"
                      size={20}
                      color={theme.colors?.primary || "#667eea"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: "#333333", fontSize: 16 }]}
                      placeholder="DNI (opcional)"
                      value={dni}
                      onChangeText={(text) => {
                        setDni(text);
                        if (text) setEsInvitado(false);
                      }}
                      keyboardType="numeric"
                      placeholderTextColor="#999999"
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="phone"
                      size={20}
                      color={colors.danger}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: "#333333", fontSize: 16 }]}
                      placeholder="Teléfono (opcional)"
                      value={telefono}
                      onChangeText={(text) => {
                        setTelefono(text);
                        if (text) setEsInvitado(false);
                      }}
                      keyboardType="phone-pad"
                      placeholderTextColor="#999999"
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { flexDirection: 'row', gap: 12 * escala, justifyContent: 'space-evenly' }]}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleCancelar();
                }}
                disabled={loading}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <View style={[styles.buttonNew, { minHeight: 52 * escala, backgroundColor: theme.colors?.background?.light || "#f5f5f5" }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * escala }}>
                    <MaterialCommunityIcons name="close-circle" size={24 * escala} color="#333333" />
                    <Text style={{ color: '#333333', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false }} numberOfLines={1}>
                      Cancelar
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleContinuar();
                }}
                disabled={loading || !puedeContinuar}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <View
                  style={[
                    styles.buttonNew,
                    { minHeight: 52 * escala, backgroundColor: colors.success },
                    (loading || !puedeContinuar) && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * escala }}>
                      <MaterialCommunityIcons name="check-circle" size={24 * escala} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 16 * escala, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }} numberOfLines={1}>
                        Continuar
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const modalStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalOverlayContent: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "95%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333333",
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  modalBody: {
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  // Total a cobrar
  totalCobroContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0F4FF",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors?.primary ? `${theme.colors.primary}33` : "#667eea33",
  },
  totalCobroLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333333",
  },
  totalCobroValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors?.primary || "#667eea",
  },
  // Bloques genéricos
  bloqueSeccion: {
    marginBottom: 16,
  },
  bloqueLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 10,
  },
  separadorSecciones: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 14,
  },
  // Toggle moneda
  toggleMonedaContainer: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    padding: 4,
  },
  toggleMonedaOpcion: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleMonedaOpcionActiva: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleMonedaOpcionDisabled: {
    opacity: 0.45,
  },
  toggleMonedaTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
  },
  toggleMonedaTextoActivo: {
    color: theme.colors?.primary || "#667eea",
  },
  toggleMonedaTextoDisabled: {
    color: "#999999",
  },
  notaMoneda: {
    fontSize: 12,
    color: "#888888",
    marginTop: 8,
    fontStyle: "italic",
  },
  // Métodos de pago
  metodosContainer: {
    flexDirection: "column",
    gap: 8,
  },
  metodoOpcion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1.5,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  metodoOpcionActiva: {
    borderColor: theme.colors?.primary || "#667eea",
    backgroundColor: "#F0F4FF",
  },
  radioExterno: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioExternoActivo: {
    borderColor: theme.colors?.primary || "#667eea",
  },
  radioInterno: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors?.primary || "#667eea",
  },
  metodoTexto: {
    fontSize: 15,
    color: "#333333",
    fontWeight: "500",
  },
  metodoTextoActivo: {
    fontWeight: "700",
    color: theme.colors?.primary || "#667eea",
  },
  // Bloque efectivo
  bloqueEfectivo: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  vueltoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  vueltoLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333333",
  },
  vueltoValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.success,
  },
  errorInline: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
    fontWeight: "500",
  },
  // Cliente
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors?.primary || "#667eea",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.colors?.primary || "#667eea",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333333",
    flex: 1,
  },
  formContainer: {
    marginTop: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333333",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  buttonNew: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default ModalClientes;
