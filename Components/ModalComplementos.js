import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { themeLight } from "../constants/theme";
import {
  normalizarOpcion,
  getPrecioOpcion,
  getPrecioVariacion,
  variacionesDeOpcion,
  calcularPrecioUnitarioConComplementos,
} from "../utils/precioComplementos";
import { textosGuarnicionesTotales, preseleccionComplementosDePlato, grupoSeleccionFija, preseleccionComplementosFijosDePlato, usaCantidadesTotalesGuarnicion } from "../utils/platoGuarniciones";
import { grupoEsVariantePlato, grupoAnexaNombre, gruposVarianteDePlato, gruposAnexarNombreDePlato, grupoVarianteSumaDeshabilitada, platoVarianteSumaDeshabilitada, grupoOpCantidades, platoOpCantidades, grupoOpCantidadesDePlato, saboresPorUnidadDePlato, previewCombosOp } from "../utils/variantePlato";
import BotonEnviarOrden from "./BotonEnviarOrden";
import { useBotonCantidadPlato } from "../context/BotonCantidadPlatoContext";
import { useLogicaPachamanca } from "../context/LogicaPachamancaContext";
import { normalizarNumeroSerie, numeroSerieEsValido, platoRequiereNumeroSerie } from "../utils/numeroSeriePlato";
import { grupoVisibleEnFoco } from "../utils/platoBuscador";
import { LOGICA_PACHAMANCA_MISMA, slotsOpNecesarios } from "../utils/logicaPachamanca";

const findGrupoModal = (grupos, nombre) => {
  const key = String(nombre || "").trim().toLowerCase();
  return (grupos || []).find((g) => String(g.grupo || "").trim().toLowerCase() === key) || null;
};

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
const claveGrupoNombre = (n) => String(n || "").trim().toLowerCase();

const claveGrupoSkipVar = (g) => grupoEsVariantePlato(g) || grupoAnexaNombre(g);

function escalarCantidadesGuarnicion(prev, oldN, newN, grupos) {
  if (oldN === newN || oldN < 1 || newN < 1) return prev;
  const next = { ...prev };
  Object.keys(prev).forEach((grupoNombre) => {
    const cfg = findGrupoModal(grupos, grupoNombre);
    if (claveGrupoSkipVar(cfg)) return;
    const opciones = prev[grupoNombre] || {};
    const scaled = {};
    Object.entries(opciones).forEach(([op, cant]) => {
      const q = Number(cant) || 0;
      scaled[op] = q % oldN === 0 ? (q / oldN) * newN : q;
    });
    next[grupoNombre] = scaled;
  });
  return next;
}

const ModalComplementos = ({ visible, plato, onConfirm, onClose, complementosIniciales = null, notaInicial = "", numeroSerieInicial = "", modoEdicion = false, cantidadLinea = 1, ocultarSumar = false, focoModo = null, onEnviarOrden = null, enviandoOrden = false }) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const styles = modalComplementosStyles(theme);
  const { estilo: estiloQty, iconSize: iconSizeQty } = useBotonCantidadPlato();
  const { logicaPachamanca } = useLogicaPachamanca();

  // Estado local para las selecciones del mozo
  // Estructura: { "Proteína": { "Pollo": 2, "Res": 1 }, "Guarnición": { "Ensalada": 1 } }
  const [seleccionesPorGrupo, setSeleccionesPorGrupo] = useState({});
  const [variacionesPorGrupo, setVariacionesPorGrupo] = useState({});
  const [notaEspecial, setNotaEspecial] = useState("");
  const [cantidadClones, setCantidadClones] = useState(1);
  const [ordenSabores, setOrdenSabores] = useState([]);
  const [numeroSerie, setNumeroSerie] = useState("");
  const [kbH, setKbH] = useState(0);
  const serieInputRef = useRef(null);
  const initKeyRef = useRef("");

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

  const platoKey = plato?._id || plato?.id || '';

  // null = plato nuevo → preselección de platos.html. Array = edición (aunque esté vacío).
  // Solo hidratar al abrir o cambiar de plato. Si no, un re-render del padre
  // (numeroSerieInicial / plato nuevo) borra lo que el mozo está escribiendo.
  useEffect(() => {
    if (!visible) {
      initKeyRef.current = "";
      return;
    }
    const nInit = Math.max(1, Math.min(99, Number(cantidadLinea) || 1));
    const initKey = `${platoKey}|${modoEdicion ? "edicion" : "nuevo"}|${focoModo || ""}|${ocultarSumar ? 1 : 0}|${nInit}`;
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;
    const factorGarn = usaCantidadesTotalesGuarnicion(plato, nInit) ? nInit : 1;
    const fijos = preseleccionComplementosFijosDePlato(plato);
    const nombresFijos = new Set(
      fijos.map((c) => String(c.grupo || "").trim().toLowerCase())
    );
    const fuente = Array.isArray(complementosIniciales)
      ? complementosIniciales
      : preseleccionComplementosDePlato(plato);
    const cantOpcion = (comp) => {
      const cfg = findGrupoModal(plato?.complementos, comp.grupo);
      const factor = claveGrupoSkipVar(cfg) ? 1 : factorGarn;
      return (comp.cantidad || 1) * factor;
    };
    const nuevaSeleccion = {};
    const nuevasVars = {};
    const applyVar = (comp) => {
      const v = String(comp.variacion || "").trim();
      if (!v || !comp.grupo || !comp.opcion) return;
      const gk = String(comp.grupo).trim();
      if (!nuevasVars[gk]) nuevasVars[gk] = {};
      nuevasVars[gk][comp.opcion] = v;
    };
    fuente.forEach((comp) => {
      const grupoKey = String(comp.grupo || "").trim();
      if (!grupoKey) return;
      if (!modoEdicion && nombresFijos.has(grupoKey.toLowerCase())) return;
      if (!nuevaSeleccion[grupoKey]) nuevaSeleccion[grupoKey] = {};
      nuevaSeleccion[grupoKey][comp.opcion] = cantOpcion(comp);
      applyVar(comp);
    });
    fijos.forEach((comp) => {
      const grupoKey = String(comp.grupo || "").trim();
      if (!grupoKey) return;
      if (modoEdicion && nuevaSeleccion[grupoKey]) return;
      if (!nuevaSeleccion[grupoKey]) nuevaSeleccion[grupoKey] = {};
      nuevaSeleccion[grupoKey][comp.opcion] = cantOpcion(comp);
      applyVar(comp);
    });
    setSeleccionesPorGrupo(nuevaSeleccion);
    setVariacionesPorGrupo(nuevasVars);
    const gOpInit = grupoOpCantidadesDePlato(plato);
    const ordenInit = [];
    if (gOpInit) {
      const claveOp = String(gOpInit.grupo || '').trim().toLowerCase();
      fuente.forEach((comp) => {
        if (String(comp.grupo || '').trim().toLowerCase() !== claveOp) return;
        const q = Math.max(0, Number(comp.cantidad) || 0);
        for (let i = 0; i < q; i += 1) ordenInit.push(comp.opcion);
      });
    }
    setOrdenSabores(ordenInit);
    setNotaEspecial(typeof notaInicial === 'string' ? notaInicial : "");
    setCantidadClones(nInit);
    setNumeroSerie(normalizarNumeroSerie(numeroSerieInicial));
  }, [visible, complementosIniciales, notaInicial, numeroSerieInicial, platoKey, modoEdicion, cantidadLinea, ocultarSumar, focoModo]);

  useEffect(() => {
    if (!visible) {
      setKbH(0);
      return undefined;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvt, (e) => {
      setKbH(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

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
    const grupoCfg = findGrupoModal(complementos, grupoNombre) || grupoNormalizado;
    const esVar = grupoEsVariantePlato(grupoCfg);
    const esOpCant = grupoOpCantidades(grupoCfg);
    const sumaLibre = grupoVarianteSumaDeshabilitada(grupoCfg);
    const n = Math.max(1, Math.min(99, Number(cantidadClones) || 1));
    const totGarn = usaCantidadesTotalesGuarnicion(plato, n);
    const nSab = saboresPorUnidadDePlato(plato);
    const maxSlotsOp = slotsOpNecesarios(logicaPachamanca, n, nSab);

    // Validar límites
    let maxUnidadesGrupo = grupoNormalizado.maxUnidadesGrupo;
    if (esOpCant) maxUnidadesGrupo = maxSlotsOp;
    else if (esVar && !sumaLibre) maxUnidadesGrupo = n;
    else if (!esVar && !esOpCant && !grupoAnexaNombre(grupoCfg) && totGarn) {
      if (maxUnidadesGrupo != null) maxUnidadesGrupo = maxUnidadesGrupo * n;
      else if (grupoNormalizado.modoSeleccion !== 'cantidades') maxUnidadesGrupo = n;
    }
    let maxUnidadesPorOpcion = grupoNormalizado.maxUnidadesPorOpcion;
    if (esOpCant) maxUnidadesPorOpcion = null;
    else if (!esVar && !esOpCant && !grupoAnexaNombre(grupoCfg) && totGarn && maxUnidadesPorOpcion != null) {
      maxUnidadesPorOpcion = maxUnidadesPorOpcion * n;
    }
    
    // Verificar máximo del grupo
    if (maxUnidadesGrupo !== null && totalActual >= maxUnidadesGrupo) {
      return; // No puede agregar más
    }
    
    // Verificar máximo por opción
    if (maxUnidadesPorOpcion !== null && cantidadActual >= maxUnidadesPorOpcion) {
      return; // No puede agregar más de esta opción
    }

    if (esOpCant) {
      setOrdenSabores((prev) => (prev.length >= maxSlotsOp ? prev : [...prev, opcion]));
    }

    setSeleccionesPorGrupo(prev => ({
      ...prev,
      [grupoNombre]: {
        ...(prev[grupoNombre] || {}),
        [opcion]: cantidadActual + 1
      }
    }));
  }, [getCantidadOpcion, getTotalUnidadesGrupo, cantidadClones, complementos, plato, logicaPachamanca]);

  // Decrementar cantidad de una opción
  const decrementarOpcion = useCallback((grupoNombre, opcion) => {
    const cantidadActual = getCantidadOpcion(grupoNombre, opcion);
    
    if (cantidadActual <= 0) return;

    const grupoCfg = findGrupoModal(complementos, grupoNombre);
    if (grupoOpCantidades(grupoCfg)) {
      setOrdenSabores((prev) => {
        const i = prev.lastIndexOf(opcion);
        if (i < 0) return prev;
        return [...prev.slice(0, i), ...prev.slice(i + 1)];
      });
    }

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
    if (cantidadActual === 1) {
      setVariacionesPorGrupo(prev => {
        const g = { ...(prev[grupoNombre] || {}) };
        delete g[opcion];
        return { ...prev, [grupoNombre]: g };
      });
    }
  }, [getCantidadOpcion, complementos]);

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
      setVariacionesPorGrupo(prev => {
        const g = { ...(prev[grupoNombre] || {}) };
        delete g[opcion];
        return { ...prev, [grupoNombre]: g };
      });
    } else {
      // Agregar selección (verificando límites)
      const totalActual = getTotalUnidadesGrupo(grupoNombre);
      const maxUnidadesGrupo = grupoNormalizado.maxUnidadesGrupo;
      
      // Si solo permite 1 y ya hay una seleccionada, reemplazar
      if (maxUnidadesGrupo === 1 && totalActual === 1) {
        setSeleccionesPorGrupo(prev => {
          const nuevoGrupo = { [opcion]: 1 };
          return {
            ...prev,
            [grupoNombre]: nuevoGrupo
          };
        });
        setVariacionesPorGrupo(prev => ({ ...prev, [grupoNombre]: {} }));
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

  const elegirVariacion = useCallback((grupoNombre, opcion, variacionNombre, grupoNormalizado) => {
    const next = String(variacionNombre || "").trim();
    if (!next) return;
    const cant = getCantidadOpcion(grupoNombre, opcion);
    const actual = String(variacionesPorGrupo[grupoNombre]?.[opcion] || "").trim();
    if (cant > 0 && actual.toLowerCase() === next.toLowerCase()) {
      setVariacionesPorGrupo((prev) => {
        const g = { ...(prev[grupoNombre] || {}) };
        delete g[opcion];
        return { ...prev, [grupoNombre]: g };
      });
      return;
    }
    if (cant <= 0) {
      if (grupoNormalizado?.modoSeleccion === "cantidades") {
        incrementarOpcion(grupoNombre, opcion, grupoNormalizado);
      } else {
        toggleOpcion(grupoNombre, opcion, grupoNormalizado);
      }
    }
    setVariacionesPorGrupo((prev) => ({
      ...prev,
      [grupoNombre]: { ...(prev[grupoNombre] || {}), [opcion]: next },
    }));
  }, [getCantidadOpcion, variacionesPorGrupo, incrementarOpcion, toggleOpcion]);

  const nClones = Math.max(1, Math.min(99, Number(cantidadClones) || 1));
  const hayVarianteMix = gruposVarianteDePlato(plato).length > 0;
  const hayAnexarNombre = gruposAnexarNombreDePlato(plato).length > 0;
  const sumaMixLibre = platoVarianteSumaDeshabilitada(plato);
  const opCantidades = platoOpCantidades(plato);
  const nSaboresOp = saboresPorUnidadDePlato(plato);
  const logicaMismaCombo = logicaPachamanca === LOGICA_PACHAMANCA_MISMA;
  const maxSlotsOp = slotsOpNecesarios(logicaPachamanca, nClones, nSaboresOp);
  const usarTotalesGarn = usaCantidadesTotalesGuarnicion(plato, nClones);
  const mixSum = useMemo(() => {
    return gruposVarianteDePlato(plato).reduce((s, g) => s + getTotalUnidadesGrupo(g.grupo), 0);
  }, [plato, getTotalUnidadesGrupo, seleccionesPorGrupo]);
  const factorPedido = sumaMixLibre ? Math.max(1, Math.min(99, mixSum)) : nClones;
  const gruposVarianteDePlatoHint = sumaMixLibre
    ? "Las cantidades de TÉ / CAFÉ son lo que se pide. Las fijas se multiplican por ese total."
    : hayVarianteMix
    ? (nClones === 1
      ? "Elegí 1 opción de la variante (TÉ, CAFÉ…). Las otras guarniciones van con cada MIX."
      : `Repartí ${nClones} MIX entre TÉ / CAFÉ / etc. Cada uno lleva las demás guarniciones.`)
    : hayAnexarNombre && opCantidades
    ? (logicaMismaCombo
      ? `Elegí ${nSaboresOp} sabor(es) una vez. Agregar Cantidad copia esa mezcla a ${nClones} pachamanca(s).`
      : `Agregar Cantidad = pachamancas. Los sabores van de a ${nSaboresOp}. Faltan ${Math.max(0, maxSlotsOp - ordenSabores.length)}.`)
    : hayAnexarNombre
    ? `Elegí la opción OP. Se aplica a ${nClones} plato(s).`
    : (nClones === 1
      ? "Las cantidades de abajo son por cada plato"
      : `Total de ${nClones} platos: restá de a 1 (ej. 2 papas → 1 papa y 1 frejol)`);

  // Calcular estado de validación para cada grupo
  const estadoGrupos = useMemo(() => {
    const estados = {};
    complementos.forEach(grupoOriginal => {
      if (!grupoVisibleEnFoco(grupoOriginal, focoModo)) return;
      if (!modoEdicion && grupoSeleccionFija(grupoOriginal)) return;
      const grupo = normalizarGrupo(grupoOriginal);
      const totalUnidades = getTotalUnidadesGrupo(grupo.grupo);
      const esVar = grupoEsVariantePlato(grupoOriginal);
      const esOpCant = grupoOpCantidades(grupoOriginal);
      const sumaLibre = grupoVarianteSumaDeshabilitada(grupoOriginal);
      const totGarn = !esVar && !esOpCant && !grupoAnexaNombre(grupoOriginal) && usarTotalesGarn;
      const minBase = grupo.minUnidadesGrupo || (grupo.obligatorio ? 1 : 0);
      const minUnidades = esOpCant
        ? maxSlotsOp
        : esVar
        ? (sumaLibre ? (grupo.minUnidadesGrupo || (grupo.obligatorio ? 1 : 0) || 1) : nClones)
        : minBase * (totGarn ? nClones : 1);
      const maxUnidades = esOpCant
        ? maxSlotsOp
        : esVar
        ? (sumaLibre ? grupo.maxUnidadesGrupo : nClones)
        : (grupo.maxUnidadesGrupo == null
          ? (totGarn && grupo.modoSeleccion !== 'cantidades' ? nClones : null)
          : grupo.maxUnidadesGrupo * (totGarn ? nClones : 1));
      
      let esValido = true;
      let mensaje = '';
      
      if (totalUnidades < minUnidades) {
        esValido = false;
        mensaje = esOpCant
          ? (logicaMismaCombo
            ? `Elegí ${nSaboresOp} sabor(es) (faltan ${minUnidades - totalUnidades})`
            : `Van de a ${nSaboresOp}: faltan ${minUnidades - totalUnidades} para ${nClones} pachamanca(s)`)
          : esVar
          ? (sumaLibre
            ? `Elegí al menos ${minUnidades} (TÉ, CAFÉ…)`
            : `Repartí ${nClones} entre las opciones (faltan ${minUnidades - totalUnidades})`)
          : `Faltan ${minUnidades - totalUnidades} unidad(es)`;
      } else if (maxUnidades !== null && totalUnidades > maxUnidades) {
        esValido = false;
        mensaje = (esVar && !sumaLibre) || esOpCant
          ? `Suma ${totalUnidades}, debe ser ${minUnidades}`
          : `Excedido (máx: ${maxUnidades})`;
      } else if (maxUnidades !== null && totalUnidades === maxUnidades) {
        mensaje = esOpCant
          ? (logicaMismaCombo
            ? `✓ Combinación lista × ${nClones}`
            : `✓ ${nClones} pachamanca(s) de ${nSaboresOp}`)
          : `✓ Máximo alcanzado`;
      } else if (esVar && sumaLibre && totalUnidades > 0) {
        mensaje = `${totalUnidades} pedida(s) · las fijas ×${totalUnidades}`;
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
  }, [complementos, seleccionesPorGrupo, getTotalUnidadesGrupo, normalizarGrupo, nClones, modoEdicion, focoModo, usarTotalesGarn, maxSlotsOp, nSaboresOp, logicaMismaCombo]);

  // Verificar si todos los grupos obligatorios tienen selección
  const obligatoriosCompletos = useMemo(() => {
    return complementos.every(grupoOriginal => {
      if (!grupoVisibleEnFoco(grupoOriginal, focoModo)) return true;
      if (grupoSeleccionFija(grupoOriginal)) return true;
      const grupo = normalizarGrupo(grupoOriginal);
      if (!grupo.obligatorio && !grupoEsVariantePlato(grupoOriginal)) return true;
      
      const totalUnidades = getTotalUnidadesGrupo(grupo.grupo);
      const minUnidades = grupoEsVariantePlato(grupoOriginal)
        ? (grupoVarianteSumaDeshabilitada(grupoOriginal)
          ? (grupo.minUnidadesGrupo || 1)
          : nClones)
        : (grupo.minUnidadesGrupo || 1) * (usarTotalesGarn && !grupoEsVariantePlato(grupoOriginal) ? nClones : 1);
      
      return totalUnidades >= minUnidades;
    });
  }, [complementos, seleccionesPorGrupo, getTotalUnidadesGrupo, normalizarGrupo, nClones, focoModo, usarTotalesGarn]);

  // Verificar si hay algún error de validación
  const hayErrores = useMemo(() => {
    return Object.values(estadoGrupos).some(e => !e.esValido);
  }, [estadoGrupos]);

  const cambiarClones = (delta) => {
    const oldN = Math.max(1, Math.min(99, Number(cantidadClones) || 1));
    const newN = Math.max(1, Math.min(99, oldN + delta));
    if (newN === oldN) return;
    if (usaCantidadesTotalesGuarnicion(plato, Math.max(oldN, newN))) {
      setSeleccionesPorGrupo((prev) => escalarCantidadesGuarnicion(prev, oldN, newN, complementos));
    }
    if (opCantidades && !logicaMismaCombo) {
      const cap = slotsOpNecesarios(logicaPachamanca, newN, nSaboresOp);
      setOrdenSabores((prev) => {
        if (prev.length <= cap) return prev;
        const next = prev.slice(0, cap);
        const gOp = grupoOpCantidadesDePlato(plato);
        if (gOp) {
          const counts = {};
          next.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
          setSeleccionesPorGrupo((sel) => ({ ...sel, [gOp.grupo]: counts }));
        }
        return next;
      });
    }
    setCantidadClones(newN);
  };

  const totalesGuarnicion = useMemo(() => {
    const comps = [];
    Object.entries(seleccionesPorGrupo).forEach(([grupo, opciones]) => {
      const grupoCfg = findGrupoModal(complementos, grupo);
      if (grupoEsVariantePlato(grupoCfg)) return;
      Object.entries(opciones).forEach(([opcion, cantidad]) => {
        if (cantidad > 0) comps.push({
          grupo,
          opcion,
          cantidad,
          variacion: variacionesPorGrupo[grupo]?.[opcion] || '',
        });
      });
    });
    return textosGuarnicionesTotales(comps, usarTotalesGarn ? 1 : factorPedido);
  }, [seleccionesPorGrupo, variacionesPorGrupo, factorPedido, complementos, usarTotalesGarn]);

  // v3.0: Cálculo de precios en tiempo real
  // - Si plato.complementosAfectanPrecio === false, los extras son informativos (no suman).
  // - El footer muestra base + extras = unitario.
  const afectanPrecio = plato?.complementosAfectanPrecio !== false;
  const basePlato = Number(plato?.precio) || 0;

  const preciosResumen = useMemo(() => {
    const seleccionesParaCalc = [];
    Object.entries(seleccionesPorGrupo).forEach(([grupoNombre, opciones]) => {
      const grupoConfig = findGrupoModal(complementos, grupoNombre);
      Object.entries(opciones).forEach(([opcion, cantidad]) => {
        if (cantidad > 0) {
          const varNom = variacionesPorGrupo[grupoNombre]?.[opcion];
          const precioOpcion = grupoConfig ? getPrecioOpcion(grupoConfig, opcion) : 0;
          const precioVar = grupoConfig ? getPrecioVariacion(grupoConfig, opcion, varNom) : 0;
          seleccionesParaCalc.push({
            grupo: grupoNombre,
            opcion,
            cantidad,
            precio: afectanPrecio ? precioOpcion + precioVar : 0,
          });
        }
      });
    });
    const calc = calcularPrecioUnitarioConComplementos(
      basePlato,
      seleccionesParaCalc,
      { afectanPrecio }
    );
    if (usarTotalesGarn && nClones > 1) {
      const extraTotal = calc.extraComplementos;
      const extraUnit = extraTotal / nClones;
      return {
        extra: extraUnit,
        unitario: basePlato + extraUnit,
        tieneExtras: extraTotal > 0,
        extraTotal,
      };
    }
    return {
      extra: calc.extraComplementos,
      unitario: calc.precioUnitario,
      tieneExtras: calc.extraComplementos > 0,
      extraTotal: calc.extraComplementos * nClones,
    };
  }, [seleccionesPorGrupo, variacionesPorGrupo, complementos, basePlato, afectanPrecio, usarTotalesGarn, nClones]);

  const totalOrdenMostrar = useMemo(() => {
    if (usarTotalesGarn) {
      return basePlato * nClones + (Number(preciosResumen.extraTotal) || 0);
    }
    if (!sumaMixLibre) return preciosResumen.unitario * nClones;
    let extraMix = 0;
    let extraGarn = 0;
    Object.entries(seleccionesPorGrupo).forEach(([grupoNombre, opciones]) => {
      const grupoConfig = findGrupoModal(complementos, grupoNombre);
      const esVar = grupoEsVariantePlato(grupoConfig);
      Object.entries(opciones).forEach(([opcion, cantidad]) => {
        if (cantidad <= 0) return;
        const p = afectanPrecio && grupoConfig
          ? getPrecioOpcion(grupoConfig, opcion) + getPrecioVariacion(grupoConfig, opcion, variacionesPorGrupo[grupoNombre]?.[opcion])
          : 0;
        if (esVar) extraMix += p * cantidad;
        else extraGarn += p * cantidad;
      });
    });
    const f = Math.max(1, mixSum);
    return basePlato * f + extraMix + extraGarn * f;
  }, [sumaMixLibre, preciosResumen.unitario, preciosResumen.extraTotal, nClones, seleccionesPorGrupo, variacionesPorGrupo, complementos, afectanPrecio, mixSum, basePlato, usarTotalesGarn]);

  // Confirmar y agregar el plato con complementos
  const requiereSerie = platoRequiereNumeroSerie(plato);
  const serieValida = !!focoModo || !requiereSerie || numeroSerieEsValido(numeroSerie);

  const handleConfirmar = () => {
    if (!obligatoriosCompletos || hayErrores || !serieValida) return false;

    const scaleSiTotal = (c) => {
      const cfg = findGrupoModal(complementos, c.grupo);
      if (!usarTotalesGarn || claveGrupoSkipVar(cfg)) return c;
      return { ...c, cantidad: (Number(c.cantidad) || 1) * nClones };
    };
    const fijos = preseleccionComplementosFijosDePlato(plato).map((c) => ({
      ...scaleSiTotal(c),
      precio: afectanPrecio ? (Number(c.precio) || 0) : 0,
    }));
    const nombresFijos = new Set(
      fijos.map((c) => claveGrupoNombre(c.grupo))
    );
    const visiblesKeys = new Set(
      complementos
        .filter((g) => grupoVisibleEnFoco(g, focoModo) && (modoEdicion || !grupoSeleccionFija(g)))
        .map((g) => claveGrupoNombre(g.grupo))
    );
    const fuenteKept = Array.isArray(complementosIniciales)
      ? complementosIniciales
      : preseleccionComplementosDePlato(plato);
    const kept = focoModo
      ? fuenteKept.filter((c) => !visiblesKeys.has(claveGrupoNombre(c.grupo))).map(scaleSiTotal)
      : [];
    const keptSinFijos = kept.filter((c) => !nombresFijos.has(claveGrupoNombre(c.grupo)));

    const complementosSeleccionados = modoEdicion
      ? [...kept]
      : (focoModo ? [...fijos, ...keptSinFijos] : [...fijos]);

    const gOpConfirm = grupoOpCantidadesDePlato(plato);
    const claveOpConfirm = gOpConfirm ? claveGrupoNombre(gOpConfirm.grupo) : '';
    const ordenEmit = logicaMismaCombo
      ? ordenSabores.slice(0, nSaboresOp)
      : ordenSabores;

    Object.entries(seleccionesPorGrupo).forEach(([grupoNombre, opciones]) => {
      if (!grupoVisibleEnFoco(findGrupoModal(complementos, grupoNombre), focoModo)) return;
      if (!modoEdicion && nombresFijos.has(claveGrupoNombre(grupoNombre))) return;
      if (claveOpConfirm && claveGrupoNombre(grupoNombre) === claveOpConfirm) return;
      const grupoConfig = findGrupoModal(complementos, grupoNombre);
      Object.entries(opciones).forEach(([opcion, cantidad]) => {
        if (cantidad > 0) {
          const opDoc = (grupoConfig?.opciones || []).find((o) =>
            String(o?.nombre || '').trim().toLowerCase() === String(opcion).trim().toLowerCase()
          );
          const variacion = String(variacionesPorGrupo[grupoNombre]?.[opcion] || '').trim();
          const precioOpcion = grupoConfig ? getPrecioOpcion(grupoConfig, opcion) : 0;
          const precioVar = grupoConfig ? getPrecioVariacion(grupoConfig, opcion, variacion) : 0;
          complementosSeleccionados.push({
            grupo: grupoNombre,
            opcion: opcion,
            cantidad: cantidad,
            precio: afectanPrecio ? precioOpcion + precioVar : 0,
            pronombre: String(opDoc?.pronombre || '').trim(),
            ...(variacion ? { variacion } : {}),
          });
        }
      });
    });

    if (gOpConfirm && ordenEmit.length) {
      const grupoConfig = gOpConfirm;
      ordenEmit.forEach((opcion) => {
        const opDoc = (grupoConfig?.opciones || []).find((o) =>
          String(o?.nombre || '').trim().toLowerCase() === String(opcion).trim().toLowerCase()
        );
        const precioOpcion = getPrecioOpcion(grupoConfig, opcion);
        complementosSeleccionados.push({
          grupo: gOpConfirm.grupo,
          opcion,
          cantidad: 1,
          precio: afectanPrecio ? precioOpcion : 0,
          pronombre: String(opDoc?.pronombre || '').trim(),
        });
      });
    }

    const calc = calcularPrecioUnitarioConComplementos(
      basePlato,
      complementosSeleccionados,
      { afectanPrecio }
    );

    onConfirm({
      complementosSeleccionados,
      notaEspecial: notaEspecial.trim(),
      numeroSerie: requiereSerie ? normalizarNumeroSerie(numeroSerie) : "",
      _precioUnitario: calc.precioUnitario,
      _extraComplementos: calc.extraComplementos,
      _cantidadPlatos: Math.max(1, Math.min(99, sumaMixLibre ? mixSum : nClones)),
    });

    setSeleccionesPorGrupo({});
    setOrdenSabores([]);
    setNotaEspecial("");
    setCantidadClones(1);
    setNumeroSerie("");
    return true;
  };

  const handleEnviarDesdeModal = () => {
    if (enviandoOrden) return;
    if (!handleConfirmar()) return;
    onEnviarOrden?.();
  };

  // Cerrar sin guardar
  const handleCancelar = () => {
    setSeleccionesPorGrupo({});
    setOrdenSabores([]);
    setNotaEspecial("");
    setCantidadClones(1);
    setNumeroSerie("");
    onClose();
  };

  // Si no hay plato, o no hay complementos ni número de serie, no mostrar
  if (!plato || (complementos.length === 0 && !requiereSerie)) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancelar}
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <View style={[styles.modalOverlay, kbH > 0 && Platform.OS === "android" && { paddingBottom: kbH }]}>
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
                {focoModo === 'anexarNombre' ? `OP · ${plato.nombre}` : plato.nombre}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <BotonEnviarOrden
                onPress={onEnviarOrden ? handleEnviarDesdeModal : undefined}
                disabled={enviandoOrden || !obligatoriosCompletos || hayErrores || !serieValida}
              />
              <TouchableOpacity onPress={handleCancelar} style={styles.closeButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.colors.text.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {requiereSerie && !focoModo && (
            <View style={styles.serieContainer} collapsable={false}>
              <Text style={styles.serieLabel}>Número de serie (obligatorio)</Text>
              <Text style={styles.serieHint}>Escríbelo primero. Luego elige TÉ / CAFÉ y cantidades MIX.</Text>
              <TextInput
                ref={serieInputRef}
                style={[styles.serieInput, !serieValida && numeroSerie.length > 0 && styles.serieInputError]}
                placeholder="Ej: 07"
                placeholderTextColor={theme.colors.text.light}
                value={numeroSerie}
                onChangeText={(t) => setNumeroSerie(normalizarNumeroSerie(t))}
                keyboardType="number-pad"
                maxLength={4}
                showSoftInputOnFocus
                selectTextOnFocus={false}
                blurOnSubmit={false}
                autoCorrect={false}
                autoComplete="off"
                editable
              />
            </View>
          )}

          {!modoEdicion && !ocultarSumar && focoModo !== 'anexarNombre' && (
          <View style={styles.cloneBar}>
            <View style={styles.cloneBarText}>
              <View style={styles.cloneTitleRow}>
                <MaterialCommunityIcons
                  name={sumaMixLibre ? "cup" : "plus-box-multiple"}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.cloneTitle}>{sumaMixLibre ? "CANTIDAD MIX" : "SUMAR"}</Text>
              </View>
              <Text style={styles.cloneHint}>
                {gruposVarianteDePlatoHint}
              </Text>
            </View>
          </View>
          )}

          {focoModo === 'anexarNombre' && (
          <View style={styles.cloneBar}>
            <View style={styles.cloneBarText}>
              <View style={styles.cloneTitleRow}>
                <MaterialCommunityIcons
                  name="plus-minus"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.cloneTitle}>
                  {opCantidades
                    ? (nSaboresOp > 1 ? `OP · de a ${nSaboresOp} sabores` : 'OP · sabores')
                    : `OP · ${nClones} ${nClones === 1 ? 'plato' : 'platos'}`}
                </Text>
              </View>
              <Text style={styles.cloneHint}>
                {gruposVarianteDePlatoHint}
              </Text>
            </View>
          </View>
          )}

          {(focoModo === 'anexarNombre' ? !sumaMixLibre : ((!sumaMixLibre) || totalesGuarnicion.length > 0)) && (
            <View style={styles.totalesBar}>
              <View style={styles.totalesBarTextWrap}>
                <Text style={styles.totalesBarTitle} numberOfLines={1}>
                  {focoModo === 'anexarNombre'
                    ? (nClones > 1 ? `Agregar Cantidad (${nClones})` : 'Agregar Cantidad')
                    : (factorPedido > 1 ? `Guarniciones a agregar (${factorPedido} platos)` : 'Guarniciones a agregar')}
                </Text>
                {focoModo === 'anexarNombre' && opCantidades ? (
                  <Text style={styles.totalesBarText} numberOfLines={2}>
                    {logicaMismaCombo
                      ? `${nClones} pachamanca(s) · ${nSaboresOp} sabor(es) a copiar`
                      : `${nClones} pachamanca(s) · ${maxSlotsOp} sabores (de a ${nSaboresOp})`}
                  </Text>
                ) : totalesGuarnicion.length > 0 ? (
                  <Text style={styles.totalesBarText} numberOfLines={2}>
                    {totalesGuarnicion.join(" · ")}
                  </Text>
                ) : null}
              </View>
              {!sumaMixLibre && (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, estiloQty, nClones <= 1 && styles.cantidadButtonDisabled]}
                    onPress={() => cambiarClones(-1)}
                    disabled={nClones <= 1}
                    accessibilityLabel="Quitar uno"
                  >
                    <MaterialCommunityIcons name="minus" size={iconSizeQty} color={theme.colors.text.white} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText} accessibilityLabel={`Cantidad ${nClones}`}>
                    {nClones}
                  </Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, estiloQty, nClones >= 99 && styles.cantidadButtonDisabled]}
                    onPress={() => cambiarClones(1)}
                    disabled={nClones >= 99}
                    accessibilityLabel="Sumar uno"
                  >
                    <MaterialCommunityIcons name="plus" size={iconSizeQty} color={theme.colors.text.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {focoModo === 'anexarNombre' && opCantidades && (
            <View style={styles.comboPreview}>
              {(logicaMismaCombo
                ? [{
                    index: 1,
                    sabores: ordenSabores.slice(0, nSaboresOp),
                    completo: ordenSabores.length >= nSaboresOp,
                    faltan: Math.max(0, nSaboresOp - Math.min(ordenSabores.length, nSaboresOp)),
                    copias: nClones,
                  }]
                : previewCombosOp(ordenSabores, nSaboresOp, nClones)
              ).map((row) => (
                <Text
                  key={row.index}
                  style={[styles.comboPreviewLine, row.completo && styles.comboPreviewOk]}
                  numberOfLines={1}
                >
                  {logicaMismaCombo
                    ? `${(row.sabores || []).join(' - ') || '…'} × ${row.copias}`
                    : `${row.index}. ${(row.sabores || []).join(' - ') || '…'}${row.faltan ? `  (${row.faltan} más)` : ''}`}
                </Text>
              ))}
            </View>
          )}

          <ScrollView
            style={[styles.modalScrollView, kbH > 0 && styles.modalScrollViewTeclado]}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
            removeClippedSubviews={false}
          >
            {/* Grupos de complementos */}
            {complementos.map((complemento, index) => {
              if (!grupoVisibleEnFoco(complemento, focoModo)) return null;
              if (!modoEdicion && grupoSeleccionFija(complemento)) return null;
              const grupoNormalizado = normalizarGrupo(complemento);
              const estado = estadoGrupos[grupoNormalizado.grupo] || {};
              const esModoCantidad = grupoNormalizado.modoSeleccion === 'cantidades';
              const esVarGrupo = grupoEsVariantePlato(complemento);
              const esAnexarGrupo = grupoAnexaNombre(complemento);
              const esOpCantGrupo = grupoOpCantidades(complemento);
              const totEsteGrupo = !esVarGrupo && !esAnexarGrupo && usarTotalesGarn;
              let maxGrupoEfectivo = esOpCantGrupo
                ? maxSlotsOp
                : esVarGrupo
                ? (sumaMixLibre ? grupoNormalizado.maxUnidadesGrupo : nClones)
                : grupoNormalizado.maxUnidadesGrupo;
              if (totEsteGrupo) {
                if (maxGrupoEfectivo != null) maxGrupoEfectivo = maxGrupoEfectivo * nClones;
                else if (grupoNormalizado.modoSeleccion !== 'cantidades') maxGrupoEfectivo = nClones;
              }
              const maxPorOpcionEfectivo = esOpCantGrupo
                ? null
                : (totEsteGrupo && grupoNormalizado.maxUnidadesPorOpcion != null
                  ? grupoNormalizado.maxUnidadesPorOpcion * nClones
                  : grupoNormalizado.maxUnidadesPorOpcion);
              const mostrarStepper = esModoCantidad || totEsteGrupo;
              
              return (
                <View key={index} style={styles.grupoContainer}>
                  <View style={styles.grupoHeader}>
                    <Text style={styles.grupoTitle}>
                      {esVarGrupo
                        ? `${grupoNormalizado.grupo} · nombre en cocina`
                        : esAnexarGrupo
                          ? `${grupoNormalizado.grupo} · OP`
                          : grupoSeleccionFija(complemento)
                            ? `${grupoNormalizado.grupo} · fijo`
                            : grupoNormalizado.grupo}
                    </Text>
                    {grupoNormalizado.obligatorio && (
                      <View style={styles.requeridoBadge}>
                        <Text style={styles.requeridoBadgeText}>Requerido</Text>
                      </View>
                    )}
                    {mostrarStepper && (
                      <Text style={styles.cantidadHint}>
                        (máx: {maxGrupoEfectivo == null ? '∞' : maxGrupoEfectivo})
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
                    {grupoNormalizado.opciones.map((opcionRaw, optIndex) => {
                      // v3.0: normalizar opción (string u objeto) a { nombre, precio }
                      const opcion = normalizarOpcion(opcionRaw);
                      const opcionNombre = opcion.nombre;
                      const opcionPrecio = opcion.precio || 0;
                      const cantidad = getCantidadOpcion(grupoNormalizado.grupo, opcionNombre);
                      const isSelected = cantidad > 0;
                      const puedeIncrementar = 
                        (maxGrupoEfectivo === null || getTotalUnidadesGrupo(grupoNormalizado.grupo) < maxGrupoEfectivo) &&
                        (maxPorOpcionEfectivo === null || cantidad < maxPorOpcionEfectivo);
                      const mostrarVars = !esVarGrupo && !esAnexarGrupo && !esOpCantGrupo;
                      const varsOpcion = mostrarVars ? variacionesDeOpcion(opcionRaw) : [];
                      const varActual = String(variacionesPorGrupo[grupoNormalizado.grupo]?.[opcionNombre] || '').trim();
                      const chipsVars = varsOpcion.map((vr) => {
                        const activa = isSelected && varActual.toLowerCase() === vr.nombre.toLowerCase();
                        const pVar = vr.precio || 0;
                        return (
                          <TouchableOpacity
                            key={vr.nombre}
                            style={[styles.variacionChip, activa && styles.variacionChipSelected]}
                            onPress={() => elegirVariacion(grupoNormalizado.grupo, opcionNombre, vr.nombre, grupoNormalizado)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.variacionText, activa && styles.variacionTextSelected]}>
                              {vr.nombre}
                              {afectanPrecio && pVar > 0 ? ` +S/. ${pVar.toFixed(2)}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      });

                      // Modo cantidad: mostrar +/- buttons
                      if (mostrarStepper) {
                        return (
                          <View key={optIndex} style={styles.opcionCantidadRow}>
                            <View style={styles.opcionConVariacionesRow}>
                              <TouchableOpacity
                                style={[
                                  styles.opcionChip,
                                  isSelected && styles.opcionChipSelected,
                                ]}
                                onPress={() => {
                                  if (esOpCantGrupo || totEsteGrupo) {
                                    if (esOpCantGrupo || cantidad === 0) incrementarOpcion(grupoNormalizado.grupo, opcionNombre, grupoNormalizado);
                                    return;
                                  }
                                  toggleOpcion(grupoNormalizado.grupo, opcionNombre, grupoNormalizado);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.opcionText,
                                    isSelected && styles.opcionTextSelected,
                                  ]}
                                >
                                  {opcionNombre}
                                  {afectanPrecio && opcionPrecio > 0 ? `  +S/. ${opcionPrecio.toFixed(2)}` : ''}
                                </Text>
                              </TouchableOpacity>
                              {chipsVars}
                            </View>
                            
                            <View style={styles.cantidadControls}>
                              <TouchableOpacity
                                style={[styles.cantidadButton, cantidad === 0 && styles.cantidadButtonDisabled]}
                                onPress={() => decrementarOpcion(grupoNormalizado.grupo, opcionNombre)}
                                disabled={cantidad === 0}
                              >
                                <MaterialCommunityIcons name="minus" size={16} color={cantidad > 0 ? theme.colors.text.white : theme.colors.text.light} />
                              </TouchableOpacity>
                              
                              <Text style={styles.cantidadText}>{cantidad}</Text>
                              <TouchableOpacity
                                style={[styles.cantidadButton, !puedeIncrementar && styles.cantidadButtonDisabled]}
                                onPress={() => incrementarOpcion(grupoNormalizado.grupo, opcionNombre, grupoNormalizado)}
                                disabled={!puedeIncrementar}
                              >
                                <MaterialCommunityIcons name="plus" size={16} color={puedeIncrementar ? theme.colors.text.white : theme.colors.text.light} />
                              </TouchableOpacity>
                            </View>
                            {!esVarGrupo && factorPedido > 1 && cantidad > 0 && !usarTotalesGarn && (
                              <Text style={styles.cantidadTotalHint}>={cantidad * factorPedido}</Text>
                            )}
                          </View>
                        );
                      }

                      // Modo opciones (legacy): chip + variaciones a la derecha
                      return (
                        <View key={optIndex} style={styles.opcionConVariacionesRow}>
                          <TouchableOpacity
                            style={[
                              styles.opcionChip,
                              isSelected && styles.opcionChipSelected,
                            ]}
                            onPress={() => toggleOpcion(grupoNormalizado.grupo, opcionNombre, grupoNormalizado)}
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
                              {opcionNombre}
                              {afectanPrecio && opcionPrecio > 0 ? `  +S/. ${opcionPrecio.toFixed(2)}` : ''}
                            </Text>
                          </TouchableOpacity>
                          {chipsVars}
                        </View>
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

          {/* v3.0: Footer con desglose de precios */}
          {afectanPrecio && preciosResumen.tieneExtras && (
            <View style={styles.precioResumenContainer}>
              <View style={styles.precioResumenRow}>
                <Text style={styles.precioResumenLabel}>Precio base</Text>
                <Text style={styles.precioResumenValor}>S/. {basePlato.toFixed(2)}</Text>
              </View>
              <View style={styles.precioResumenRow}>
                <Text style={styles.precioResumenLabel}>Complementos</Text>
                <Text style={styles.precioResumenValor}>+S/. {preciosResumen.extra.toFixed(2)}</Text>
              </View>
              <View style={[styles.precioResumenRow, styles.precioResumenTotalRow]}>
                <Text style={styles.precioResumenTotalLabel}>Total unitario</Text>
                <Text style={styles.precioResumenTotalValor}>S/. {preciosResumen.unitario.toFixed(2)}</Text>
              </View>
              {(nClones > 1 || (sumaMixLibre && mixSum > 1)) && (
                <View style={[styles.precioResumenRow, styles.precioResumenTotalRow]}>
                  <Text style={styles.precioResumenTotalLabel}>Total × {factorPedido}</Text>
                  <Text style={styles.precioResumenTotalValor}>
                    S/. {totalOrdenMostrar.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

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
                (!obligatoriosCompletos || hayErrores || !serieValida) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmar}
              disabled={!obligatoriosCompletos || hayErrores || !serieValida}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="check"
                size={20}
                color={theme.colors.text.white}
              />
              <Text style={styles.confirmButtonText}>
                {modoEdicion
                  ? "Guardar cambios"
                  : (factorPedido > 1 ? `Agregar ${factorPedido} a la orden` : "Agregar a la orden")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mensaje si faltan obligatorios */}
          {requiereSerie && !serieValida && (
            <View style={styles.warningContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color={theme.colors.warning}
              />
              <Text style={styles.warningText}>
                Ingresa el número de serie (2 a 4 dígitos)
              </Text>
            </View>
          )}
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalComplementosStyles = (theme) =>
  StyleSheet.create({
    keyboardWrap: {
      flex: 1,
    },
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
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginLeft: 8,
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
    cloneBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    cloneBarText: {
      flex: 1,
      minWidth: 0,
    },
    cloneTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    cloneTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    cloneHint: {
      fontSize: 11,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    totalesBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: theme.spacing.lg,
      paddingRight: 2,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    totalesBarTextWrap: {
      flex: 1,
      minWidth: 0,
      marginRight: 6,
    },
    totalesBarTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.primary,
      marginBottom: 2,
    },
    totalesBarText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      gap: 4,
    },
    comboPreview: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      gap: 2,
    },
    comboPreviewLine: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      fontWeight: "600",
    },
    comboPreviewOk: {
      color: theme.colors.text.primary,
    },
    qtyBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    qtyText: {
      fontSize: 18,
      fontWeight: "700",
      minWidth: 22,
      textAlign: "center",
      color: theme.colors.text.primary,
    },
    cloneControls: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cloneBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    cloneCount: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text.primary,
      minWidth: 36,
      textAlign: "center",
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
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    opcionConVariacionesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      flexGrow: 1,
      flexShrink: 1,
    },
    variacionChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      minHeight: 36,
      justifyContent: "center",
    },
    variacionChipSelected: {
      backgroundColor: theme.colors.secondary,
      borderColor: theme.colors.secondary,
    },
    variacionText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.text.primary,
    },
    variacionTextSelected: {
      color: theme.colors.text.white,
      fontWeight: "600",
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
    cantidadTotalHint: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.primary,
      minWidth: 28,
    },
    serieContainer: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    modalScrollViewTeclado: {
      maxHeight: 160,
    },
    serieLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    serieHint: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.sm,
    },
    serieInput: {
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 4,
      color: theme.colors.text.primary,
      textAlign: "center",
    },
    serieInputError: {
      borderColor: theme.colors.warning || "#f59e0b",
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
    // v3.0: estilos para el resumen de precios en el footer
    precioResumenContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    precioResumenRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    precioResumenLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    precioResumenValor: {
      fontSize: 12,
      color: theme.colors.text.primary,
      fontWeight: "500",
    },
    precioResumenTotalRow: {
      marginTop: 4,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    precioResumenTotalLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    precioResumenTotalValor: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.secondary,
    },
  });

export default ModalComplementos;
