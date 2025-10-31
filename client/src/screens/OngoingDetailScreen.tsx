// client/src/screens/OngoingDetailScreen.tsx
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  View,
  type TextProps,
} from 'react-native';
import GeoapifyMap from '../components/GeoapifyMap';
import useAcceptedJobUI from '../features/useAcceptedJobUI';
import { useActivityDetail } from './functions/activityDetail';

const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';

const BG = '#0E0E0E';
const CARD = '#0E0E0E';
const BORDER = '#262626';
const GREEN = '#6EFF87';
const GREEN_DIM = '#9EF29E';
const SUB = '#B9B9B9';
const WHITE = '#FFFFFF';
const RED = '#ff5f5f';
const BLUE = '#4ea7ff';
const TEXT_DARK = '#0C0C0C';
const TEXT_LIGHT = '#EDEDED';
const DECLINE_BG = '#5F5B60';
const LIGHT_PILL = '#DFFFEA';

type Params = {
  id?: string | string[];
  activityId?: string | string[];
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  customer?: string;
  timeRange?: string;
  status?: string;
  rating?: string;
};

function Text(props: TextProps) {
  return <RNText {...props} style={[{ fontFamily: INTER_BLACK }, props.style]} />;
}

export default function OngoingDetailScreen() {
  const {
    loading,
    err,
    doc,
    msgBusy,
    customer,
    contactName,
    customerPhone,
    startName,
    startAddr,
    endName,
    endAddr,
    status,
    timeRepaired,
    rating,
    timeRange,
    clientAvatar,
    handleMessagePress,
  } = useActivityDetail();

  const acceptedJobUI = useAcceptedJobUI();

  // Open the accepted job UI when component mounts
  React.useEffect(() => {
    if (doc && !loading) {
      acceptedJobUI.openFromRequest(doc, {
        onRepaired: () => {
          // Navigate to completed job detail screen
          router.push(`/activity-detail?id=${encodeURIComponent(String(doc.id))}`);
        },
        onCancel: () => {
          // Navigate back to activity screen
          router.push('/activity');
        }
      });
    }
  }, [doc, loading]);

  const handleCall = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`).catch(() => {});
    }
  };

  if (loading && !doc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
        <Text style={{ color: '#ff9d9d', fontFamily: INTER_MEDIUM }}>{err || 'No data available'}</Text>
      </View>
    );
  }

  // Show the exact same interface as the accepted job screen using useAcceptedJobUI
  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity 
          onPress={() => router.push('/activity')} 
          style={styles.backButton}
          hitSlop={12}
        >
          <Icons.ArrowLeft size={24} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      </View>

      {/* Map Background */}
      <GeoapifyMap
        lat={doc?.coords?.lat || doc?.location?.coordinates?.[1] || null}
        lng={doc?.coords?.lng || doc?.location?.coordinates?.[0] || null}
        showOperator={true}
        autoUseDeviceLocation={true}
        style={styles.mapContainer}
      />

      {/* Render the accepted job UI overlay */}
      {acceptedJobUI.element}
    </View>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { 
    flex: 1, 
    backgroundColor: BG 
  },

  backButtonContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10000,
  },

  backButton: {
    width: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Map container
  mapContainer: {
    flex: 1,
    width: '100%',
  },
});
