import { FadeIn, SlideInRight, SlideInUp, SlideInBottom, FadeInDown } from 'react-native-reanimated';

/**
 * Presets de animaciones reutilizables para la app Las Gambusinas
 * Optimizado para 60fps con Reanimated 3 + Gesture Handler 2 + Moti
 */

// Preset para tap de mesa
export const mesaTap = {
  scale: [1, 1.05, 1],
  timing: { duration: 200 }
};

// Fade in con delay basado en índice (cascade effect)
export const fadeInDelay = (index) => 
  FadeIn.delay(index * 50).duration(400);

// Slide in right con delay (para mesas)
export const slideInRightDelay = (index) =>
  SlideInRight.delay(index * 40).duration(400);

// Slide in up para carrito
export const slideInUpCart = () =>
  SlideInUp.duration(400);

// Slide in bottom para modales
export const slideInBottomModal = () =>
  SlideInBottom.duration(400);

// Fade in down para lista de platos
export const fadeInDownPlato = (index) =>
  FadeInDown.duration(300).delay(index * 30);

// Configuración de spring suave
export const springConfig = {
  mass: 0.8,
  damping: 15,
  stiffness: 100,
  overshootClamping: false,
};

// Configuración de spring rápido
export const springFast = {
  mass: 0.5,
  damping: 12,
  stiffness: 150,
};

// Configuración de timing suave
export const timingConfig = {
  duration: 300,
  easing: (t) => t * (2 - t), // ease-out
};

// Easing para counter de dinero
export const moneyEasing = (t) => {
  'worklet';
  return t * (2 - t); // ease-out
};

