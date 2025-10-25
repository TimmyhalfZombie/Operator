import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon } from 'react-native-svg';

type Props = {
  size?: number;       // overall diameter
  valueText?: string;  // center text; e.g. "27°C"
  isHeating?: boolean;
  isCooling?: boolean;
  isRetracting?: boolean;
  timerText?: string;  // optional mm:ss below value
};

export default function TemperatureDial({
  size = 240,
  valueText = '0°C',
  isHeating = false,
  isCooling = false,
  isRetracting = false,
  timerText
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  const outerStroke = 20;
  const innerStroke = 12;
  const ticksRadius = cx - outerStroke * 1.15;
  const knobRadius = 18;

  const tickCount = 60;
  const tickLength = 8;
  const tickStroke = 2;

  const pt = (r: number, deg: number) => {
    const rad = (Math.PI / 180) * deg;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={cx - outerStroke / 2} stroke="#2a2a2a" strokeWidth={outerStroke} fill="none" />
          <Circle cx={cx} cy={cy} r={cx - outerStroke - innerStroke / 2 + 2} stroke="#1f1f1f" strokeWidth={innerStroke} fill="none" />
          <G>
            {Array.from({ length: tickCount }).map((_, i) => {
              const deg = (360 / tickCount) * i - 90;
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

          {/* Bottom marker */}
          {(() => {
            const base = pt(ticksRadius - tickLength - 6, 90);
            const left = pt(ticksRadius - tickLength - 2, 90 + 6);
            const right = pt(ticksRadius - tickLength - 2, 90 - 6);
            const points = `${base.x},${base.y} ${left.x},${left.y} ${right.x},${right.y}`;
            return <Polygon points={points} fill="#ffffff" />;
          })()}
        </Svg>

        {/* Center value text — ALWAYS show real reading */}
        <View style={styles.centerWrap} pointerEvents="none">
          <Text style={styles.valueText}>{valueText}</Text>
          {timerText ? <Text style={styles.timerText}>{timerText}</Text> : null}
        </View>

        {/* Green knob */}
        <View style={[styles.knobContainer, { left: cx - knobRadius, top: size - knobRadius * 2 - 6 }]}>
          <View style={styles.triangularPointer} />
          <View style={styles.knob} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: 'bold',
    fontFamily: 'Candal',
  },
  timerText: {
    color: '#c7c7c7',
    fontSize: 18,
    marginTop: 6,
    fontFamily: 'Inter-Regular',
  },
  knobContainer: { position: 'absolute' },
  triangularPointer: {
    position: 'absolute',
    top: -8,
    left: 14,
    width: 0, height: 0,
    borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#ffffff',
  },
  knob: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#50ff84',
    borderWidth: 3, borderColor: '#1b1b1b',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
});
