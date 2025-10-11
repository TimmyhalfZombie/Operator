import React from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';

const RED = '#ff3b30';

export default function UserPin() {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* soft pulsing ring */}
      <Animated.View style={[styles.pulse, { transform: [{ scale }], opacity }]} />

      {/* pin head */}
      <View style={styles.head}>
        <View style={styles.gloss} />
        <View style={styles.dot} />
      </View>

      {/* little tail */}
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pulse: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: RED,
  },
  head: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: RED,
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  gloss: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 10,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  tail: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: RED,
  },
});
