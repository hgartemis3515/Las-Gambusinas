import React from 'react';
import { View, Text, Image, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { POS_BRAND, POS_LOGO_GRADIENT, POS_LOGO_GRADIENT_LOCATIONS } from '../constants/posBrand';
import LogoPosSvg from '../assets/logo-pos.svg';

const LOGO_PNG = require('../assets/icon.png');

/**
 * Logo POS — asset SVG (login), vector (código) o PNG.
 * @param {'svg'|'vector'|'image'} variant — 'svg' usa assets/logo-pos.svg
 */
export default function PosLogo({
  width = 120,
  height = 60,
  variant = 'svg',
  style,
}) {
  if (variant === 'svg') {
    return (
      <LogoPosSvg
        width={width}
        height={height}
        style={style}
        accessibilityLabel="Logo POS"
      />
    );
  }

  const borderRadius = Math.round(height * 0.27);
  const fontSize = Math.round(height * 0.55);

  if (variant === 'image') {
    return (
      <Image
        source={LOGO_PNG}
        style={[{ width, height, resizeMode: 'contain' }, style]}
        accessibilityLabel="Logo POS"
      />
    );
  }

  return (
    <View
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius,
          borderColor: POS_BRAND.border,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={POS_LOGO_GRADIENT}
        locations={POS_LOGO_GRADIENT_LOCATIONS}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.fill, { borderRadius: Math.max(0, borderRadius - 3) }]}
      >
        <Text
          style={[
            styles.label,
            {
              fontSize,
              color: POS_BRAND.text,
              textShadowColor: POS_BRAND.textShadow,
            },
          ]}
        >
          POS
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: POS_BRAND.glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  fill: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
