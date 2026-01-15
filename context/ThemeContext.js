import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeLight, themeDark } from '../constants/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  try {
    const context = useContext(ThemeContext);
    if (!context || !context.theme) {
      // Retornar tema por defecto si el contexto no está disponible
      console.warn('ThemeContext no disponible, usando tema por defecto');
      return { theme: themeLight, isDarkMode: false, toggleTheme: () => {} };
    }
    return context;
  } catch (error) {
    console.error('Error en useTheme:', error);
    return { theme: themeLight, isDarkMode: false, toggleTheme: () => {} };
  }
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Inicializar con themeLight desde el inicio
  const [theme, setTheme] = useState(() => themeLight);

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    const newTheme = isDarkMode ? themeDark : themeLight;
    setTheme(newTheme);
  }, [isDarkMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('themeMode', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Asegurar que siempre hay un tema válido con todas las propiedades necesarias
  const currentTheme = (theme && theme.colors && theme.spacing) ? theme : themeLight;

  // Validar que el tema tenga todas las propiedades necesarias
  if (!currentTheme.colors || !currentTheme.spacing) {
    console.error('Tema no tiene la estructura correcta, usando themeLight');
  }

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

