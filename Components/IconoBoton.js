import React from 'react';
import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, shadowStyle, shadowStyleHover } from '../constants/colors';

/**
 * Componente maestro para iconos con texto
 * Sistema profesional simétrico y responsive
 */
const IconoBoton = ({
  nombre,
  color,
  bgColor,
  size = 40,
  texto,
  iconoSize = 20,
  iconoName,
  active = false,
  onPress,
  disabled = false,
}) => {
  const { width } = useWindowDimensions();
  // Escala responsive: celular pequeño < 390px
  const escala = width < 390 ? 0.88 : width < 400 ? 0.92 : 1;
  
  const sizeFinal = size * escala;
  const iconoSizeFinal = iconoSize * escala;
  const fontSizeFinal = 10 * escala;
  const borderRadiusFinal = 12 * escala;
  
  // Color de fondo con opacidad si no se especifica
  const backgroundColorFinal = bgColor || (color ? `${color}20` : colors.surface);
  
  return (
    <View
      style={[
        styles.container,
        {
          width: sizeFinal,
          height: texto ? sizeFinal + (fontSizeFinal * 2) : sizeFinal,
          backgroundColor: backgroundColorFinal,
          borderRadius: borderRadiusFinal,
          opacity: disabled ? 0.5 : 1,
          ...(active ? shadowStyleHover : shadowStyle),
        },
      ]}
    >
      {iconoName ? (
        <MaterialCommunityIcons
          name={iconoName}
          size={iconoSizeFinal}
          color={color || colors.white}
        />
      ) : (
        <Text
          style={[
            styles.iconoEmoji,
            {
              fontSize: iconoSizeFinal,
              lineHeight: iconoSizeFinal * 1.2,
              color: color || colors.white,
            },
          ]}
        >
          {nombre}
        </Text>
      )}
      {texto && (
        <Text
          style={[
            styles.texto,
            {
              fontSize: fontSizeFinal,
              marginTop: 2 * escala,
              color: colors.white,
            },
          ]}
          numberOfLines={1}
        >
          {texto.toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  iconoEmoji: {
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
    includeFontPadding: false,
  },
  texto: {
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
});

export default IconoBoton;

