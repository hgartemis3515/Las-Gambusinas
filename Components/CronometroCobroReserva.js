import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { fechaLimiteCobroDe, formatoCuentaRegresiva } from '../utils/cobroReserva';

export default function CronometroCobroReserva({ reserva, fechaLimite, style, alVencer }) {
  const limite = fechaLimite || fechaLimiteCobroDe(reserva);
  const [label, setLabel] = useState('60:00');
  const alVencerRef = useRef(alVencer);
  alVencerRef.current = alVencer;

  useEffect(() => {
    if (!limite) return undefined;
    let aviso = false;
    const tick = () => {
      const ms = Math.max(0, new Date(limite).getTime() - Date.now());
      setLabel(formatoCuentaRegresiva(ms));
      if (ms <= 0 && !aviso) {
        aviso = true;
        if (typeof alVencerRef.current === 'function') alVencerRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [limite]);

  return <Text style={style}>{label}</Text>;
}
