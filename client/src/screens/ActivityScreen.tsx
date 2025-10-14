import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React, { useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivity } from '../features/useActivity';
import { useImmersiveMode } from '../hooks/useImmersiveMode';

const BG = '#121212';
const TEXT = '#EDEDED';
const SUBTEXT = '#9AA09C';
const DIVIDER = '#1F1F1F';
const GREEN = '#6EFF87';

// Inter font families (ensure these are loaded in your app)
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';

type ActivityItemProps = {
  title: string;
  subtitle?: string;
  isNew?: boolean;
  onPress?: () => void;
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  subtitle,
  isNew,
  onPress,
}) => {
  const Content = (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Icons.Wrench size={18} color={GREEN} weight="bold" />
        </View>
        <View style={styles.itemTextWrap}>
          {isNew && <Text style={styles.badgeNew}>Request assistance</Text>}
          <Text numberOfLines={1} style={styles.itemTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.itemRight}>
        {isNew ? (
          <View style={styles.newDot} />
        ) : (
          <View style={styles.checkWrap}>
            <Icons.Check size={16} color={GREEN} weight="bold" />
          </View>
        )}
      </View>
    </View>
  );

  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {Content}
    </TouchableOpacity>
  ) : (
    Content
  );
};

function formatWhen(dt: string | Date) {
  const d = new Date(dt);
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

const ActivityScreen: React.FC = () => {
  // Enable immersive mode
  useImmersiveMode();
  
  const { newItems, recentItems, loading, error } = useActivity();

  const empty = useMemo(
    () => !loading && !error && newItems.length === 0 && recentItems.length === 0,
    [loading, error, newItems.length, recentItems.length]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerWrap}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal', fontSize: 25 }}>Activity</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ padding: 16 }}>
            <Text style={[styles.itemSubtitle, { color: '#ffb4b4' }]}>{String(error)}</Text>
          </View>
        ) : null}

        {empty ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.itemSubtitle}>No activity yet.</Text>
          </View>
        ) : (
          <>
            {newItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>New</Text>
                <View style={styles.card}>
                  {newItems.map((it, idx) => {
                    const title =
                      it?.location?.address || it?.vehicle?.model || 'Assistance request';
                    return (
                      <React.Fragment key={it.id}>
                        <ActivityItem
                          isNew
                          title={title}
                          subtitle={formatWhen(it.createdAt)}
                          onPress={() => router.push('/assist')}
                        />
                        {idx < newItems.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={styles.sectionSpacer} />
              </>
            )}

            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.card}>
              {recentItems.map((it, idx) => {
                // Client information from database fields
                const clientName = it?.clientName || 
                                 it?.customerName || 
                                 it?.contactName || 
                                 'Client';
                const clientLocation = it?.location?.address || 
                                     it?.location?.formatted_address || 
                                     it?.location?.display_name ||
                                     it?.address || 
                                     'Location';
                const date = formatWhen(it.createdAt);
                
                const title = clientName;
                const subtitle = `${clientLocation} • ${date}`;

                // Client location from Mongo: coordinates = [lng, lat]
                const clientLng = it?.location?.coordinates?.[0];
                const clientLat = it?.location?.coordinates?.[1];

                const clientIdParam =
                  String(
                    it?.customer?.id ||
                      it?.owner?.id ||
                      it?.clientId ||
                      it?.userId ||
                      ''
                  ) || undefined;

                const params: Record<string, string> = {};
                if (clientIdParam) params.clientId = clientIdParam;
                if (Number.isFinite(clientLat) && Number.isFinite(clientLng)) {
                  params.clientLat = String(clientLat as number);
                  params.clientLng = String(clientLng as number);
                }
                if (it?.id) params.activityId = String(it.id);

                const onPress = () => router.push({ pathname: '/activity-detail', params });

                return (
                  <React.Fragment key={it.id}>
                    <ActivityItem
                      title={title}
                      subtitle={subtitle}
                      onPress={onPress}
                    />
                    {idx < recentItems.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ActivityScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  headerWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  headerText: {
    color: '#44ff75',
    fontSize: 25,
    fontFamily: INTER_BLACK,
  },

  scroll: { flex: 1, paddingHorizontal: 14 },

  sectionTitle: {
    color: TEXT,
    opacity: 0.9,
    fontSize: 14,
    marginLeft: 6,
    marginBottom: 8,
    marginTop: 12,
    fontFamily: INTER_BLACK,
  },

  card: { borderRadius: 16, paddingVertical: 8 },
  sectionSpacer: { height: 8 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    gap: 12 as any,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(110,255,135,0.08)',
  },
  itemTextWrap: { flex: 1 },

  badgeNew: { 
    color: GREEN, 
    fontSize: 15, 
    marginBottom: 2,
    fontFamily: INTER_BLACK,
  },

  itemTitle: { 
    color: TEXT, 
    fontSize: 16, 
    fontFamily: INTER_BLACK,
  },

  itemSubtitle: {
    color: SUBTEXT, 
    fontSize: 13, 
    marginTop: 2, 
    fontFamily: INTER_BLACK,
    fontWeight: 'bold',
  },


  itemRight: { width: 28, alignItems: 'flex-end' },
  newDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: GREEN },
  checkWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    marginLeft: 54,
    marginVertical: 12,
    backgroundColor: DIVIDER,
  },
});
