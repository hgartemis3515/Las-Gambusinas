import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { themeLight } from "../constants/theme";

/**
 * Modal para seleccionar complementos/variantes de un plato
 * v2.0 - Soporte para cantidades por opción
 * 
 * @param {boolean} visible - Si el modal está visible
 * @param {object} plato - El plato que se está agregando
 * @param {function} onConfirm - Callback cuando se confirman los complementos
 * @param {function} onClose - Callback para cerrar el modal sin guardar
 * @param {array} complementosIniciales - Complementos ya seleccionados (para edición)
 */
const ModalComplementos = ({ visible, plato, onConfirm, onClose, complementosIniciales = null }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = modalComplementosStyles(theme);

  // Estado local para las selecciones del mozo
  // Estructura: { "Proteína": { "Pollo": 2, "Res": 1 }, "Guarnición": { "Ensalada": 1 } }
  const [seleccionesPorGrupo, setSeleccionesPorGrupo] = useState({});
  const [notaEspecial, setNotaEspecial] = useState("");

  // Los complementos del plato (array de grupos)
  const complementos = plato?.complementos || [];

  // Normalizar grupo legacy al nuevo formato
  const normalizarGrupo = useCallback((grupo) => {
    if (grupo.modoSeleccion) return grupo; // Ya normalizado
    
    return {
      ...grupo,
      modoSeleccion: grupo.seleccionMultiple ? 'cantidades' : 'opciones',
      maxUnidadesGrupo: grupo.maxUnidadesGrupo ?? (grupo.seleccionMultiple ? null : 1),
      minUnidadesGrupo: grupo.minUnidadesGrupo ?? (grupo.obligatorio ? 1 : 0),
      maxUnidadesPorOpcion: grupo.maxUnidadesPorOpcion ?? (grupo.seleccionMultiple ? null : 1),
      permiteRepetirOpcion: grupo.permiteRepetirOpcion ?? grupo.seleccionMultiple,
      _esLegacy: true
    };
  }, []);

  // Inicializar selecciones desde complementosIniciales (para edición)
  useEffect(() => {
    if (visible) {
      if (complementosIniciales && Array.isArray(complementosIniciales)) {
        // Convertir array de complementos a estructura por grupo
        const nuevaSeleccion = {};
        complementosIniciales.forEach(comp => {
          if (!nuevaSeleccion[comp.grupo]) {
            nuevaSeleccion[comp.grupo] = {};
          }
          const cantidad = comp.cantidad || 1;
          nuevaSeleccion[comp.grupo][comp.opcion] = cantidad;
        });
        setSeleccionesPorGrupo(nuevaSeleccion);
      } else {
        // Limpiar para nuevo plato
        setSeleccionesPorGrupo({});
      }
      setNotaEspecial("");
    }
  }, [visible, complementosIniciales]);

  // Obtener cantidad actual de una opción
  const getCantidadOpcion = useCallback((grupoNombre, opcion) => {
    return seleccionesPorGrupo[grupoNombre]?.[opcion] || 0;
  }, [seleccionesPorGrupo]);

  // Obtener total de unidades en un grupo
  const getTotalUnidadesGrupo = useCallback((grupoNombre) => {
    const grupo = seleccionesPorGrupo[grupoNombre] || {};
    return Object.values(grupo).reduce((sum, cant) => sum + cant, 0);
  }, [seleccionesPorGrupo]);

  // Incrementar cantidad de una opción
  const incrementarOpcion = useCallback((grupoNombre, opcion, grupoNormalizado) => {
    const cantidadActual = getCantidadOpcion(grupoNombre, opcion);
    const totalActual = getTotalUnidadesGrupo(grupoNombre);
    
    // Validar límites
    const maxUnidadesGrupo = grupoNormalizado.maxUnidadesGrupo;
    const maxUnidadesPorOpcion = grupoNormalizado.maxUnidadesPorOpcion;
    
    // Verificar máximo del grupo
    if (maxUnidadesGrupo !== null && totalActual >= maxUnidadesGrupo) {
      return; // No puede agregar más
    }
    
    // Verificar máximo por opción
    if (maxUnidadesPorOpcion !== null && cantidadActual >= maxUnidadesPorOpcion) {
      return; // No puede agregar más de esta opción
    }

    setSeleccionesPorGrupo(prev => ({
      ...prev,
      [grupoNombre]: {
        ...(prev[grupoNombre] || {}),
        [opcion]: cantidadActual + 1
      }
    }));
  }, [getCantidadOpcion, getTotalUnidadesGrupo]);

  // Decrementar cantidad de una opción
  const decrementarOpcion = useCallback((grupoNombre, opcion) => {
    const cantidadActual = getCantidadOpcion(grupoNombre, opcion);
    
    if (cantidadActual <= 0) return;

    setSeleccionesPorGrupo(prev => {
      const nuevoGrupo = { ...(prev[grupoNombre] || {}) };
      
      if (cantidadActual === 1) {
        delete nuevoGrupo[opcion];
      } else {
        nuevoGrupo[opcion] = cantidadActual - 1;
      }
      
      return {
        ...prev,
        [grupoNombre]: nuevoGrupo
      };
    });
  }, [getCantidadOpcion]);

  // Toggle para modo opciones (legacy - sin cantidades)
  const toggleOpcion = useCallback((grupoNombre, opcion, grupoNormalizado) => {
    const cantidadActual = getCantidadOpcion(grupoNombre, opcion);
    
    if (cantidadActual > 0) {
      // Quitar selección
      setSeleccionesPorGrupo(prev => {
        const nuevoGrupo = { ...(prev[grupoNombre] || {}) };
        delete nuevoGrupo[opcion];
        return {
          ...prev,
          [grupoNombre]: nuevoGrupo
        };
      });
    } else {
      // Agregar selección (verificando límites)
      const totalActual = getTotalUnidadesGrupo(grupoNombre);
      const maxUnidadesGrupo = grupoNormalizado.maxUnidadesGrupo;
      
      // Si solo permite 1 y ya hay una seleccionada, reemplazar
      if (maxUnidadesGrupo === 1 && totalActual === 1) {
        // Reemplazar la selección anterior
        const grupoPrevio = seleccionesPorGrupo[grupoNombre] || {};
        const opcionPrevia = Object.keys(grupoPrevio)[0];
        
        setSeleccionesPorGrupo(prev => {
          const nuevoGrupo = { [opcion]: 1 };
          return {
            ...prev,
            [grupoNombre]: nuevoGrupo
          };
        });
        return;
      }
      
      // Verificar si puede agregar
      if (maxUnidadesGrupo !== null && totalActual >= maxUnidadesGrupo) {
        return;
      }
      
      // Agregar
      setSeleccionesPorGrupo(prev => ({
        ...prev,
        [grupoNombre]: {
          ...(prev[grupoNombre] || {}),
          [opcion]: 1
        }
      }));
    }
  }, [getCantidadOpcion, getTotalUnidadesGrupo, seleccionesPorGrupo]);

  // Calcular estado de validación para cada grupo
  const estadoGrupos = useMemo(() => {
    const estados = {};
    complementos.forEach(grupoOriginal => {
      const grupo = normalizarGrupo(grupoOriginal);
      const totalUnidades = getTotalUnidadesGrupo(grupo.grupo);
      const minUnidades = grupo.minUnidadesGrupo || (grupo.obligatorio ? 1 : 0);
      const maxUnidades = grupo.maxUnidadesGrupo;
      
      let esValido = true;
      let mensaje = '';
      
      if (totalUnidades < minUnidades) {
        esValido = false;
        mensaje = `Faltan ${minUnidades - totalUnidades} unidad(es)`;
      } else if (maxUnidades !== null && totalUnidades > maxUnidades) {
        esValido = false;
        mensaje = `Excedido (máx: ${maxUnidades})`;
      } else if (maxUnidades !== null && totalUnidades === maxUnidades) {
        mensaje = `✓ Máximo alcanzado`;
      } else if (totalUnidades >= minUnidades && minUnidades > 0) {
        mensaje = `✓ Mínimo cumplido`;
      } else if (totalUnidades > 0) {
        mensaje = `${totalUnidades} seleccionada(s)`;
      }
      
      estados[grupo.grupo] = {
        esValido,
        totalUnidades,
        minUnidades,
        maxUnidades,
        mensaje,
        modoSeleccion: grupo.modoSeleccion,
        obligatorio: grupo.obligatorio
      };
    });
    return estados;
  }, [complementos, seleccionesPorGrupo, getTotalUnidadesGrupo, normalizarGrupo]);

  // Verificar si todos los grupos obligatorios tienen selección
  const obligatoriosCompletos = useMemo(() => {
    return complementos.every(grupoOriginal => {
      const grupo = normalizarGrupo(grupoOriginal);
      if (!grupo.obligatorio) return true;
      
      const totalUnidades = getTotalUnidadesGrupo(grupo.grupo);
      const minUnidades = grupo.minUnidadesGrupo || 1;
      
      return totalUnidades >= minUnidades;
    });
  }, [complementos, seleccionesPorGrupo, getTotalUnidadesGrupo, normalizarGrupo]);

  // Verificar si hay algún error de validación
  const hayErrores = useMemo(() => {
    return Object.values(estadoGrupos).some(e => !e.esValido);
  }, [estadoGrupos]);

  // Confirmar y agregar el plato con complementos
  const handleConfirmar = () => {
    if (!obligatoriosCompletos || hayErrores) return;

    // Construir array de complementos seleccionados
    const complementosSeleccionados = [];
    
    Object.entries(seleccionesPorGrupo).forEach(([grupoNombre, opciones]) => {
      Object.entries(opciones).forEach(([opcion, cantidad]) => {
        if (cantidad > 0) {
          complementosSeleccionados.push({
            grupo: grupoNombre,
            opcion: opcion,
            cantidad: cantidad
          });
        }
      });
    });

    // Llamar al callback con los datos
    onConfirm({
      complementosSeleccionados,
      notaEspecial: notaEspecial.trim(),
    });

    // Resetear estado local
    setSeleccionesPorGrupo({});
    setNotaEspecial("");
  };

  // Cerrar sin guardar
  const handleCancelar = () => {
    setSeleccionesPorGrupo({});
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
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
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
            {complementos.map((complemento, index) => {
              const grupoNormalizado = normalizarGrupo(complemento);
              const estado = estadoGrupos[grupoNormalizado.grupo] || {};
              const esModoCantidad = grupoNormalizado.modoSeleccion === 'cantidades';
              
              return (
                <View key={index} style={styles.grupoContainer}>
                  <View style={styles.grupoHeader}>
                    <Text style={styles.grupoTitle}>{grupoNormalizado.grupo}</Text>
                    {grupoNormalizado.obligatorio && (
                      <View style={styles.requeridoBadge}>
                        <Text style={styles.requeridoBadgeText}>Requerido</Text>
                      </View>
                    )}
                    {esModoCantidad && (
                      <Text style={styles.cantidadHint}>
                        (máx: {grupoNormalizado.maxUnidadesGrupo || '∞'})
                      </Text>
                    )}
                  </View>
                  
                  {/* Estado del grupo */}
                  {estado.mensaje && (
                    <View style={[
                      styles.estadoBadge,
                      !estado.esValido && styles.estadoBadgeError,
                      estado.esValido && estado.totalUnidades > 0 && styles.estadoBadgeSuccess
                    ]}>
                      <Text style={[
                        styles.estadoBadgeText,
                        !estado.esValido && styles.estadoBadgeTextError
                      ]}>
                        {estado.mensaje}
                      </Text>
                    </View>
                  )}

                  {/* Chips de opciones */}
                  <View style={styles.opcionesContainer}>
                    {grupoNormalizado.opciones.map((opcion, optIndex) => {
                      const cantidad = getCantidadOpcion(grupoNormalizado.grupo, opcion);
                      const isSelected = cantidad > 0;
                      const puedeIncrementar = 
                        (grupoNormalizado.maxUnidadesGrupo === null || getTotalUnidadesGrupo(grupoNormalizado.grupo) < grupoNormalizado.maxUnidadesGrupo) &&
                        (grupoNormalizado.maxUnidadesPorOpcion === null || cantidad < grupoNormalizado.maxUnidadesPorOpcion);

                      // Modo cantidad: mostrar +/- buttons
                      if (esModoCantidad) {
                        return (
                          <View key={optIndex} style={styles.opcionCantidadRow}>
                            <TouchableOpacity
                              style={[
                                styles.opcionChip,
                                isSelected && styles.opcionChipSelected,
                              ]}
                              onPress={() => toggleOpcion(grupoNormalizado.grupo, opcion, grupoNormalizado)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.opcionText,
                                  isSelected && styles.opcionTextSelected,
                                ]}
                              >
                                {opcion}
                              </Text>
                            </TouchableOpacity>
                            
                            <View style={styles.cantidadControls}>
                              <TouchableOpacity
                                style={[styles.cantidadButton, cantidad === 0 && styles.cantidadButtonDisabled]}
                                onPress={() => decrementarOpcion(grupoNormalizado.grupo, opcion)}
                                disabled={cantidad === 0}
                              >
                                <MaterialCommunityIcons name="minus" size={16} color={cantidad > 0 ? theme.colors.text.white : theme.colors.text.light} />
                              </TouchableOpacity>
                              
                              <Text style={styles.cantidadText}>{cantidad}</Text>
                              
                              <TouchableOpacity
                                style={[styles.cantidadButton, !puedeIncrementar && styles.cantidadButtonDisabled]}
                                onPress={() => incrementarOpcion(grupoNormalizado.grupo, opcion, grupoNormalizado)}
                                disabled={!puedeIncrementar}
                              >
                                <MaterialCommunityIcons name="plus" size={16} color={puedeIncrementar ? theme.colors.text.white : theme.colors.text.light} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      }

                      // Modo opciones (legacy): chip simple
                      return (
                        <TouchableOpacity
                          key={optIndex}
                          style={[
                            styles.opcionChip,
                            isSelected && styles.opcionChipSelected,
                          ]}
                          onPress={() => toggleOpcion(grupoNormalizado.grupo, opcion, grupoNormalizado)}
                          activeOpacity={0.7}
                        >
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
              );
            })}

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
                (!obligatoriosCompletos || hayErrores) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmar}
              disabled={!obligatoriosCompletos || hayErrores}
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
                Completa las opciones requeridas
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
    cantidadHint: {
      fontSize: 12,
      color: theme.colors.text.light,
      fontStyle: "italic",
    },
    estadoBadge: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: theme.spacing.sm,
    },
    estadoBadgeError: {
      backgroundColor: theme.colors.primary + "30",
    },
    estadoBadgeSuccess: {
      backgroundColor: theme.colors.secondary + "30",
    },
    estadoBadgeText: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      fontWeight: "500",
    },
    estadoBadgeTextError: {
      color: theme.colors.primary,
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
      minHeight: 44,
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
    opcionCantidadRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    cantidadControls: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      overflow: "hidden",
    },
    cantidadButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    cantidadButtonDisabled: {
      backgroundColor: theme.colors.text.light + "40",
    },
    cantidadText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text.primary,
      minWidth: 32,
      textAlign: "center",
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
