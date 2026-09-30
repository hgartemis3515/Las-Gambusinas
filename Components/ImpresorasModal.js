import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { themeLight } from '../constants/theme';
import {
  guardarImpresorasTermicas,
  ipImpresoraValida,
  leerImpresorasTermicas,
} from '../config/impresorasTermicas';
import { imprimirEposEnIp, xmlPruebaEpos } from '../utils/eposPrintHttp';

const CAMPOS = [
  { key: 'cocina', titulo: 'Cocina', modelo: 'TM-m30III', prueba: 'PRUEBA COCINA' },
  { key: 'caja', titulo: 'Caja', modelo: 'TM-m30II', prueba: 'PRUEBA CAJA' },
];

export default function ImpresorasModal({ visible, onClose, onSaved }) {
  const theme = useTheme()?.theme || themeLight;
  const [ips, setIps] = useState({ cocina: '', caja: '' });
  const [estado, setEstado] = useState({ cocina: '', caja: '' });
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    setAviso('');
    setEstado({ cocina: '', caja: '' });
    leerImpresorasTermicas().then((cfg) => {
      if (!vivo) return;
      setIps({ cocina: cfg.cocina.ip, caja: cfg.caja.ip });
    });
    return () => {
      vivo = false;
    };
  }, [visible]);

  const probar = async (campo) => {
    const ip = String(ips[campo.key] || '').trim();
    if (!ip || !ipImpresoraValida(ip)) {
      setEstado((prev) => ({ ...prev, [campo.key]: 'Escribe una IPv4.' }));
      return;
    }
    setOcupado(campo.key);
    setEstado((prev) => ({ ...prev, [campo.key]: 'Enviando…' }));
    try {
      await imprimirEposEnIp(ip, xmlPruebaEpos(campo.prueba));
      setEstado((prev) => ({ ...prev, [campo.key]: 'Salió el papel de prueba.' }));
    } catch (e) {
      setEstado((prev) => ({ ...prev, [campo.key]: e?.message || 'No se pudo imprimir.' }));
    } finally {
      setOcupado(null);
    }
  };

  const guardar = async () => {
    if (!ipImpresoraValida(ips.cocina) || !ipImpresoraValida(ips.caja)) {
      setAviso('Cada IP tiene que ser IPv4, o quedar vacía.');
      return;
    }
    setOcupado('guardar');
    setAviso('');
    try {
      const next = await guardarImpresorasTermicas({
        cocina: { ip: ips.cocina },
        caja: { ip: ips.caja },
      });
      onSaved?.(next);
      onClose?.();
    } catch (e) {
      setAviso(e?.message || 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="printer" size={28} color={theme.colors.primary} />
            <Text style={[styles.titulo, { color: theme.colors.text.primary }]}>Impresoras</Text>
            <TouchableOpacity onPress={onClose} style={styles.cerrar} accessibilityLabel="Cerrar">
              <MaterialCommunityIcons name="close" size={28} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cuerpo}>
            <Text style={[styles.ayuda, { color: theme.colors.text.secondary }]}>
              Cocina imprime el ticket con cuadrados. Caja imprime el ticket con precios.
              Vacío omite ese papel.
            </Text>
            {CAMPOS.map((campo) => (
              <View key={campo.key} style={styles.bloque}>
                <Text style={[styles.label, { color: theme.colors.text.primary }]}>
                  {campo.titulo} · {campo.modelo}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text.primary,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  value={ips[campo.key]}
                  onChangeText={(text) => {
                    setIps((prev) => ({ ...prev, [campo.key]: text }));
                    setEstado((prev) => ({ ...prev, [campo.key]: '' }));
                  }}
                  placeholder="192.168.50.0"
                  placeholderTextColor={theme.colors.text.light}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel={`IP ${campo.titulo}`}
                />
                <TouchableOpacity
                  style={[styles.probar, { borderColor: theme.colors.primary }]}
                  onPress={() => probar(campo)}
                  disabled={ocupado != null}
                  accessibilityLabel={`Probar ${campo.titulo}`}
                >
                  {ocupado === campo.key ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={[styles.probarTexto, { color: theme.colors.primary }]}>Probar</Text>
                  )}
                </TouchableOpacity>
                {estado[campo.key] ? (
                  <Text style={[styles.estado, { color: theme.colors.text.secondary }]}>
                    {estado[campo.key]}
                  </Text>
                ) : null}
              </View>
            ))}
            {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
            <TouchableOpacity
              style={[styles.guardar, { backgroundColor: theme.colors.primary }]}
              onPress={guardar}
              disabled={ocupado != null}
              accessibilityLabel="Guardar impresoras"
            >
              {ocupado === 'guardar' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.guardarTexto}>Guardar</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  titulo: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  cerrar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuerpo: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  ayuda: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  bloque: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    fontSize: 18,
  },
  probar: {
    marginTop: 8,
    minHeight: 48,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probarTexto: {
    fontSize: 16,
    fontWeight: '700',
  },
  estado: {
    fontSize: 14,
    marginTop: 6,
  },
  aviso: {
    color: '#B91C1C',
    fontSize: 14,
    marginBottom: 8,
  },
  guardar: {
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  guardarTexto: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
