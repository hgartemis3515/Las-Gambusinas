import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { alertaSalioAnim } from '../utils/alertaSalioPrefs';

function AlertaSalioCapaInner({ anim }) {
  const t = useSharedValue(0);
  const w = useSharedValue(1);
  const lo = anim.pal.lo;
  const hi = anim.pal.hi;
  const alt = anim.pal.alt;
  const estilo = anim.estilo;

  useEffect(() => {
    t.value = 0;
    const dur = Math.max(280, anim.dur);
    if (estilo === 'destello') {
      const hold = 90;
      const gap = 70;
      const rest = Math.round(dur * 0.45);
      t.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 50, easing: Easing.linear }),
          withTiming(1, { duration: hold }),
          withTiming(0, { duration: 50, easing: Easing.linear }),
          withTiming(0, { duration: gap }),
          withTiming(1, { duration: 50, easing: Easing.linear }),
          withTiming(1, { duration: hold }),
          withTiming(0, { duration: 50, easing: Easing.linear }),
          withTiming(0, { duration: rest }),
        ),
        -1,
        false,
      );
    } else if (estilo === 'sirena') {
      t.value = withRepeat(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      t.value = withRepeat(
        withTiming(1, { duration: Math.round(dur * 1.35), easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(t);
  }, [estilo, anim.dur, lo, hi, alt, t]);

  const destelloStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [lo, hi]),
  }));

  const sirenaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [hi, alt]),
  }));

  const olaBandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * (w.value + w.value * 0.55) - w.value * 0.55 }],
  }));

  if (estilo === 'ola') {
    return (
      <View
        pointerEvents="none"
        onLayout={(e) => { w.value = e.nativeEvent.layout.width || 1; }}
        style={[StyleSheet.absoluteFillObject, styles.capa, { backgroundColor: lo }]}
      >
        <Animated.View
          style={[
            styles.ola,
            { backgroundColor: hi },
            olaBandStyle,
          ]}
        />
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.capa,
        estilo === 'sirena' ? sirenaStyle : destelloStyle,
      ]}
    />
  );
}

export default function AlertaSalioCapa({ prefs }) {
  const anim = alertaSalioAnim(prefs);
  if (!anim) return null;
  return <AlertaSalioCapaInner key={anim.key} anim={anim} />;
}

const styles = StyleSheet.create({
  capa: { zIndex: 0 },
  ola: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '55%',
  },
});
