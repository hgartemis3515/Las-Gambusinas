import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { colors } from '../../constants/colors';
import { checkAndApplyOtaUpdate, getOtaRuntimeInfo } from '../../services/otaUpdates';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const APP_VERSION = Constants.expoConfig?.version || '1.0.1';

// Partículas flotantes de fondo
const FloatingParticle = ({ delay, startY }) => {
  const translateY = useSharedValue(startY || SCREEN_HEIGHT + 20);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(Math.random() * SCREEN_WIDTH);

  useEffect(() => {
    const duration = 4000 + Math.random() * 3000;
    translateY.value = withRepeat(
      withTiming(-40, { duration, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(0.5, { duration: duration * 0.3 }),
        withTiming(0.3, { duration: duration * 0.4 }),
        withTiming(0, { duration: duration * 0.3 })
      ),
      -1,
      false
    );
    translateX.value = withRepeat(
      withSequence(
        withTiming(translateX.value + (Math.random() - 0.5) * 60, { duration }),
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    />
  );
};

export default function SplashScreen({ onFinish }) {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const barWidth = useSharedValue(0);
  const barOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const [status, setStatus] = useState('Inicializando...');
  const [progress, setProgress] = useState(0);
  const [hasUpdate, setHasUpdate] = useState(false);
  const particles = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: i * 300,
      startY: SCREEN_HEIGHT + Math.random() * 100,
    }))
  ).current;

  useEffect(() => {
    // Fase 1: Logo aparece
    logoScale.value = withSpring(1, { damping: 10, stiffness: 80, mass: 0.8 });
    logoOpacity.value = withTiming(1, { duration: 600 });

    // Fase 2: Texto aparece
    setTimeout(() => {
      textOpacity.value = withTiming(1, { duration: 500 });
      textTranslateY.value = withSpring(0, { damping: 12, stiffness: 100 });
    }, 400);

    // Fase 3: Barra de carga
    setTimeout(() => {
      barOpacity.value = withTiming(1, { duration: 300 });
    }, 700);

    // Pulso continuo del logo
    setTimeout(() => {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    }, 800);

    // Fase 4: Subtítulo
    setTimeout(() => {
      subtitleOpacity.value = withTiming(1, { duration: 400 });
    }, 1000);

    // Inicializar app en paralelo
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Paso 1: Cargar recursos
      setStatus('Cargando recursos...');
      setProgress(20);
      await new Promise(r => setTimeout(r, 400));

      // Paso 2: Verificar OTA (solo en release)
      setStatus('Verificando actualizaciones...');
      setProgress(45);

      if (!__DEV__) {
        try {
          const updateCheck = await Updates.checkForUpdateAsync();
          if (updateCheck.isAvailable) {
            setHasUpdate(true);
            setStatus('Descargando actualización...');
            setProgress(55);
            await Updates.fetchUpdateAsync();
            setProgress(80);
            setStatus('Actualización lista. Reiniciando...');
            await new Promise(r => setTimeout(r, 800));
            setProgress(100);
            await Updates.reloadAsync();
            return; // reloadAsync reinicia la app
          }
        } catch (e) {
            console.warn('[Splash] OTA check error:', e?.message);
          }
      }
      setProgress(70);

      // Paso 3: Preparar
      setStatus('Preparando aplicación...');
      await new Promise(r => setTimeout(r, 300));
      setProgress(90);

      // Paso 4: Listo
      setStatus('¡Listo!');
      setProgress(100);
      barWidth.value = withTiming(1, { duration: 400 });

      // Esperar a que termine la animación
      await new Promise(r => setTimeout(r, 600));

      // Sonido satisfactorio via haptic
      try {
        const { default: Haptics } = require('expo-haptics');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      onFinish?.();
    } catch (error) {
      console.warn('[Splash] Init error:', error?.message);
      setStatus('Listo');
      setProgress(100);
      barWidth.value = withTiming(1, { duration: 300 });
      setTimeout(() => onFinish?.(), 500);
    }
  };

  // Animar barra de progreso
  useEffect(() => {
    barWidth.value = withTiming(progress / 100, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
  }, [progress]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value * pulseScale.value },
    ],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const barContainerStyle = useAnimatedStyle(() => ({
    opacity: barOpacity.value,
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a1a', '#0d0d0d']}
      style={styles.container}
    >
      {/* Partículas flotantes */}
      {particles.map((p) => (
        <FloatingParticle key={p.id} delay={p.delay} startY={p.startY} />
      ))}

      {/* Glow de fondo */}
      <View style={styles.glowContainer}>
        <Animated.View style={[styles.glow, { opacity: 0.15 }]} />
      </View>

      {/* Logo animado */}
      <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../../assets/logo-splash.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Texto principal */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.appName}>Las Gambusinas</Text>
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          App Mozos
        </Animated.Text>
      </Animated.View>

      {/* Barra de progreso */}
      <Animated.View style={[styles.progressContainer, barContainerStyle]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, barFillStyle]}>
            <View style={styles.progressShine} />
          </Animated.View>
        </View>
        <Text style={styles.statusText} numberOfLines={1}>
          {status}
        </Text>
      </Animated.View>

      {/* Versión */}
      <Text style={styles.versionText}>
        v{APP_VERSION}
        {hasUpdate ? ' (actualizada)' : ''}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowContainer: {
    position: 'absolute',
    top: '25%',
    alignItems: 'center',
  },
  glow: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(196, 30, 58, 0.4)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  logo: {
    width: 100,
    height: 100,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  progressContainer: {
    width: '70%',
    maxWidth: 300,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: '40%',
  },
  statusText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  versionText: {
    position: 'absolute',
    top: 50,
    right: 16,
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.5,
  },
});