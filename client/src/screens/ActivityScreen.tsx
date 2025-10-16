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

// Prefer a real request id; fall back through common shapes.
function resolveRequestId(x: any) {
  return (
    x?.id ??
    x?._id ??
    x?.requestId ??
    x?.assistId ??
    x?.assistanceId ??
    x?.request?.id ??
    x?.request?._id ??
    null
  );
}

// If your backend has a separate "activity id", try to capture it too.
function resolveActivityId(x: any) {
  return (
    x?.activityId ??
    x?.activity?.id ??
    x?.id ??     // sometimes the row id itself is the activity id
    x?._id ??
    null
  );
}

const BG = '#121212';
const TEXT = '#EDEDED';
const SUBTEXT = '#bababaff';
const DIVIDER = '#1F1F1F';
const GREEN = '#6EFF87';
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

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
          <Text numberOfLines={1} style={isNew ? styles.itemTitleNewBold : styles.itemTitle}>{title}</Text>
          {!!subtitle && (
            <Text style={isNew ? styles.itemSubtitleNew : styles.itemSubtitle}>
              {subtitle.split('\n').map((line, index, arr) => (
                <Text
                  key={index}
                  style={isNew ? styles.itemSubtitleNew : (index === 0 ? styles.vehicleModel : styles.itemSubtitle)}
                >
                  {line}{index < arr.length - 1 ? '\n' : ''}
                </Text>
              ))}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemRight}>
        {isNew ? (
          <View style={styles.newDot} />
        ) : (
          <View style={styles.checkWrap}>
            <Icons.Check size={20} color="#000000" weight="bold" />
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
                const clientName = it?.clientName || it?.customerName || it?.contactName || 'Client';
                const vehicleModel = it?.vehicle?.model || it?.vehicleType || 'Vehicle';
                const clientLocation =
                  it?.location?.address ||
                  it?.location?.formatted_address ||
                  it?.location?.display_name ||
                  it?.address ||
                  'Location';
                const date = formatWhen(it.createdAt);

                const title = clientName;
                const subtitle = `${vehicleModel}\n${clientLocation}\n${date}`;

                const onPress = () => {
                  const rid = resolveRequestId(it);
                  const aid = resolveActivityId(it);

                  // keep snapshot small (prefer _raw if present)
                  let snapSrc: any = it?._raw ?? it;
                  // strip very heavy fields if any
                  const { image, photo, ...rest } = snapSrc || {};
                  const snap = encodeURIComponent(JSON.stringify(rest || {}));

                  const qs = new URLSearchParams();
                  if (rid) qs.set('id', String(rid));
                  if (aid && String(aid) !== String(rid)) qs.set('activityId', String(aid));
                  qs.set('snap', snap);

                  const url = `/activity-detail?${qs.toString()}`;
                  console.log('[RecentActivity] push detail with', { rid, aid, url });

                  router.push(url);
                };

                return (
                  <React.Fragment key={resolveRequestId(it) ?? it.id ?? idx}>
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
  safe: { 
    flex: 1, 
    backgroundColor: BG 
  },

  headerWrap: { 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 6
   },

  headerText: { 
    color: '#44ff75', 
    fontSize: 25, 
    fontFamily: INTER_BLACK 
  },

  scroll: { 
    flex: 1, 
    paddingHorizontal: 14 
  },

  sectionTitle: {
    color: TEXT, 
    opacity: 0.9, 
    fontSize: 14, 
    marginLeft: 6, 
    marginBottom: 8,
     marginTop: 12, 
     fontFamily: INTER_BLACK,
  },
  
  card: { 
    borderRadius: 16, 
    paddingVertical: 8
  },

  sectionSpacer: { 
    height: 8 
  },

  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 12 
  },

  itemLeft: { 
    flexDirection: 'row', 
    flex: 1, 
    alignItems: 'center', 
    gap: 12 as any 
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

  itemTextWrap: { 
    flex: 1 
  },

  badgeNew: { 
    color: GREEN, 
    fontSize: 15,
    marginBottom: 2, 
    fontFamily: INTER_BLACK 
  },

  itemTitle: { 
    color: TEXT, 
    fontSize: 18, 
    fontFamily: INTER_BLACK 
  },

  itemTitleNew: { 
    color: TEXT, 
    fontSize: 12, 
    fontFamily: INTER_MEDIUM 
  },

  itemTitleNewBold: { 
    color: TEXT, 
    fontSize: 17, 
    fontFamily: INTER_BLACK 
  },

  itemSubtitleNew: { 
    color: SUBTEXT, 
    fontSize: 14, 
    fontFamily: INTER_REGULAR 
  },

  itemSubtitle: { 
    color: SUBTEXT, 
    fontSize: 14, 
    fontFamily: INTER_MEDIUM 
  },

  vehicleModel: { 
    fontSize: 16, 
    fontFamily: INTER_BLACK, 
    color: '#F0F0F0', 
    marginTop: 2 
  },

  itemRight: { 
    width: 28, 
    alignItems: 'flex-end' 
  },

  newDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 6, 
    backgroundColor: GREEN 
  },

  checkWrap: {
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#9EF29E',
    alignItems: 'center', 
    justifyContent: 'center',
  },

  divider: { 
    height: 1, 
    marginLeft: 54, 
    marginVertical: 12, 
    backgroundColor: DIVIDER 
  },
});
