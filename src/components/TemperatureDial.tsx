import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon } from 'react-native-svg';

type Props = {
  size?: number;      // overall diameter
  valueText?: string; // center text; e.g. "0°"
  isHeating?: boolean; // whether the app is in heating state
  isRetracting?: boolean; // whether the app is in retracting state
};

export default function TemperatureDial({ size = 240, valueText = '0°', isHeating = false, isRetracting = false }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  
  // Simple number counting
  const [phaseNumber, setPhaseNumber] = React.useState(0);
  
  React.useEffect(() => {
    if (isHeating) {
      // Cycle through numbers 1-3 for center text (heating)
      const interval = setInterval(() => {
        setPhaseNumber(prev => (prev % 3) + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (isRetracting) {
      // Countdown from 3 to 0 for center text (retracting)
      setPhaseNumber(3);
      const interval = setInterval(() => {
        setPhaseNumber(prev => {
          if (prev <= 0) return 0; // stop at 0
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setPhaseNumber(0);
    }
  }, [isHeating, isRetracting]);

  // ring sizes
  const outerStroke = 20;       // dark outer ring width
  const innerStroke = 12;       // inner ring width
  const ticksRadius = cx - outerStroke * 1.15; // where tick marks sit
  const knobRadius = 18;        // green knob at bottom

  // tick marks (short dashes all around)
  const tickCount = 60; // dense small ticks
  const tickLength = 8; // length of each tick
  const tickStroke = 2;

  // helper to get (x,y) on circle
  const pt = (r: number, deg: number) => {
    const rad = (Math.PI / 180) * deg;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Outer dark ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={cx - outerStroke / 2}
            stroke="#2a2a2a"
            strokeWidth={outerStroke}
            fill="none"
          />

          {/* Inner ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={cx - outerStroke - innerStroke / 2 + 2}
            stroke="#1f1f1f"
            strokeWidth={innerStroke}
            fill="none"
          />

          {/* Tick marks */}
          <G>
            {Array.from({ length: tickCount }).map((_, i) => {
              const deg = (360 / tickCount) * i - 90; // start from top
              const p1 = pt(ticksRadius, deg);
              const p2 = pt(ticksRadius - tickLength, deg);
              return (
                <Line
                  key={i}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#c7c7c7"
                  strokeOpacity={0.45}
                  strokeWidth={tickStroke}
                  strokeLinecap="round"
                />
              );
            })}
          </G>

          {/* Bottom triangle marker */}
          {(() => {
            const base = pt(ticksRadius - tickLength - 6, 90); // bottom
            const left = pt(ticksRadius - tickLength - 2, 90 + 6);
            const right = pt(ticksRadius - tickLength - 2, 90 - 6);
            const points = `${base.x},${base.y} ${left.x},${left.y} ${right.x},${right.y}`;
            return <Polygon points={points} fill="#ffffff" />;
          })()}
        </Svg>

        {/* Center value text */}
        <View style={styles.centerWrap} pointerEvents="none">
          <Text style={styles.valueText}>
            {isHeating || isRetracting ? `${phaseNumber}°C` : valueText}
          </Text>
        </View>

        {/* Green knob with triangular pointer - static at bottom */}
        <View
          style={[
            styles.knobContainer,
            {
              left: cx - knobRadius,
              top: size - knobRadius * 2 - 6,
            },
          ]}
        >
          {/* White triangular pointer above knob */}
          <View style={styles.triangularPointer} />
          
          {/* Green knob */}
          <View style={styles.knob} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    position: 'absolute',
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: 'bold',
    fontFamily: 'Candal',
  },
  knobContainer: {
    position: 'absolute',
  },
  triangularPointer: {
    position: 'absolute',
    top: -8,
    left: 14, // (36 - 8) / 2 = 14 to center the triangle
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ffffff',
  },
  knob: {
    width: 36, // knobRadius * 2 = 18 * 2
    height: 36, // knobRadius * 2 = 18 * 2
    borderRadius: 18, // knobRadius
    backgroundColor: '#50ff84',
    borderWidth: 3,
    borderColor: '#1b1b1b',
    elevation: 6, // Android shadow
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
