import React, { useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { enviarMensajeVoz } from '../services/chatService';

class AudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}

function GrabadorInner({ convId, prioridad, onEnviado, colors, styles }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const grabacionRef = useRef(null);
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [estadoVoz, setEstadoVoz] = useState('idle');

  const detenerYEnviar = async () => {
    try {
      const rec = grabacionRef.current;
      if (!rec) return;
      await rec.stop();
      const uri = rec.uri;
      grabacionRef.current = null;
      setGrabandoVoz(false);
      setEstadoVoz('enviando');
      if (uri && convId) {
        await enviarMensajeVoz(convId, uri, prioridad);
        if (onEnviado) await onEnviado();
      }
    } catch (_) { /* ignore */ }
    setEstadoVoz('idle');
  };

  const iniciarGrabacion = async () => {
    if (grabandoVoz) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso al micrófono');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      grabacionRef.current = recorder;
      setGrabandoVoz(true);
      setEstadoVoz('grabando');
      setTimeout(async () => {
        if (grabacionRef.current) await detenerYEnviar();
      }, 60000);
    } catch (e) {
      setGrabandoVoz(false);
      setEstadoVoz('idle');
      Alert.alert('Error', 'No se pudo grabar audio');
    }
  };

  return (
    <TouchableOpacity
      onPress={grabandoVoz ? detenerYEnviar : iniciarGrabacion}
      style={[styles.micBtn, { backgroundColor: colors.inputBg }, grabandoVoz && styles.micBtnGrabando]}
      disabled={estadoVoz === 'enviando'}
    >
      <Text style={styles.micText}>
        {estadoVoz === 'enviando' ? '…' : (grabandoVoz ? '⏹' : '🎤')}
      </Text>
    </TouchableOpacity>
  );
}

export default function ChatGrabadorMic(props) {
  return (
    <AudioErrorBoundary fallback={null}>
      <GrabadorInner {...props} />
    </AudioErrorBoundary>
  );
}
