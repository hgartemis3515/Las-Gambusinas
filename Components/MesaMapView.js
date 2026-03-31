/**
 * MesaMapView - Componente de mapa de mesas con posicionamiento absoluto
 * Renderiza las mesas en sus posiciones configuradas por el admin
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

// Tamaño de referencia del canvas del admin (para escalado)
const CANVAS_REFERENCE = { width: 800, height: 600 };

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
 * Componente principal del mapa
 */
const MesaMapView = ({
  mesas = [],
  areaId = null,
  onMesaPress,
  style,
}) => {
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;
  const isDark = themeContext?.isDarkMode || false;
  
  const [mapaConfig, setMapaConfig] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: SCREEN_WIDTH - 32, height: 500 });
  
  // Calcular factor de escala
  const scale = useMemo(() => {
    return Math.min(
      canvasSize.width / CANVAS_REFERENCE.width,
      canvasSize.height / CANVAS_REFERENCE.height
    );
  }, [canvasSize]);
  
  // Cargar configuración del mapa desde el backend
  const cargarMapa = useCallback(async () => {
    if (!areaId) {
      // Si no hay área seleccionada, usar las mesas que ya tienen mapaConfig
      const mesasConMapa = mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null);
      setMapaConfig(mesasConMapa);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const mesasApiUrl = getMesasAPI();
      const response = await axios.get(`${mesasApiUrl}/mapa?area=${areaId}`, { timeout: 10000 });
      if (response.data?.success && response.data.mesas) {
        setMapaConfig(response.data.mesas.filter(m => m.mapaConfig?.x != null && m.mapaConfig?.y != null));
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
  }, [areaId, mesas]);
  
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
  if (mapaConfig.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, style]}>
        <MaterialCommunityIcons name="map-marker-off" size={48} color={theme.colors.text.muted} />
        <Text style={styles.emptyText}>Mapa no configurado para esta área</Text>
        <Text style={styles.emptySubtext}>El administrador debe configurar el mapa primero</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.canvas,
          { 
            width: Math.max(canvasSize.width, CANVAS_REFERENCE.width * scale),
            height: Math.max(canvasSize.height, CANVAS_REFERENCE.height * scale)
          }
        ]}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={true}
      >
        {/* Grid de fondo (opcional) */}
        <View style={styles.gridBackground}>
          {Array.from({ length: Math.ceil(canvasSize.height / 25) }).map((_, row) => (
            <View key={`row-${row}`} style={styles.gridRow}>
              {Array.from({ length: Math.ceil(canvasSize.width / 25) }).map((_, col) => (
                <View key={`cell-${row}-${col}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
        
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
      <View style={styles.legend}>
        {['Libre', 'Pedido', 'Preparado', 'Pagado'].map((estado) => {
          const colores = obtenerColoresEstadoAdaptados(estado, isDark, true);
          return (
            <View key={estado} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colores.backgroundColor }]} />
              <Text style={styles.legendText}>{estado}</Text>
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
    opacity: 0.1,
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    color: '#666',
  },
});

export default MesaMapView;
