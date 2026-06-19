import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { themeLight } from '../../constants/theme';
import {
  getPushNotificationsPrefEnabled,
  setPushNotificationsPrefEnabled,
  registerPushAfterLogin,
  isExpoGoPushLimited,
  getPushPlatoListoEnabled,
  setPushPlatoListoEnabled,
  getPushPlatoSalioEnabled,
  setPushPlatoSalioEnabled,
  getPushComandaListaEnabled,
  setPushComandaListaEnabled,
  getPushSonidoEnabled,
  setPushSonidoEnabled,
  getPushVibracionEnabled,
  setPushVibracionEnabled,
  openBatteryOptimizationSettings,
} from '../../services/pushNotifications';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const themeContext = useTheme();
  const theme = themeContext?.theme || themeLight;

  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushPlatoListo, setPushPlatoListo] = useState(true);
  const [pushPlatoSalio, setPushPlatoSalio] = useState(true);
  const [pushComandaLista, setPushComandaLista] = useState(true);
  const [pushSonido, setPushSonido] = useState(true);
  const [pushVibracion, setPushVibracion] = useState(true);
  const expoPushLimited = isExpoGoPushLimited();

  const appVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || '—';

  useEffect(() => {
    (async () => {
      setPushEnabled(await getPushNotificationsPrefEnabled());
      setPushPlatoListo(await getPushPlatoListoEnabled());
      setPushPlatoSalio(await getPushPlatoSalioEnabled());
      setPushComandaLista(await getPushComandaListaEnabled());
      setPushSonido(await getPushSonidoEnabled());
      setPushVibracion(await getPushVibracionEnabled());
    })();
  }, []);

  const onTogglePush = async (value) => {
    Haptics.selectionAsync();
    setPushEnabled(value);
    await setPushNotificationsPrefEnabled(value);
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="bell" size={28} color="#fff" />
          <Text style={styles.headerTitle}>Notificaciones</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Switch principal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificaciones push</Text>
          <View style={[styles.card, styles.highlightCard]}>
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '18' }]}>
                <MaterialCommunityIcons name="bell-ring-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.cardTitle}>Recibir notificaciones</Text>
                <Text style={styles.cardDesc}>
                  {pushEnabled ? 'Activado' : 'Desactivado'}
                </Text>
                {expoPushLimited ? (
                  <Text style={styles.limitedHint}>Limitado en Expo Go (usa build nativo)</Text>
                ) : null}
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={onTogglePush}
                trackColor={{ false: '#767577', true: theme.colors.primary }}
                thumbColor={pushEnabled ? theme.colors.text.white : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Sub-opciones */}
        {pushEnabled ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipos de aviso</Text>

            {/* Plato listo */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#FF6B3520' }]}>
                  <MaterialCommunityIcons name="food" size={20} color="#FF6B35" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>🍽️ Plato listo</Text>
                  <Text style={styles.cardDesc}>
                    Cuando cocina marca un plato como listo para recoger
                  </Text>
                </View>
                <Switch
                  value={pushPlatoListo}
                  onValueChange={async (v) => {
                    Haptics.selectionAsync();
                    setPushPlatoListo(v);
                    await setPushPlatoListoEnabled(v);
                  }}
                  trackColor={{ false: '#767577', true: theme.colors.primary }}
                  thumbColor={pushPlatoListo ? theme.colors.text.white : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Plato salió de cocina */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#10B98120' }]}>
                  <MaterialCommunityIcons name="walk" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>🚶 Plato salió de cocina</Text>
                  <Text style={styles.cardDesc}>
                    Cuando un plato sale de cocina y está listo para entregar al comensal
                  </Text>
                </View>
                <Switch
                  value={pushPlatoSalio}
                  onValueChange={async (v) => {
                    Haptics.selectionAsync();
                    setPushPlatoSalio(v);
                    await setPushPlatoSalioEnabled(v);
                  }}
                  trackColor={{ false: '#767577', true: theme.colors.primary }}
                  thumbColor={pushPlatoSalio ? theme.colors.text.white : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Comanda lista */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#4CAF5020' }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#4CAF50" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>✅ Comanda completa</Text>
                  <Text style={styles.cardDesc}>
                    Cuando todos los platos de una comanda están listos
                  </Text>
                </View>
                <Switch
                  value={pushComandaLista}
                  onValueChange={async (v) => {
                    Haptics.selectionAsync();
                    setPushComandaLista(v);
                    await setPushComandaListaEnabled(v);
                  }}
                  trackColor={{ false: '#767577', true: theme.colors.primary }}
                  thumbColor={pushComandaLista ? theme.colors.text.white : '#f4f3f4'}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Sonido y vibración</Text>

            {/* Sonido */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#2196F320' }]}>
                  <MaterialCommunityIcons name="volume-high" size={20} color="#2196F3" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>🔔 Sonido</Text>
                  <Text style={styles.cardDesc}>
                    Reproducir sonido al recibir una notificación
                  </Text>
                </View>
                <Switch
                  value={pushSonido}
                  onValueChange={async (v) => {
                    Haptics.selectionAsync();
                    setPushSonido(v);
                    await setPushSonidoEnabled(v);
                  }}
                  trackColor={{ false: '#767577', true: theme.colors.primary }}
                  thumbColor={pushSonido ? theme.colors.text.white : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Vibración */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#9C27B020' }]}>
                  <MaterialCommunityIcons name="vibrate" size={20} color="#9C27B0" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>📳 Vibración</Text>
                  <Text style={styles.cardDesc}>
                    Vibrar el dispositivo al recibir una notificación
                  </Text>
                </View>
                <Switch
                  value={pushVibracion}
                  onValueChange={async (v) => {
                    Haptics.selectionAsync();
                    setPushVibracion(v);
                    await setPushVibracionEnabled(v);
                  }}
                  trackColor={{ false: '#767577', true: theme.colors.primary }}
                  thumbColor={pushVibracion ? theme.colors.text.white : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Ajustes del sistema */}
            <TouchableOpacity
              style={[styles.card, styles.settingsCard]}
              onPress={() => { Haptics.selectionAsync(); openBatteryOptimizationSettings(); }}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.text.secondary + '20' }]}>
                  <MaterialCommunityIcons name="cog-outline" size={20} color={theme.colors.text.secondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardTitle}>Ajustes del sistema</Text>
                  <Text style={styles.cardDesc}>
                    Abrir configuración de notificaciones de Android
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.disabledCard}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.colors.text.secondary} />
              <Text style={styles.disabledTitle}>Notificaciones desactivadas</Text>
              <Text style={styles.disabledDesc}>
                Activa el interruptor superior para recibir avisos cuando tus platos estén listos para recoger.
              </Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.text.secondary} />
              <Text style={styles.infoText}>
                Las notificaciones se reciben tanto si la app está abierta como en segundo plano. Al tocar una notificación, se abre directamente la mesa correspondiente.
              </Text>
            </View>
          </View>
          <View style={[styles.card, { marginTop: 8 }]}>
            <View style={styles.cardRow}>
              <MaterialCommunityIcons name="cellphone" size={20} color={theme.colors.text.secondary} />
              <Text style={styles.infoText}>
                v{appVersion} · Canal OTA: preview
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingTop: 16,
      paddingBottom: 20,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    highlightCard: {
      borderColor: theme.colors.primary + '40',
      backgroundColor: theme.colors.primary + '08',
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    cardDesc: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      lineHeight: 16,
    },
    limitedHint: {
      fontSize: 11,
      color: theme.colors.warning,
      marginTop: 2,
    },
    settingsCard: {
      paddingVertical: 14,
    },
    disabledCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    disabledTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginTop: 12,
      marginBottom: 6,
    },
    disabledDesc: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    infoText: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      lineHeight: 18,
      flex: 1,
      marginLeft: 8,
    },
  });

export default NotificationsScreen;