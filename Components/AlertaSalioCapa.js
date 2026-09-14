import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { alertaSalioAnim } from '../utils/alertaSalioPrefs';

function AlertaSalioCapaInner({ anim }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(360);
  const loopRef = useRef(null);

  const { estilo, pal, dur } = anim;
  const { lo, hi, alt } = pal;

  useEffect(() => {
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current = null;
    }

    opacity.setValue(0);
    opacityB.setValue(0);
    translateX.setValue(0);

    const half = Math.max(200, Math.round(dur / 2));

    if (estilo === 'destello') {
      const flash = 140;
      const pause = Math.max(250, Math.round(dur * 0.5));
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: flash, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.12, duration: flash, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(opacity, { toValue: 0.12, duration: 80, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: flash, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.12, duration: flash, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(opacity, { toValue: 0.12, duration: pause, useNativeDriver: true }),
        ])
      );
    } else if (estilo === 'sirena') {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: half, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0, duration: half, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacityB, { toValue: 1, duration: half, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacityB, { toValue: 0, duration: half, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
    } else {
      loopRef.current = Animated.loop(
        Animated.timing(translateX, { toValue: 1, duration: Math.round(dur * 1.6), useNativeDriver: true, easing: Easing.linear })
      );
    }

    if (loopRef.current) loopRef.current.start();
    return () => {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [estilo, dur, opacity, opacityB, translateX]);

  if (estilo === 'ola') {
    const w = widthRef.current || 360;
    return (
      <View
        pointerEvents="none"
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width || 360; }}
        style={[styles.fill, { backgroundColor: lo }]}
      >
        <Animated.View
          style={[
            styles.ola,
            {
              backgroundColor: hi,
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-0.6 * w, 1.2 * w],
                }),
              }],
            },
          ]}
        />
      </View>
    );
  }

  if (estilo === 'sirena') {
    return (
      <View pointerEvents="none" style={[styles.fill, { backgroundColor: lo }]}>
        <Animated.View style={[styles.fill, { backgroundColor: hi, opacity }]} />
        <Animated.View style={[styles.fill, { backgroundColor: alt, opacity: opacityB }]} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: lo }]}>
      <Animated.View style={[styles.fill, { backgroundColor: hi, opacity }]} />
    </View>
  );
}

export default function AlertaSalioCapa({ prefs }) {
  const anim = alertaSalioAnim(prefs);
  if (!anim) return null;
  return <AlertaSalioCapaInner key={anim.key} anim={anim} />;
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  ola: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '60%',
    borderRadius: 4,
  },
});
