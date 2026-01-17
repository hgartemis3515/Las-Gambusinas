const baseTheme = {
  primary: '#C41E3A',        // Rojo principal
  primaryLight: '#E85A6F',   // Variante más clara
  secondary: '#00C851',      // Verde para éxito
  accent: '#00D4FF',         // Azul para acciones
  warning: '#FF9500',        // Naranja para advertencias
  // Estados de mesas
  mesaEstado: {
    libre: '#9E9E9E',        // Gris - Libre
    esperando: '#FFC107',    // Amarillo - Esperando
    pedido: '#2196F3',       // Azul - Pedido
    preparado: '#FFC107',    // Amarillo - Preparado
    pagando: '#00C851',      // Verde - Pagando
    reservado: '#9C27B0',    // Morado - Reservado
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
  },
};

// Tema Claro
export const themeLight = {
  ...baseTheme,
  colors: {
    ...baseTheme,
    background: '#F8F9FA',     // Fondo claro
    surface: '#FFFFFF',        // Superficie blanca
    text: {
      primary: '#1A1A1A',      // Texto principal
      secondary: '#666666',     // Texto secundario
      light: '#999999',         // Texto claro
      white: '#FFFFFF',         // Texto blanco
    },
    border: '#E0E0E0',         // Bordes
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
};

// Tema Oscuro
export const themeDark = {
  ...baseTheme,
  colors: {
    ...baseTheme,
    background: '#1A1A1A',     // Fondo oscuro
    surface: '#2A2A2A',        // Superficie oscura
    text: {
      primary: '#FFFFFF',      // Texto principal (blanco)
      secondary: '#B0B0B0',     // Texto secundario (gris claro)
      light: '#808080',         // Texto claro (gris)
      white: '#FFFFFF',         // Texto blanco
    },
    border: '#404040',         // Bordes oscuros
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
};

// Estilos de texto forzados para iconos y botones
export const textIconos = {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: '600',
  lineHeight: 18,
  textAlign: 'center',
  textShadowColor: 'rgba(0,0,0,0.3)',
  textShadowOffset: {width: 0, height: 1},
  textShadowRadius: 2,
  includeFontPadding: false,
};

export const iconoRojo = {
  color: '#FF4444',
  fontSize: 16,
  fontWeight: 'bold',
};

export const iconoVerde = {
  color: '#00C851',
  fontSize: 14,
  fontWeight: '600',
};

export const iconoCeleste = {
  color: '#2196F3',
  fontSize: 14,
  fontWeight: '600',
};

export const bottomNavText = {
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: '500',
  marginTop: 2,
  includeFontPadding: false,
};

// Exportar tema por defecto (claro) para compatibilidad
export const theme = themeLight;

