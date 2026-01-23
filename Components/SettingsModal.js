import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/apiConfig';

/**
 * Modal de Configuración de Servidor - Patrón Profesional
 * Inspirado en Square POS, Toast POS, Lightspeed Restaurant
 * 
 * Características:
 * - Test de conexión antes de guardar
 * - Validación estricta de URL
 * - Feedback visual del estado
 * - Persistencia automática
 */
const SettingsModal = ({ visible, onClose }) => {
  const [config, setConfig] = useState({
    baseURL: '',
    apiVersion: 'v1',
    timeout: '10000'
  });
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('idle'); // idle, testing, success, error
  const [testMessage, setTestMessage] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Cargar configuración actual al abrir el modal
  useEffect(() => {
    if (visible) {
      loadCurrentConfig();
    }
  }, [visible]);

  const loadCurrentConfig = async () => {
    try {
      const configJson = await AsyncStorage.getItem('apiConfig');
      if (configJson) {
        const savedConfig = JSON.parse(configJson);
        setConfig({
          baseURL: savedConfig.baseURL || '',
          apiVersion: savedConfig.apiVersion || 'v1',
          timeout: String(savedConfig.timeout || 10000)
        });
        setIsConfigured(apiConfig.isConfigured);
      } else {
        // Si no hay configuración, usar valores por defecto
        setConfig({
          baseURL: apiConfig.baseURL || 'http://192.168.18.11:3000/api',
          apiVersion: apiConfig.apiVersion || 'v1',
          timeout: String(apiConfig.timeout || 10000)
        });
        setIsConfigured(apiConfig.isConfigured);
      }
      setTestStatus('idle');
      setTestMessage('');
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const testConnection = async () => {
    if (!config.baseURL || !config.baseURL.trim()) {
      Alert.alert('⚠️ Error', 'Por favor, ingresa una URL válida');
      return;
    }

    setLoading(true);
    setTestStatus('testing');
    setTestMessage('Probando conexión...');

    try {
      // Crear instancia temporal para test
      const testConfig = {
        baseURL: config.baseURL.trim(),
        apiVersion: config.apiVersion,
        timeout: parseInt(config.timeout) || 10000
      };

      // Validar URL primero
      if (!apiConfig.validateURL(testConfig.baseURL)) {
        throw new Error('URL inválida. Debe ser una URL válida que contenga /api');
      }

      // Test de conexión con URL temporal
      const result = await apiConfig.testConnection(testConfig.baseURL);

      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message || '✅ Conexión exitosa');
      } else {
        setTestStatus('error');
        setTestMessage(result.message || '❌ Error de conexión');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error.message || '❌ Error al probar conexión');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config.baseURL || !config.baseURL.trim()) {
      Alert.alert('⚠️ Error', 'Por favor, ingresa una URL válida');
      return;
    }

    // Si no se ha probado la conexión, sugerir hacerlo
    if (testStatus !== 'success') {
      Alert.alert(
        '⚠️ Advertencia',
        'No se ha probado la conexión. ¿Deseas guardar de todas formas?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar', onPress: () => saveConfigInternal() }
        ]
      );
      return;
    }

    await saveConfigInternal();
  };

  const saveConfigInternal = async () => {
    try {
      const configToSave = {
        baseURL: config.baseURL.trim(),
        apiVersion: config.apiVersion,
        timeout: parseInt(config.timeout) || 10000
      };

      await apiConfig.setConfig(configToSave);
      setIsConfigured(true);
      
      Alert.alert(
        '✅ Configuración Guardada',
        'La configuración se ha guardado correctamente. La app usará esta configuración en el próximo inicio.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('❌ Error', error.message || 'No se pudo guardar la configuración');
    }
  };

  const resetConfig = async () => {
    Alert.alert(
      '🔄 Resetear Configuración',
      '¿Estás seguro de que deseas resetear la configuración a los valores por defecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetear',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiConfig.reset();
              await loadCurrentConfig();
              Alert.alert('✅ Configuración Reseteada', 'Se han restaurado los valores por defecto');
            } catch (error) {
              Alert.alert('❌ Error', 'No se pudo resetear la configuración');
            }
          }
        }
      ]
    );
  };

  const getTestStatusColor = () => {
    switch (testStatus) {
      case 'success': return '#22C55E';
      case 'error': return '#EF4444';
      case 'testing': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTestStatusIcon = () => {
    switch (testStatus) {
      case 'success': return 'check-circle';
      case 'error': return 'close-circle';
      case 'testing': return 'loading';
      default: return 'help-circle';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="cog" size={28} color="#C41E3A" />
              <Text style={styles.headerTitle}>Configuración del Servidor</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Estado actual */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Estado:</Text>
                <View style={[styles.statusBadge, { backgroundColor: isConfigured ? '#22C55E' : '#EF4444' }]}>
                  <Text style={styles.statusText}>
                    {isConfigured ? '✅ Configurado' : '⚠️ No Configurado'}
                  </Text>
                </View>
              </View>
              {apiConfig.baseURL && (
                <Text style={styles.statusURL}>{apiConfig.baseURL}</Text>
              )}
            </View>

            {/* Campo URL API */}
            <View style={styles.field}>
              <Text style={styles.label}>
                URL API Backend <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  !config.baseURL && styles.inputError
                ]}
                value={config.baseURL}
                onChangeText={(text) => {
                  setConfig({ ...config, baseURL: text });
                  setTestStatus('idle');
                  setTestMessage('');
                }}
                placeholder="http://192.168.18.11:3000/api"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.hint}>
                Ejemplo: http://192.168.18.11:3000/api o https://tu-servidor.com/api
              </Text>
            </View>

            {/* Campo Versión API */}
            <View style={styles.field}>
              <Text style={styles.label}>Versión API</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    config.apiVersion === 'v1' && styles.pickerOptionActive
                  ]}
                  onPress={() => setConfig({ ...config, apiVersion: 'v1' })}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    config.apiVersion === 'v1' && styles.pickerOptionTextActive
                  ]}>v1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    config.apiVersion === 'v2' && styles.pickerOptionActive
                  ]}
                  onPress={() => setConfig({ ...config, apiVersion: 'v2' })}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    config.apiVersion === 'v2' && styles.pickerOptionTextActive
                  ]}>v2</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Campo Timeout */}
            <View style={styles.field}>
              <Text style={styles.label}>Timeout (ms)</Text>
              <TextInput
                style={styles.input}
                value={config.timeout}
                onChangeText={(text) => {
                  // Solo permitir números
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setConfig({ ...config, timeout: numericValue });
                }}
                placeholder="10000"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
              <Text style={styles.hint}>
                Tiempo máximo de espera para peticiones (en milisegundos)
              </Text>
            </View>

            {/* Test de Conexión */}
            <View style={styles.testContainer}>
              <TouchableOpacity
                style={[
                  styles.testButton,
                  loading && styles.testButtonDisabled
                ]}
                onPress={testConnection}
                disabled={loading || !config.baseURL}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialCommunityIcons name="network" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.testButtonText}>
                  {loading ? 'Probando...' : '🧪 Probar Conexión'}
                </Text>
              </TouchableOpacity>

              {testMessage && (
                <View style={[styles.testStatusContainer, { borderColor: getTestStatusColor() }]}>
                  <MaterialCommunityIcons
                    name={getTestStatusIcon()}
                    size={20}
                    color={getTestStatusColor()}
                  />
                  <Text style={[styles.testMessage, { color: getTestStatusColor() }]}>
                    {testMessage}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Botones */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetConfig}
            >
              <MaterialCommunityIcons name="restore" size={20} color="#666" />
              <Text style={styles.resetButtonText}>Resetear</Text>
            </TouchableOpacity>
            <View style={styles.footerRight}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!config.baseURL || testStatus === 'error') && styles.saveButtonDisabled
                ]}
                onPress={saveConfig}
                disabled={!config.baseURL || testStatus === 'error'}
              >
                <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statusURL: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  pickerOptionActive: {
    borderColor: '#C41E3A',
    backgroundColor: '#FEF2F2',
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  pickerOptionTextActive: {
    color: '#C41E3A',
  },
  testContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  testStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  testMessage: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C41E3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SettingsModal;

