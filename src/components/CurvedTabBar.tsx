import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Icons from 'phosphor-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const BG = '#181818';          // screen background
const BAR_BG = '#222';         // bar fill
const BAR_BORDER = '#222';
const ACTIVE = '#44FF75';      // mint green
const INACTIVE = '#A9D9B0';    // soft mint for inactive

const { width: W } = Dimensions.get('window');
const BAR_HEIGHT = 76;
const CURVE_DEPTH = 0;         // flat bar top

// Sizes / motion
const ACTIVE_DOT = 60;         // green puck size
const ICON_LIFT = -15         // increased lift to center icon on green circle
const FROM_BELOW = 12;         // pop distance from below
const PUCK_OFFSET_X = 8; 
const PER_TAB_X = [0, -3.5, -5]; // per-tab puck X nudge if needed

// Make all labels level (same top margin & line height)
const LABEL_OFFSETS: Record<string, number> = {
  Home: 8,
  Messages: 8,
  Profile: 8,
};

// Extra per-tab icon Y offsets (px). Positive = move DOWN a bit to match baselines.
const ICON_OFFSETS: Record<string, number> = {
  Home: 0,
  Messages: 0,
  Profile: 0,   // ⬅️ tiny push down to level with Home/Messages
};

// Per-tab active lift controls (px). Negative = move UP when active.
const ACTIVE_ICON_LIFTS: Record<string, number> = {
  Home: -24,
  Messages: -22.5,
  Profile: -24,
};

// Per-tab active horizontal controls (px). Negative = move LEFT, Positive = move RIGHT when active.
const ACTIVE_ICON_X_OFFSETS: Record<string, number> = {
  Home: 0,
  Messages: -1,
  Profile: 2.3,
};

function getIcon(name: string, focused: boolean, size = 22) {
  const color = focused ? '#000000' : INACTIVE;
  switch (name) {
    case 'Home':
      return <Icons.House weight={focused ? 'fill' : 'duotone'} size={size} color={color} />;
    case 'Messages':
      return <Icons.EnvelopeSimple weight={focused ? 'fill' : 'duotone'} size={size} color={color} />;
    case 'Profile':
      return <Icons.User weight={focused ? 'fill' : 'duotone'} size={size} color={color} />;
    default:
      return null;
  }
}

export default function CurvedTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();

  // Only render the 3 tabs you want
  const allowed = useMemo(() => new Set(['home', 'messages', 'profile']), []);
  const routes = state.routes.filter(r => allowed.has(r.name.toLowerCase()));

  const tabCount = routes.length || 3;
  const tabWidth = W / tabCount;
  const centers = routes.map((_, i) => tabWidth * (i + 0.5));

  // Animated index (drives horizontal center)
  const animIndex = useRef(new Animated.Value(state.index)).current;

  // Puck animation (vertical pop, scale, opacity)
  const puckProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animIndex, {
        toValue: state.index,
        duration: 320,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(puckProgress, {
          toValue: 0,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(puckProgress, {
          toValue: 1,
          duration: 220,
          easing: Easing.bezier(0.22, 0.61, 0.36, 1),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [state.index, animIndex, puckProgress]);

  const notchX = animIndex.interpolate({
    inputRange: routes.map((_, i) => i),
    outputRange: centers,
  });

  const puckTranslateY = puckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [FROM_BELOW, -ICON_LIFT],
  });
  const puckScale = puckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });
  const puckAlpha = puckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const puckTabOffset = animIndex.interpolate({
    inputRange: routes.map((_, i) => i),
    outputRange: PER_TAB_X,
  });

  const pathD = React.useMemo(() => {
    const h = BAR_HEIGHT;
    const w = W;
    const topY = 0;
    const dip = CURVE_DEPTH;
    const c1x = w * 0.35;
    const c2x = w * 0.65;
    return [
      `M 0 ${topY}`,
      `L ${w * 0.25} ${topY}`,
      `C ${c1x} ${topY} ${w * 0.45} ${topY + dip} ${w * 0.5} ${topY + dip}`,
      `C ${w * 0.55} ${topY + dip} ${c2x} ${topY} ${w * 0.75} ${topY}`,
      `L ${w} ${topY}`,
      `L ${w} ${h}`,
      `L 0 ${h}`,
      'Z',
    ].join(' ');
  }, []);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {/* Bar background */}
      <View style={styles.svgWrap}>
        <Svg width={W} height={BAR_HEIGHT} style={{ position: 'absolute', bottom: 0 }}>
          <Path d={pathD} fill={BAR_BG} stroke={BAR_BORDER} />
        </Svg>
      </View>

      {/* Single green puck */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activeDot,
          {
            left: Animated.add(
              Animated.subtract(notchX, ACTIVE_DOT / 2),
              Animated.add(puckTabOffset, new Animated.Value(PUCK_OFFSET_X))
            ),
            transform: [{ translateY: puckTranslateY }, { scale: puckScale }],
            opacity: puckAlpha,
            backgroundColor: ACTIVE,
            borderColor: BG,
            zIndex: 0,
            elevation: 0,
          },
        ]}
      />

      {/* Tabs */}
      <View style={styles.row}>
        {routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const rawLabel =
            (options.tabBarLabel as string) ??
            (options.title as string) ??
            route.name;
          const labelForIcon = rawLabel.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase());

          const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);

          // Icon rides with the puck (lift up on focus)
          const iconLift = animIndex.interpolate({
            inputRange: routes.map((_, idx) => idx),
            outputRange: routes.map((_, idx) => (idx === i ? -ICON_LIFT : 0)),
          });

          // Additional lift for active icon to center on green circle
          const activeIconLift = isFocused ? (ACTIVE_ICON_LIFTS[rawLabel] ?? 0) : 0;
          
          // Additional horizontal offset for active icon
          const activeIconXOffset = isFocused ? (ACTIVE_ICON_X_OFFSETS[rawLabel] ?? 0) : 0;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tab, { width: tabWidth }]}
            >
              {/* Fixed-height content box ensures consistent baselines */}
              <View style={styles.tabContent}>
                {/* Icon = (animated lift) + per-tab static offset (Profile down) */}
                <Animated.View
                  style={{
                    transform: [
                      { translateY: Animated.add(
                        iconLift, 
                        new Animated.Value((ICON_OFFSETS[rawLabel] ?? 0) + activeIconLift)
                      ) },
                      { translateX: new Animated.Value(activeIconXOffset) }
                    ],
                    position: 'relative', zIndex: 20, elevation: 20,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {getIcon(labelForIcon, isFocused, isFocused ? 32 : 22)}
                </Animated.View>

                {/* Label — all level */}
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? ACTIVE : INACTIVE,
                      marginTop: LABEL_OFFSETS[rawLabel] ?? 8,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {rawLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  svgWrap: { height: BAR_HEIGHT },

  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
  },

  // Green moving circle
  activeDot: {
    position: 'absolute',
    top: -ACTIVE_DOT / 2,
    width: ACTIVE_DOT,
    height: ACTIVE_DOT,
    borderRadius: ACTIVE_DOT / 2,
    borderWidth: 2,
  },

  tab: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: -3.5, // your layout tweak kept
  },

  // 👇 fixed box so icon+label all share a consistent baseline
  tabContent: {
    height: 56,                // controls the common baseline
    alignItems: 'center',
    justifyContent: 'flex-end' // stack at bottom together
  },

  label: {
    fontSize: 14,
    lineHeight: 16,            // consistent text box height
    fontWeight: '600',
  },
});
