import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { themeLight } from "../constants/theme";

/**
 * Modal para seleccionar complementos/variantes de un plato
 * @param {boolean} visible - Si el modal está visible
 * @param {object} plato - El plato que se está agregando
 * @param {function} onConfirm - Callback cuando se confirman los complementos
 * @param {function} onClose - Callback para cerrar el modal sin guardar
 */
const ModalComplementos = ({ visible, plato, onConfirm, onClose }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = modalComplementosStyles(theme);

  // Estado local para las selecciones del mozo
  const [selecciones, setSelecciones] = useState({}); // { "Proteína": "Pollo", "Guarnición": "Con ensalada" }
  const [seleccionesMultiples, setSeleccionesMultiples] = useState({}); // Para grupos con selección múltiple
  const [notaEspecial, setNotaEspecial] = useState("");

  // Los complementos del plato (array de grupos)
  const complementos = plato?.complementos || [];

  // Verificar si todos los grupos obligatorios tienen selección
  const obligatoriosCompletos = useMemo(() => {
    return complementos
      .filter((c) => c.obligatorio)
      .every((c) => {
        if (c.seleccionMultiple) {
          const seleccionados = seleccionesMultiples[c.grupo] || [];
          return seleccionados.length > 0;
        }
        return selecciones[c.grupo] !== undefined;
      });
  }, [complementos, selecciones, seleccionesMultiples]);

  // Manejar selección de opción única (chips tipo radio)
  const handleSeleccionUnica = (grupo, opcion) => {
    setSelecciones((prev) => ({
      ...prev,
      [grupo]: opcion,
    }));
  };

  // Manejar selección múltiple (chips tipo checkbox)
  const handleSeleccionMultiple = (grupo, opcion) => {
    setSeleccionesMultiples((prev) => {
      const actuales = prev[grupo] || [];
      const yaSeleccionado = actuales.includes(opcion);

      if (yaSeleccionado) {
        // Quitar selección
        return {
          ...prev,
          [grupo]: actuales.filter((o) => o !== opcion),
        };
      } else {
        // Agregar selección
        return {
          ...prev,
          [grupo]: [...actuales, opcion],
        };
      }
    });
  };

  // Confirmar y agregar el plato con complementos
  const handleConfirmar = () => {
    if (!obligatoriosCompletos) return;

    // Construir array de complementos seleccionados
    const complementosSeleccionados = [];

    complementos.forEach((c) => {
      if (c.seleccionMultiple) {
        const opcionesSeleccionadas = seleccionesMultiples[c.grupo] || [];
        opcionesSeleccionadas.forEach((opcion) => {
          complementosSeleccionados.push({
            grupo: c.grupo,
            opcion: opcion,
          });
        });
      } else if (selecciones[c.grupo]) {
        complementosSeleccionados.push({
          grupo: c.grupo,
          opcion: selecciones[c.grupo],
        });
      }
    });

    // Llamar al callback con los datos
    onConfirm({
      complementosSeleccionados,
      notaEspecial: notaEspecial.trim(),
    });

    // Resetear estado local
    setSelecciones({});
    setSeleccionesMultiples({});
    setNotaEspecial("");
  };

  // Cerrar sin guardar
  const handleCancelar = () => {
    setSelecciones({});
    setSeleccionesMultiples({});
    setNotaEspecial("");
    onClose();
  };

  // Si no hay plato o no tiene complementos, no mostrar nada
  if (!plato || complementos.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancelar}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header con nombre del plato */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleContainer}>
              <MaterialCommunityIcons
                name="food"
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.modalTitle} numberOfLines={2}>
                {plato.nombre}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancelar} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Grupos de complementos */}
            {complementos.map((complemento, index) => (
              <View key={index} style={styles.grupoContainer}>
                <View style={styles.grupoHeader}>
                  <Text style={styles.grupoTitle}>{complemento.grupo}</Text>
                  {complemento.obligatorio && (
                    <View style={styles.requeridoBadge}>
                      <Text style={styles.requeridoBadgeText}>Requerido</Text>
                    </View>
                  )}
                  {complemento.seleccionMultiple && (
                    <Text style={styles.seleccionMultipleHint}>
                      (puedes elegir varios)
                    </Text>
                  )}
                </View>

                {/* Chips de opciones */}
                <View style={styles.opcionesContainer}>
                  {complemento.opciones.map((opcion, optIndex) => {
                    let isSelected = false;

                    if (complemento.seleccionMultiple) {
                      const seleccionados =
                        seleccionesMultiples[complemento.grupo] || [];
                      isSelected = seleccionados.includes(opcion);
                    } else {
                      isSelected = selecciones[complemento.grupo] === opcion;
                    }

                    return (
                      <TouchableOpacity
                        key={optIndex}
                        style={[
                          styles.opcionChip,
                          isSelected && styles.opcionChipSelected,
                        ]}
                        onPress={() => {
                          if (complemento.seleccionMultiple) {
                            handleSeleccionMultiple(complemento.grupo, opcion);
                          } else {
                            handleSeleccionUnica(complemento.grupo, opcion);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        {complemento.seleccionMultiple && (
                          <MaterialCommunityIcons
                            name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                            size={18}
                            color={
                              isSelected
                                ? theme.colors.text.white
                                : theme.colors.text.secondary
                            }
                            style={styles.checkboxIcon}
                          />
                        )}
                        <Text
                          style={[
                            styles.opcionText,
                            isSelected && styles.opcionTextSelected,
                          ]}
                        >
                          {opcion}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Campo de nota especial */}
            <View style={styles.notaContainer}>
              <Text style={styles.notaLabel}>Nota especial (opcional)</Text>
              <TextInput
                style={styles.notaInput}
                placeholder="Ej: Sin sal, extra limón..."
                placeholderTextColor={theme.colors.text.light}
                value={notaEspecial}
                onChangeText={setNotaEspecial}
                multiline
                numberOfLines={2}
                maxLength={200}
              />
            </View>
          </ScrollView>

          {/* Footer con botones */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelar}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={theme.colors.text.secondary}
              />
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                !obligatoriosCompletos && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmar}
              disabled={!obligatoriosCompletos}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="check"
                size={20}
                color={theme.colors.text.white}
              />
              <Text style={styles.confirmButtonText}>Agregar a la orden</Text>
            </TouchableOpacity>
          </View>

          {/* Mensaje si faltan obligatorios */}
          {!obligatoriosCompletos && (
            <View style={styles.warningContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color={theme.colors.warning}
              />
              <Text style={styles.warningText}>
                Selecciona las opciones requeridas
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const modalComplementosStyles = (theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      maxHeight: "85%",
      paddingBottom: 24,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: theme.spacing.sm,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text.primary,
      flex: 1,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    modalScrollView: {
      maxHeight: 450,
    },
    modalScrollContent: {
      padding: theme.spacing.lg,
    },
    grupoContainer: {
      marginBottom: theme.spacing.lg,
    },
    grupoHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    grupoTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    requeridoBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: 12,
    },
    requeridoBadgeText: {
      color: theme.colors.text.white,
      fontSize: 11,
      fontWeight: "600",
    },
    seleccionMultipleHint: {
      fontSize: 12,
      color: theme.colors.text.light,
      fontStyle: "italic",
    },
    opcionesContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    opcionChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: theme.colors.border,
      minHeight: 44, // Accesibilidad: mínimo 44pt para toque fácil
    },
    opcionChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxIcon: {
      marginRight: theme.spacing.xs,
    },
    opcionText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text.primary,
    },
    opcionTextSelected: {
      color: theme.colors.text.white,
      fontWeight: "600",
    },
    notaContainer: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    notaLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    notaInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: 14,
      color: theme.colors.text.primary,
      minHeight: 60,
      textAlignVertical: "top",
    },
    modalFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing.md,
    },
    cancelButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      borderColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text.secondary,
    },
    confirmButton: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.xs,
      ...theme.shadows.medium,
    },
    confirmButtonDisabled: {
      backgroundColor: theme.colors.text.light,
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text.white,
    },
    warningContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.warning + "20",
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.xs,
    },
    warningText: {
      fontSize: 12,
      color: theme.colors.warning,
      fontWeight: "500",
    },
  });

export default ModalComplementos;
