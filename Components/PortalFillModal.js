import React from 'react';
import { Modal, Platform } from 'react-native';

/**
 * Modal a pantalla completa (ventana nativa).
 * En RN 0.86 / Expo Go los overlays `position:absolute` dentro de tabs quedan detrás.
 */
export default function PortalFillModal({
  visible = true,
  children,
  onRequestClose,
  animationType = 'fade',
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}
