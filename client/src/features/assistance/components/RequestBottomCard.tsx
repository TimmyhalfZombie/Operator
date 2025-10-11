import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'phosphor-react-native';

const BG = '#0E0E0E';
const GREEN = '#44ff75';
const DIVIDER = '#2B2B2B';
const DECLINE_BG = '#5F5B60'; // closer to the screenshot’s neutral pill

type Props = {
  clientName: string;
  placeName: string;
  address: string;
  onAccept: () => void;
  onDecline: () => void;
  onMessage?: () => void;
  cardStyle?: StyleProp<ViewStyle>;
  absolute?: boolean;
  /** Lift the whole card upward by N px (keeps the map visible under it) */
  bottomOffset?: number;
};

export default function RequestBottomCard({
  clientName,
  placeName,
  address,
  onAccept,
  onDecline,
  onMessage,
  cardStyle,
  absolute = true,
  bottomOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  const Container = absolute ? View : React.Fragment;
  const containerProps = absolute
    ? ({
        style: [
          styles.overlay,
          { paddingBottom: Math.max(8, insets.bottom + 6) + bottomOffset },
        ],
        pointerEvents: 'box-none' as const,
      } as any)
    : {};

  return (
    // @ts-ignore Fragment or View container
    <Container {...containerProps}>
      <View style={[styles.card, cardStyle]}>
        {/* Header */}
        <View style={styles.headerBlock}>
<View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {clientName}
            </Text>
            <TouchableOpacity
              onPress={onMessage}
              disabled={!onMessage}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Message client"
              style={styles.msgBtn}
            >
              <Icons.EnvelopeSimple size={27} color={GREEN} />
            </TouchableOpacity>
          </View>

          <Text style={styles.place} numberOfLines={2}>
            {placeName}
          </Text>
          <Text style={styles.addr} numberOfLines={3}>
            {address}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.accept]}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Accept request"
            activeOpacity={0.9}
          >
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.decline]}
            onPress={onDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline request"
            activeOpacity={0.9}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  // full-screen overlay so the map stays visible behind
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },

  // the black sheet
  card: {
    marginHorizontal: 12,
    backgroundColor: BG,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },

  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // green name
  name: {
    color: '#44ff75',
    fontSize: 25,
    fontFamily: 'Inter-Black',
  },

  // little green outlined square w/ envelope
  msgSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // white bold place
  place: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-Black',
  },

  // grey address, small
  addr: {
    marginTop: 4,
    color: '#B9B9B9',
    fontSize: 14,
    lineHeight: 16,
    fontFamily: 'Inter-Medium',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },

  actions: {
    flexDirection: 'row',
    gap: 14 as any,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  btn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  accept: { backgroundColor: GREEN },
  decline: { backgroundColor: DECLINE_BG },

  acceptText: { color: '#0E0E0E', fontFamily: 'Inter-Black', fontSize: 16 },
  declineText: { color: '#FFFFFF', fontFamily: 'Inter-Black', fontSize: 16 },
});
