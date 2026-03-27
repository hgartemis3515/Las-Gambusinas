/**
 * ModalRegistrarPropina.js
 * Componente modal para registrar propinas después del pago
 * 
 * @version 1.0
 * @description Permite al mozo registrar propinas por mesa después de generar el boucher
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { colors } from "../../../constants/colors";
import { PROPINAS_API } from "../../../apiConfig";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";

// Presets rápidos de propina
const PRESETS_MONTO = [5, 10, 15, 20];
const PRESETS_PORCENTAJE = [10, 15, 20];

const ModalRegistrarPropina = ({
  visible,
  onClose,
  boucherData,
  mesaData,
  mozoData,
  onPropinaRegistrada,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;

  // Estados
  const [tipoPropina, setTipoPropina] = useState("monto"); // "monto" | "porcentaje" | "ninguna"
  const [montoFijo, setMontoFijo] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);
  const [propinaCalculada, setPropinaCalculada] = useState(0);
  const idempotencyKeyRef = useRef(null);

  // Animaciones
  const scaleAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scaleAnim.value = withSpring(1, { damping: 12, stiffness: 100 });
      fadeAnim.value = withTiming(1, { duration: 200 });
      idempotencyKeyRef.current = null;
      // Resetear estados
      setTipoPropina("monto");
      setMontoFijo("");
      setPorcentaje("");
      setNota("");
      setPropinaCalculada(0);
    } else {
      scaleAnim.value = 0;
      fadeAnim.value = 0;
    }
  }, [visible]);

  // Calcular propina cuando cambian los valores
  useEffect(() => {
    const totalBoucher = boucherData?.total || boucherData?.totalConDescuento || 0;
    
    if (tipoPropina === "monto") {
      const monto = parseFloat(montoFijo) || 0;
      setPropinaCalculada(monto);
    } else if (tipoPropina === "porcentaje") {
      const pct = parseFloat(porcentaje) || 0;
      const calculado = (totalBoucher * pct) / 100;
      setPropinaCalculada(Math.round(calculado * 100) / 100);
    } else {
      setPropinaCalculada(0);
    }
  }, [tipoPropina, montoFijo, porcentaje, boucherData]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: fadeAnim.value,
  }));

  const handlePresetMonto = (valor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMontoFijo(valor.toString());
    setTipoPropina("monto");
  };

  const handlePresetPorcentaje = (valor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPorcentaje(valor.toString());
    setTipoPropina("porcentaje");
  };

  const handleRegistrarPropina = async () => {
    if (propinaCalculada <= 0 && tipoPropina !== "ninguna") {
      Alert.alert("Error", "Ingrese un monto o porcentaje válido");
      return;
    }

    if (!boucherData?._id) {
      Alert.alert("Error", "No hay boucher asociado");
      return;
    }

    if (!mesaData?._id) {
      Alert.alert("Error", "No hay mesa asociada");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `propina-boucher-${boucherData._id}-${Date.now()}`;
      }

      const propinaPayload = {
        mesaId: mesaData._id,
        boucherId: boucherData._id,
        mozoId: mozoData?._id || userId,
        tipo: tipoPropina === "ninguna" ? "ninguna" : tipoPropina,
        montoFijo: tipoPropina === "monto" ? parseFloat(montoFijo) || 0 : null,
        porcentaje: tipoPropina === "porcentaje" ? parseFloat(porcentaje) || 0 : null,
        nota: nota || null,
        registradoPor: userId,
      };

      const response = await axios.post(
        `${PROPINAS_API}`,
        propinaPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKeyRef.current,
          },
        }
      );

      if (response.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const montoServidor =
          response.data.data?.montoPropina != null
            ? Number(response.data.data.montoPropina)
            : propinaCalculada;
        const textoMonto = Number.isFinite(montoServidor)
          ? montoServidor.toFixed(2)
          : propinaCalculada.toFixed(2);
        Alert.alert(
          "✅ Propina Registrada",
          tipoPropina === "ninguna"
            ? "Registrado como sin propina."
            : `Propina de S/ ${textoMonto} registrada exitosamente`,
          [
            {
              text: "OK",
              onPress: () => {
                if (onPropinaRegistrada) {
                  onPropinaRegistrada(response.data.data);
                }
                onClose();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error al registrar propina:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "No se pudo registrar la propina"
      );
    } finally {
      setLoading(false);
    }
  };

  const totalBoucher = boucherData?.total || boucherData?.totalConDescuento || 0;
  const simboloMoneda = boucherData?.configuracionIGV?.simboloMoneda || "S/";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View style={[styles.modalContainer, animatedStyle]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name="cash-multiple" size={32} color={colors.success} />
              </View>
              <Text style={styles.headerTitle}>Registrar Propina</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Info del boucher */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mesa:</Text>
                  <Text style={styles.infoValue}>#{mesaData?.nummesa || mesaData?.numMesa || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Boucher:</Text>
                  <Text style={styles.infoValue}>#{boucherData?.boucherNumber || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total:</Text>
                  <Text style={[styles.infoValue, { color: colors.primary, fontWeight: "700" }]}>
                    {simboloMoneda} {totalBoucher.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Tipo de propina */}
              <Text style={styles.sectionTitle}>Tipo de Propina</Text>
              <View style={styles.tipoContainer}>
                <TouchableOpacity
                  style={[styles.tipoButton, tipoPropina === "monto" && styles.tipoButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTipoPropina("monto");
                  }}
                >
                  <MaterialCommunityIcons
                    name="cash"
                    size={20}
                    color={tipoPropina === "monto" ? "#FFF" : colors.primary}
                  />
                  <Text style={[styles.tipoText, tipoPropina === "monto" && styles.tipoTextActive]}>
                    Monto Fijo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tipoButton, tipoPropina === "porcentaje" && styles.tipoButtonActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTipoPropina("porcentaje");
                  }}
                >
                  <MaterialCommunityIcons
                    name="percent"
                    size={20}
                    color={tipoPropina === "porcentaje" ? "#FFF" : colors.primary}
                  />
                  <Text style={[styles.tipoText, tipoPropina === "porcentaje" && styles.tipoTextActive]}>
                    Porcentaje
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tipoButton, tipoPropina === "ninguna" && styles.tipoButtonActiveGray]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTipoPropina("ninguna");
                  }}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={tipoPropina === "ninguna" ? "#FFF" : "#999"}
                  />
                  <Text style={[styles.tipoText, tipoPropina === "ninguna" && styles.tipoTextActive]}>
                    Sin propina
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Input monto fijo */}
              {tipoPropina === "monto" && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Monto de la propina</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencySymbol}>{simboloMoneda}</Text>
                    <TextInput
                      style={styles.input}
                      value={montoFijo}
                      onChangeText={setMontoFijo}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#999"
                    />
                  </View>
                  {/* Presets monto */}
                  <View style={styles.presetsContainer}>
                    {PRESETS_MONTO.map((valor) => (
                      <TouchableOpacity
                        key={`monto-${valor}`}
                        style={styles.presetButton}
                        onPress={() => handlePresetMonto(valor)}
                      >
                        <Text style={styles.presetText}>{simboloMoneda} {valor}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Input porcentaje */}
              {tipoPropina === "porcentaje" && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Porcentaje sobre el total</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      value={porcentaje}
                      onChangeText={setPorcentaje}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                  {/* Presets porcentaje */}
                  <View style={styles.presetsContainer}>
                    {PRESETS_PORCENTAJE.map((valor) => (
                      <TouchableOpacity
                        key={`pct-${valor}`}
                        style={styles.presetButton}
                        onPress={() => handlePresetPorcentaje(valor)}
                      >
                        <Text style={styles.presetText}>{valor}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Cálculo */}
                  {porcentaje && (
                    <Text style={styles.calculoText}>
                      {porcentaje}% de {simboloMoneda} {totalBoucher.toFixed(2)} = {simboloMoneda} {propinaCalculada.toFixed(2)}
                    </Text>
                  )}
                </View>
              )}

              {/* Nota opcional */}
              {tipoPropina !== "ninguna" && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Nota (opcional)</Text>
                  <TextInput
                    style={[styles.input, styles.notaInput]}
                    value={nota}
                    onChangeText={setNota}
                    placeholder="Ej: Cliente generoso..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={2}
                    maxLength={200}
                  />
                </View>
              )}

              {/* Resumen */}
              {tipoPropina !== "ninguna" && (
                <View style={styles.resumenCard}>
                  <Text style={styles.resumenLabel}>Propina a registrar:</Text>
                  <Text style={styles.resumenValue}>
                    {simboloMoneda} {propinaCalculada.toFixed(2)}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Botones */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleRegistrarPropina}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFF" />
                    <Text style={styles.confirmButtonText}>
                      {tipoPropina === "ninguna" ? "Sin Propina" : `Guardar ${simboloMoneda} ${propinaCalculada.toFixed(2)}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    width: "90%",
    maxWidth: 400,
    maxHeight: "85%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    backgroundColor: "#FAFAFA",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  tipoContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  tipoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "#FFF",
    gap: 6,
  },
  tipoButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tipoButtonActiveGray: {
    backgroundColor: "#999",
    borderColor: "#999",
  },
  tipoText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  tipoTextActive: {
    color: "#FFF",
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#DDD",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    paddingVertical: 14,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginRight: 8,
  },
  percentSymbol: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginLeft: 8,
  },
  presetsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  presetText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  calculoText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  notaInput: {
    height: 60,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  resumenCard: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  resumenLabel: {
    fontSize: 16,
    color: "#FFF",
    fontWeight: "600",
  },
  resumenValue: {
    fontSize: 24,
    color: "#FFF",
    fontWeight: "700",
  },
  buttonsContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    flex: 1.5,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ModalRegistrarPropina;
