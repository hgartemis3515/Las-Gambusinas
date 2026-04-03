/**
 * MesaMapView - Componente de mapa de mesas con posicionamiento absoluto
 * Renderiza las mesas en sus posiciones configuradas por el admin
 * Soporte para secciones de layout y elementos decorativos
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { obtenerColoresEstadoAdaptados } from '../utils/comandaHelpers';
import axios from '../config/axiosConfig';
import { getMesasAPI } from '../apiConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tamaño de referencia del canvas del admin (por defecto)
const CANVAS_REFERENCE_DEFAULT = { width: 1600, height: 1200 };

/**
 * Componente individual de mesa en el mapa
 */
const MesaMapItem = React.memo(({ 
  mesa, 
  estado, 
  onPress, 
  scale,
  theme 
}) => {
  const config = mesa.mapaConfig || {};
  const isDark = theme?.dark || false;
  
  // Obtener colores según estado
  const colores = obtenerColoresEstadoAdaptados(estado, isDark, true);
  
  // Calcular posición y tamaño escalados
  const left = (config.x || 0) * scale;
  const top = (config.y || 0) * scale;
  const itemWidth = Math.max(44, (config.width || 80) * scale);
  const itemHeight = Math.max(44, (config.height || 80) * scale);
  
  const isRound = config.shape === 'round';
  
  return (
    <TouchableOpacity
      onPress={() => onPress(mesa)}
      activeOpacity={0.7}
      style={[
        styles.mesaItem,
        {
          left,
          top,
          width: itemWidth,
          height: itemHeight,
          backgroundColor: colores.backgroundColor,
          borderColor: colores.borderColor,
          borderRadius: isRound ? itemWidth / 2 : 12,
          zIndex: config.zIndex || 10,
          transform: [{ rotate: `${config.rotation || 0}deg` }],
        }
      ]}
    >
      <Text style={[styles.mesaNumber, { color: colores.textColor }]}>
        {mesa.nombreCombinado || `M${mesa.nummesa}`}
      </Text>
      <Text style={[styles.mesaEstado, { color: colores.textColor, opacity: 0.8 }]}>
        {estado}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Componente para renderizar items del layout (barreras, etiquetas, zonas)
 */
const LayoutItemView = React.memo(({ 
  item, 
  scale 
}) => {
  const left = (item.x || 0) * scale;
  const top = (item.y || 0) * scale;
  const itemWidth = (item.width || 100) * scale;
  const itemHeight = (item.height || 20) * scale;
  
  const isLabel = item.tipo === 'label';
  const isZone = item.tipo === 'zone';
  
  return (
    <View
      style={[
        styles.layoutItem,
        {
          left,
          top,
          width: itemWidth,
          height: itemHeight,
          backgroundColor: isLabel ? 'transparent' : (item.color || '#444'),
          opacity: item.opacity || 1,
          zIndex: item.zIndex || 1,
          borderRadius: isZone ? 8 : 4,
          transform: [{ rotate: `${item.rotation || 0}deg` }],
        }
      ]}
    >
      {isLabel && item.texto && (
        <Text style={[
          styles.labelText, 
          { 
            fontSize: (item.fontSize || 14) * scale,
            fontWeight: item.fontWeight || 'normal',
            color: item.color || '#ffffff'
          }
        ]}>
          {item.texto}
        </Text>
      )}
    </View>
  );
});

/**
 * Componente principal del mapa
 */
const MesaMapView = ({
  mesas = [],
  areaId = null,
  sectionId = null,
  sectionConfig = null,
  layoutItems = [],
  onMesaPress,
  style,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const isDark = themeContext?.isDarkMode || false;
  
  const [mapaConfig, setMapaConfig] = useState([]);
  const [itemsConfig, setItemsConfig] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: SCREEN_WIDTH - 32, height: 500 });
  
  // Configuración del canvas desde sección o valores por defecto
  const canvasReference = useMemo(() => ({
    width: sectionConfig?.canvasWidth || CANVAS_REFERENCE_DEFAULT.width,
    height: sectionConfig?.canvasHeight || CANVAS_REFERENCE_DEFAULT.height,
  }), [sectionConfig]);
  
  // Calcular factor de escala
  const scale = useMemo(() => {
    return Math.min(
      canvasSize.width / canvasReference.width,
      canvasSize.height / canvasReference.height
    );
  }, [canvasSize, canvasReference]);
  
  // Cargar configuración del mapa desde el backend
  const cargarMapa = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const mesasApiUrl = getMesasAPI();
      
      // Si hay sectionId, cargar por sección
      if (sectionId) {
        const response = await axios.get(`${mesasApiUrl}/mapa?sectionId=${sectionId}`, { timeout: 10000 });
        if (response.data?.success && response.data.mesas) {
          setMapaConfig(response.data.mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null));
        }
      } 
      // Si hay areaId, cargar por área
      else if (areaId) {
        const response = await axios.get(`${mesasApiUrl}/mapa?area=${areaId}`, { timeout: 10000 });
        if (response.data?.success && response.data.mesas) {
          setMapaConfig(response.data.mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null));
        }
      }
      // Fallback: usar mesas que ya tienen mapaConfig
      else {
        const mesasConMapa = mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null);
        setMapaConfig(mesasConMapa);
      }
      
      // Si hay layoutItems en props, usarlos; sino cargar del backend
      if (layoutItems && layoutItems.length > 0) {
        setItemsConfig(layoutItems);
      }
      
    } catch (err) {
      console.error('Error cargando mapa:', err);
      setError('No se pudo cargar el mapa');
      // Fallback a mesas locales con config
      const mesasConMapa = mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null);
      setMapaConfig(mesasConMapa);
    } finally {
      setLoading(false);
    }
  }, [sectionId, areaId, mesas, layoutItems]);
  
  useEffect(() => {
    cargarMapa();
  }, [cargarMapa]);
  
  // Obtener estado de mesa
  const getEstadoMesa = useCallback((mesa) => {
    const estadoMap = {
      'libre': 'Libre',
      'esperando': 'Ocupada',
      'pedido': 'Pedido',
      'preparado': 'Preparado',
      'pagado': 'Pagado',
      'reservado': 'Reservado'
    };
    return estadoMap[mesa.estado?.toLowerCase()] || mesa.estado || 'Libre';
  }, []);
  
  // Manejar layout del contenedor
  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width: width - 16, height: Math.max(400, height - 16) });
  };
  
  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando mapa...</Text>
      </View>
    );
  }
  
  // Sin configuración de mapa
  if (mapaConfig.length === 0 && itemsConfig.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <MaterialCommunityIcons name="map-marker-off" size={48} color={theme.colors.text.muted} />
        <Text style={styles.emptyText}>Mapa no configurado para esta área</Text>
        <Text style={styles.emptySubtext}>El administrador debe configurar el mapa primero</Text>
      </View>
    );
  }
  
  // Color de fondo desde configuración
  const backgroundColor = sectionConfig?.color || theme.colors.background;
  
  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.canvas,
          { 
            width: Math.max(canvasSize.width, canvasReference.width * scale),
            height: Math.max(canvasSize.height, canvasReference.height * scale),
            backgroundColor: backgroundColor,
          }
        ]}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={true}
      >
        {/* Grid de fondo */}
        <View style={[styles.gridBackground, { opacity: 0.05 }]}>
          {Array.from({ length: Math.ceil(canvasReference.height / 25) }).map((_, row) => (
            <View key={`row-${row}`} style={styles.gridRow}>
              {Array.from({ length: Math.ceil(canvasReference.width / 25) }).map((_, col) => (
                <View key={`cell-${row}-${col}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
        
        {/* Layout Items (barreras, etiquetas, zonas) */}
        {itemsConfig.map((item) => (
          <LayoutItemView
            key={item._id || `item-${item.x}-${item.y}`}
            item={item}
            scale={scale}
          />
        ))}
        
        {/* Mesas */}
        {mapaConfig.map((mesa) => (
          <MesaMapItem
            key={mesa._id}
            mesa={mesa}
            estado={getEstadoMesa(mesa)}
            onPress={onMesaPress}
            scale={scale}
            theme={theme}
          />
        ))}
      </ScrollView>
      
      {/* Leyenda */}
      <View style={[styles.legend, { borderTopColor: theme.colors.border }]}>
        {['Libre', 'Pedido', 'Preparado', 'Pagado'].map((estado) => {
          const colores = obtenerColoresEstadoAdaptados(estado, isDark, true);
          return (
            <View key={estado} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colores.backgroundColor }]} />
              <Text style={[styles.legendText, { color: theme.colors.text.secondary }]}>{estado}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  canvas: {
    position: 'relative',
    padding: 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    width: 25,
    height: 25,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  mesaItem: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mesaNumber: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  mesaEstado: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  layoutItem: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
  },
});

export default MesaMapView;
