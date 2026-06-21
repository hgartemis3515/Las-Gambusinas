/**
 * ModalPagoExitoso.js
 * Componente modal para mostrar opciones después de un pago exitoso
 * 
 * @version 1.3
 * @description Muestra opciones: Registrar Propina, Compartir, Ir al inicio
 *              Botón X superior derecho para cerrar y seguir cobrando (pagos parciales)
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../context/ThemeContext";
import { themeLight } from "../../../constants/theme";
import { colors } from "../../../constants/colors";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";

const ModalPagoExitoso = ({
  visible,
  onClose,
  boucherData,
  mesaData,
  clienteData,
  onImprimir,
  onRegistrarPropina,
  onIrAlInicio,
  // BUG_PAGOS_PARCIALES_APROBACION_COCINA (Fase 5):
  // Modo pago parcial: cambia título/mensaje y muestra "Seguir cobrando".
  esPagoParcial = false,
  // cobroCompleto = true cuando ya no quedan platos por cobrar (pero faltan aprobaciones).
  cobroCompleto = false,
  onSeguirCobrando,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const { width, height } = useWindowDimensions();
  
  // Detectar orientación
  const isLandscape = width > height;
  const isSmallScreen = width < 380;

  // Animaciones - Todos los hooks en el nivel superior
  const scaleAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(0);
  const checkAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

  // Animaciones de los botones (staggered) - Siempre crear los 4 hooks
  const buttonAnim0 = useSharedValue(0);
  const buttonAnim1 = useSharedValue(0);
  const buttonAnim2 = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Animación de entrada
      scaleAnim.value = withSpring(1, { damping: 12, stiffness: 100 });
      fadeAnim.value = withTiming(1, { duration: 200 });
      checkAnim.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(100, withSpring(1, { damping: 8, stiffness: 200 }))
      );
      slideAnim.value = withSequence(
        withTiming(50, { duration: 0 }),
        withDelay(150, withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) }))
      );

      // Animar botones con delay escalonado
      buttonAnim0.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }))
      );
      buttonAnim1.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(280, withSpring(1, { damping: 12, stiffness: 100 }))
      );
      buttonAnim2.value = withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(360, withSpring(1, { damping: 12, stiffness: 100 }))
      );
    } else {
      scaleAnim.value = 0;
      fadeAnim.value = 0;
      checkAnim.value = 0;
      slideAnim.value = 50;
      buttonAnim0.value = 0;
      buttonAnim1.value = 0;
      buttonAnim2.value = 0;
    }
  }, [visible]);

  // Estilos animados - Todos en el nivel superior
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: fadeAnim.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkAnim.value }],
    opacity: checkAnim.value,
  }));

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
    opacity: fadeAnim.value,
  }));

  const buttonStyle0 = useAnimatedStyle(() => ({
    transform: [{ scale: buttonAnim0.value }],
    opacity: buttonAnim0.value,
  }));

  const buttonStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: buttonAnim1.value }],
    opacity: buttonAnim1.value,
  }));

  const buttonStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: buttonAnim2.value }],
    opacity: buttonAnim2.value,
  }));

  const handleImprimirComanda = async () => {
    if (!onImprimir) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onImprimir();
    } catch (error) {
      console.error("Error imprimiendo comanda:", error);
    }
  };

  const handlePropina = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRegistrarPropina?.();
  };

  const handleIrAlInicio = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIrAlInicio?.();
  };

  const handleCerrar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose?.();
  };

  const handleSeguirCobrando = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSeguirCobrando?.();
  };

  const simboloMoneda = boucherData?.configuracionIGV?.simboloMoneda || "S/";
  const totalBoucher = boucherData?.total || boucherData?.totalConDescuento || 0;

  // BUG_PAGOS_PARCIALES_APROBACION_COCINA (Fase 5): título y subtítulo según tipo de cobro
  const tituloModal = esPagoParcial
    ? (cobroCompleto ? "Cobro Completado" : "Pago Parcial Registrado")
    : "¡Pago Exitoso!";
  const subtituloModal = esPagoParcial
    ? (cobroCompleto
        ? "Se cobró todo el pedido. Esperando aprobación de cocina de los envíos restantes para liberar la mesa."
        : "Los platos seleccionados fueron enviados a cocina. Puede seguir cobrando el resto cuando quiera.")
    : null;

  // Opciones del modal - PLAN_PLANTILLA_COMANDAS: "Imprimir comanda" en lugar de "Compartir boucher"
  // BUG_PAGOS_PARCIALES_APROBACION_COCINA (Fase 5): "Seguir cobrando" en pagos parciales.
  const opciones = [
    {
      id: "seguir_cobrando",
      icon: "cart-plus",
      label: "Seguir cobrando",
      color: "#16A34A",
      onPress: handleSeguirCobrando,
      // Visible solo en pago parcial cuando aún quedan platos por cobrar
      visible: !!onSeguirCobrando && esPagoParcial && !cobroCompleto,
      style: buttonStyle0,
    },
    {
      id: "propina",
      icon: "cash-plus",
      label: "Propina",
      color: colors.success || "#22C55E",
      onPress: handlePropina,
      visible: true,
      style: buttonStyle0,
    },
    {
      id: "comanda",
      icon: "printer",
      label: "Imprimir Comanda",
      color: "#2563EB",
      onPress: handleImprimirComanda,
      visible: !!onImprimir,
      style: buttonStyle1,
    },
    {
      id: "inicio",
      icon: "home",
      label: "Inicio",
      color: "#6B7280",
      onPress: handleIrAlInicio,
      visible: true,
      style: buttonStyle2,
    },
  ];

  const opcionesVisibles = opciones.filter(op => op.visible);

  // Estilos dinámicos basados en orientación
  const dynamicStyles = {
    modalContainer: {
      maxWidth: isLandscape ? height * 0.9 : width * 0.92,
      maxHeight: isLandscape ? height * 0.85 : height * 0.75,
    },
    headerPadding: isLandscape ? 16 : 24,
    iconSize: isLandscape ? 56 : 68,
    buttonLayout: isLandscape ? 'row' : 'column',
    buttonFlex: isLandscape ? 1 : 0,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[
          styles.modalContainer, 
          modalAnimatedStyle,
          dynamicStyles.modalContainer
        ]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCerrar}
            activeOpacity={0.7}
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          {/* Header compacto */}
          <View style={[styles.headerContainer, { paddingTop: dynamicStyles.headerPadding, paddingBottom: dynamicStyles.headerPadding }]}>
            <Animated.View style={[styles.successCircle, checkAnimatedStyle]}>
              <MaterialCommunityIcons
                name="check-circle"
                size={dynamicStyles.iconSize}
                color={colors.success || "#22C55E"}
              />
            </Animated.View>
            <Animated.View style={slideAnimatedStyle}>
              <Text style={styles.title}>{tituloModal}</Text>
              {subtituloModal ? (
                <Text style={styles.subtitle}>{subtituloModal}</Text>
              ) : null}
            </Animated.View>
          </View>

          {/* Info del boucher compacta */}
          <Animated.View style={[styles.infoContainer, slideAnimatedStyle]}>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="table-furniture" size={16} color="#666" />
                <Text style={styles.infoLabel}>Mesa:</Text>
                <Text style={styles.infoValue}>#{mesaData?.nummesa || mesaData?.numMesa || "-"}</Text>
                <View style={styles.separator} />
                <MaterialCommunityIcons name="receipt" size={16} color="#666" />
                <Text style={styles.infoLabel}>Comanda:</Text>
                <Text style={styles.infoValue}>#{boucherData?.boucherNumber || boucherData?.voucherId || "-"}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account" size={16} color="#666" />
                <Text style={styles.infoLabel}>Cliente:</Text>
                <Text style={styles.infoValue}>{clienteData?.nombre || clienteData?.name || "Cliente"}</Text>
                <View style={styles.separator} />
                <Text style={[styles.totalValue, { marginLeft: 'auto' }]}>
                  {simboloMoneda} {totalBoucher.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Opciones - Horizontal en landscape, vertical en portrait */}
          <View style={[
            styles.opcionesContainer, 
            { flexDirection: dynamicStyles.buttonLayout }
          ]}>
            {opcionesVisibles.map((opcion, index) => (
              <Animated.View
                key={opcion.id}
                style={[
                  opcion.style, 
                  { flex: dynamicStyles.buttonFlex }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.opcionButton, 
                    { borderColor: opcion.color },
                    isLandscape && styles.opcionButtonLandscape
                  ]}
                  onPress={opcion.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opcionIconContainer, { backgroundColor: opcion.color + "20" }]}>
                    <MaterialCommunityIcons
                      name={opcion.icon}
                      size={isLandscape ? 22 : 26}
                      color={opcion.color}
                    />
                  </View>
                  <Text style={[styles.opcionLabel, { color: opcion.color }]}>
                    {opcion.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    width: "100%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  successCircle: {
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  infoContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  infoCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  separator: {
    width: 12,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  opcionesContainer: {
    padding: 12,
    gap: 10,
  },
  opcionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: "#FAFAFA",
  },
  opcionButtonLandscape: {
    flex: 1,
    justifyContent: "center",
    padding: 10,
  },
  opcionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  opcionLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
});

export default ModalPagoExitoso;
