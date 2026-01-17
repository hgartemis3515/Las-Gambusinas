import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MotiView, MotiText } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const TabNav = ({ icono, label, activeColor, inactiveColor, active, onPress, tabSize = 48 }) => {
  const scale = useSharedValue(active ? 1.06 : 1);
  const glowOpacity = useSharedValue(active ? 1 : 0);

  React.useEffect(() => {
    scale.value = withTiming(active ? 1.06 : 1, { duration: 200 });
    glowOpacity.value = withTiming(active ? 1 : 0, { duration: 200 });
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowOpacity.value, [0, 1], [0, 0.3]),
    shadowRadius: interpolate(glowOpacity.value, [0, 1], [0, 10]),
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Animación rápida de touch
    scale.value = withTiming(0.94, { duration: 100 }, () => {
      scale.value = withTiming(active ? 1.06 : 1, { duration: 100 });
    });
    onPress();
  };

  const iconSize = tabSize < 46 ? 18 : 20;
  const labelSize = tabSize < 46 ? 8 : 9;
  const iconContainerSize = tabSize * 0.65;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={[
        styles.container,
        {
          width: tabSize,
          height: tabSize,
          borderRadius: tabSize / 3.2,
        },
      ]}
    >
      <Animated.View
        style={[
          animatedStyle,
          glowAnimatedStyle,
          {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: active ? activeColor : "#000",
            shadowOffset: { width: 0, height: 0 },
            elevation: active ? 6 : 3,
          },
        ]}
      >
        <MotiView
          from={{ scale: active ? 0.95 : 1 }}
          animate={{ scale: active ? 1.06 : 1 }}
          transition={{
            type: "timing",
            duration: 200,
          }}
          style={[
            styles.iconContainer,
            {
              width: iconContainerSize,
              height: iconContainerSize,
              borderRadius: iconContainerSize / 2,
              backgroundColor: active ? "rgba(255,255,255,0.2)" : "transparent",
            },
          ]}
        >
          <Text style={[styles.iconEmoji, { fontSize: iconSize }]}>
            {icono}
          </Text>
        </MotiView>

        <MotiText
          from={{ opacity: active ? 0.8 : 0.6 }}
          animate={{ opacity: active ? 1 : 0.6 }}
          transition={{ duration: 200 }}
          style={[
            styles.label,
            {
              color: active ? activeColor : inactiveColor,
              fontSize: labelSize,
            },
          ]}
        >
          {label}
        </MotiText>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
  },
  iconEmoji: {
    textAlign: "center",
    lineHeight: 20,
  },
  label: {
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
});

export default TabNav;
