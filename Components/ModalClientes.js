import React, { useState } from "react";
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

const ModalClientes = ({ visible, onClose, onClienteSeleccionado }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || {};
  const styles = modalStyles(theme);
  const { width } = useWindowDimensions();
  const escala = width < 390 ? 0.88 : 1;

  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [esInvitado, setEsInvitado] = useState(true); // Por defecto invitado
  const [loading, setLoading] = useState(false);

  const handleContinuar = async () => {
    setLoading(true);
    try {
      let clienteData = null;

      // Usar apiConfig para obtener la URL dinámica
      const clientesURL = apiConfig.isConfigured 
        ? apiConfig.getEndpoint('/clientes')
        : CLIENTES_API;

      // Si está marcado como invitado o no hay ningún dato, crear invitado
      if (esInvitado || (!dni && !nombre && !telefono)) {
        // Crear cliente invitado automáticamente
        console.log("🆕 Creando cliente invitado automático...");
        const response = await axios.post(clientesURL, {}, { 
          timeout: 10000, // Aumentado de 5000 a 10000ms
          validateStatus: (status) => status < 500 // Aceptar errores 4xx sin lanzar excepción
        });
        clienteData = response.data;
        console.log("✅ Cliente invitado creado:", clienteData.nombre);
      } else {
        // Crear cliente registrado con los datos proporcionados
        const datosCliente = {};
        
        // Lógica: Si solo hay DNI, nombre = "Invitado" y sin teléfono
        if (dni && !nombre && !telefono) {
          datosCliente.dni = dni.trim();
          datosCliente.nombre = "Invitado";
          // No se asigna teléfono
        }
        // Si solo hay Nombre, no hay DNI ni teléfono
        else if (nombre && !dni && !telefono) {
          datosCliente.nombre = nombre.trim();
          // No se asigna DNI ni teléfono
        }
        // Si hay cualquier combinación de campos, usar los que estén llenos
        else {
          if (dni && dni.trim()) datosCliente.dni = dni.trim();
          if (nombre && nombre.trim()) datosCliente.nombre = nombre.trim();
          if (telefono && telefono.trim()) datosCliente.telefono = telefono.trim();
        }

        console.log("📝 Creando cliente registrado con datos:", datosCliente);
        const response = await axios.post(clientesURL, datosCliente, { 
          timeout: 10000, // Aumentado de 5000 a 10000ms
          validateStatus: (status) => status < 500 // Aceptar errores 4xx sin lanzar excepción
        });
        clienteData = response.data;
        console.log("✅ Cliente registrado creado:", clienteData.nombre);
      }

      // Llamar callback con el cliente seleccionado
      onClienteSeleccionado(clienteData);

      // Limpiar formulario
      setDni("");
      setNombre("");
      setTelefono("");
      setEsInvitado(true);
      
      // ✅ Resetear loading después de éxito
      setLoading(false);
    } catch (error) {
      console.error("❌ Error al crear cliente:", error);
      
      // ✅ SIEMPRE resetear loading en caso de error
      setLoading(false);
      
      // Manejo mejorado de errores de red
      const isNetworkError = error.code === 'ECONNABORTED' || 
                             error.code === 'ECONNREFUSED' ||
                             error.message?.includes('Network Error') ||
                             error.message?.includes('timeout') ||
                             !error.response;
      
      if (isNetworkError) {
        Alert.alert(
          "Error de Conexión",
          "No se pudo crear el cliente debido a un error de red. Por favor, verifica tu conexión e intenta nuevamente.",
          [
            { 
              text: "Reintentar", 
              onPress: () => {
                // Pequeño delay antes de reintentar para evitar loop infinito
                setTimeout(() => handleContinuar(), 500);
              }
            },
            { 
              text: "Cancelar", 
              style: "cancel"
            }
          ]
        );
      } else {
        // Error del servidor (no de red)
        const status = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message || "Error desconocido";
        Alert.alert(
          "Error",
          `No se pudo crear el cliente (Error ${status}): ${errorMessage}`
        );
      }
    } finally {
      // ✅ GARANTIZAR que el loading siempre se resetee (doble seguridad)
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    setDni("");
    setNombre("");
    setTelefono("");
    setEsInvitado(true);
    onClose();
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
              <Text style={styles.modalTitle}>Información del Cliente</Text>
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

                {/* Formulario opcional */}
                <View style={styles.formContainer}>
                  <Text style={styles.formTitle}>Registrar datos del cliente:</Text>

                  {/* Nombre primero */}
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

                  {/* DNI segundo */}
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

                  {/* Teléfono tercero */}
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
                disabled={loading}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <View style={[styles.buttonNew, { minHeight: 52 * escala, backgroundColor: colors.success }, loading && styles.buttonDisabled]}>
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
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors?.text?.light || "#666",
    marginBottom: 20,
    textAlign: "center",
  },
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
  button: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    overflow: 'visible',
    minHeight: 48,
    marginHorizontal: 5,
  },
  buttonCancel: {
    backgroundColor: theme.colors?.background?.light || "#f5f5f5",
  },
  buttonCancelText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 0,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 1,
  },
  buttonContinue: {
    backgroundColor: theme.colors?.primary || "#667eea",
  },
  buttonContinueText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    flexShrink: 0,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
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
    opacity: 0.6,
  },
});

export default ModalClientes;

