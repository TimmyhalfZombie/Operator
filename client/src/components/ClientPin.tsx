import React from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';

const BLUE = '#2FA3FF';
const SIZE = 18; // circle diameter

export default function ClientPin() {
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
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.pulse, { transform: [{ scale }], opacity }]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: BLUE,
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: BLUE,
    borderWidth: 2,
    borderColor: '#ffffff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
});
