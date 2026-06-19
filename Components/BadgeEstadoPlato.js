import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Componente Badge para mostrar el estado de un plato
 * Colores consistentes con el sistema de estados
 */
const BadgeEstadoPlato = ({ estado }) => {
  // Configuración de colores y textos según estado
  const config = {
    pedido: {
      color: '#3B82F6',       // Azul
      bgColor: '#DBEAFE',     // Azul claro
      texto: 'Pedido',
      icon: '⏳'
    },
    en_espera: {              // Alias de "pedido"
      color: '#3B82F6',
      bgColor: '#DBEAFE',
      texto: 'En Espera',
      icon: '⏳'
    },
    recoger: {
      color: '#F59E0B',       // Naranja
      bgColor: '#FEF3C7',     // Naranja claro
      texto: 'Recoger',
      icon: '🍽️'
    },
    salio: {
      color: '#FFFFFF',       // Blanco
      bgColor: '#10B981',     // Verde
      texto: 'Salió',
      icon: '🚶'
    },
    entregado: {
      color: '#FFFFFF',       // Blanco
      bgColor: '#065F46',     // Verde oscuro
      texto: 'Entregado',
      icon: '✅'
    },
    pagado: {
      color: '#6B7280',       // Gris
      bgColor: '#F3F4F6',     // Gris claro
      texto: 'Pagado',
      icon: '💰'
    }
  };
  
  // Normalizar estado (en_espera -> pedido)
  const estadoNormalizado = estado === 'en_espera' ? 'pedido' : estado;
  const estadoConfig = config[estadoNormalizado] || config.pedido;
  
  return (
    <View style={[styles.badge, { backgroundColor: estadoConfig.bgColor }]}>
      <Text style={styles.icon}>{estadoConfig.icon}</Text>
      <Text style={[styles.texto, { color: estadoConfig.color }]}>
        {estadoConfig.texto}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4
  },
  icon: {
    fontSize: 12
  },
  texto: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase'
  }
});

export default BadgeEstadoPlato;

