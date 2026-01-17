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
import axios from "axios";
import { useTheme } from "../context/ThemeContext";

const CLIENTES_API = "http://192.168.18.11:3000/api/clientes";

const ModalClientes = ({ visible, onClose, onClienteSeleccionado }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || {};
  const styles = modalStyles(theme);

  const [dni, setDni] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [esInvitado, setEsInvitado] = useState(true); // Por defecto invitado
  const [loading, setLoading] = useState(false);

  const handleContinuar = async () => {
    setLoading(true);
    try {
      let clienteData = null;

      if (esInvitado || (!dni && !nombre && !telefono)) {
        // Crear cliente invitado automáticamente
        console.log("🆕 Creando cliente invitado automático...");
        const response = await axios.post(CLIENTES_API, {}, { timeout: 5000 });
        clienteData = response.data;
        console.log("✅ Cliente invitado creado:", clienteData.nombre);
      } else {
        // Crear cliente registrado con los datos proporcionados
        const datosCliente = {};
        if (dni) datosCliente.dni = dni;
        if (nombre) datosCliente.nombre = nombre;
        if (telefono) datosCliente.telefono = telefono;

        console.log("📝 Creando cliente registrado con datos:", datosCliente);
        const response = await axios.post(CLIENTES_API, datosCliente, { timeout: 5000 });
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
    } catch (error) {
      console.error("❌ Error al crear cliente:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "No se pudo crear el cliente. Intente nuevamente."
      );
    } finally {
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
                <MaterialCommunityIcons name="close" size={24} color={theme.colors?.text?.dark || "#333"} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>
                  Puede registrar datos del cliente o continuar como invitado
                </Text>

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
                  <Text style={styles.formTitle}>O registrar datos del cliente:</Text>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="card-account-details"
                      size={20}
                      color={theme.colors?.primary || "#667eea"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="DNI (opcional)"
                      value={dni}
                      onChangeText={(text) => {
                        setDni(text);
                        if (text) setEsInvitado(false);
                      }}
                      keyboardType="numeric"
                      placeholderTextColor={theme.colors?.text?.light || "#999"}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="account"
                      size={20}
                      color={theme.colors?.primary || "#667eea"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre (opcional)"
                      value={nombre}
                      onChangeText={(text) => {
                        setNombre(text);
                        if (text) setEsInvitado(false);
                      }}
                      placeholderTextColor={theme.colors?.text?.light || "#999"}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons
                      name="phone"
                      size={20}
                      color={theme.colors?.primary || "#667eea"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Teléfono (opcional)"
                      value={telefono}
                      onChangeText={(text) => {
                        setTelefono(text);
                        if (text) setEsInvitado(false);
                      }}
                      keyboardType="phone-pad"
                      placeholderTextColor={theme.colors?.text?.light || "#999"}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={handleCancelar}
                disabled={loading}
              >
                <Text style={styles.buttonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonContinue, loading && styles.buttonDisabled]}
                onPress={handleContinuar}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.buttonContinueText}>Continuar</Text>
                  </>
                )}
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
    maxHeight: "90%",
  },
  modalContent: {
    backgroundColor: theme.colors?.background?.white || "#fff",
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
    borderBottomColor: theme.colors?.border || "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors?.text?.dark || "#333",
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  modalBody: {
    padding: 20,
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
    backgroundColor: theme.colors?.background?.light || "#f5f5f5",
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
    color: theme.colors?.text?.dark || "#333",
    flex: 1,
  },
  formContainer: {
    marginTop: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors?.text?.dark || "#333",
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: theme.colors?.border || "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: theme.colors?.background?.white || "#fff",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: theme.colors?.text?.dark || "#333",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors?.border || "#e0e0e0",
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  buttonCancel: {
    backgroundColor: theme.colors?.background?.light || "#f5f5f5",
  },
  buttonCancelText: {
    color: theme.colors?.text?.dark || "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContinue: {
    backgroundColor: theme.colors?.primary || "#667eea",
  },
  buttonContinueText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ModalClientes;

