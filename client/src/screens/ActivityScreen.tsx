import * as Icons from "phosphor-react-native";
import React, { useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useActivity } from "../features/useActivity";

const BG = "#121212";
const TEXT = "#EDEDED";
const SUBTEXT = "#9AA09C";
const DIVIDER = "#1F1F1F";
const GREEN = "#6EFF87";

type ActivityItemProps = {
  title: string;
  subtitle?: string;
  isNew?: boolean;
  showRate?: boolean;
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  subtitle,
  isNew,
  showRate,
}) => {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Icons.Wrench size={18} color={GREEN} weight="bold" />
        </View>
        <View style={styles.itemTextWrap}>
          {isNew && <Text style={styles.badgeNew}>Request assistance</Text>}
          <Text numberOfLines={1} style={styles.itemTitle}>
            {title}
          </Text>
          {!!subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
          {showRate && (
            <TouchableOpacity activeOpacity={0.6} style={{ paddingVertical: 4 }}>
              <Text style={styles.rateText}>Rate  →</Text>
            </TouchableOpacity>
          )}
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
};

function formatWhen(dt: string | Date) {
  const d = new Date(dt);
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

const ActivityScreen: React.FC = () => {
  const { newItems, recentItems, loading, error, refresh } = useActivity();

  const empty = useMemo(
    () => !loading && !error && newItems.length === 0 && recentItems.length === 0,
    [loading, error, newItems.length, recentItems.length]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerWrap}>
        <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal', fontSize: 30 }}>
          Activity
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl tintColor={GREEN} refreshing={loading} onRefresh={refresh} />
        }
      >
        {error ? (
          <View style={{ padding: 16 }}>
            <Text style={[styles.itemSubtitle, { color: "#ffb4b4" }]}>{String(error)}</Text>
          </View>
        ) : null}

        {empty ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.itemSubtitle}>No activity yet.</Text>
          </View>
        ) : (
          <>
            {/* New */}
            {newItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>New</Text>
                <View style={styles.card}>
                  {newItems.map((it, idx) => {
                    const title =
                      it?.location?.address ||
                      it?.vehicle?.model ||
                      "Assistance request";
                    return (
                      <React.Fragment key={it.id}>
                        <ActivityItem
                          isNew
                          title={title}
                          subtitle={formatWhen(it.createdAt)}
                        />
                        {idx < newItems.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={styles.sectionSpacer} />
              </>
            )}

            {/* Recent */}
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.card}>
              {recentItems.map((it, idx) => {
                const title =
                  it?.location?.address || it?.vehicle?.model || "Assistance request";
                const showRate = String(it.status).toLowerCase() === "completed";
                return (
                  <React.Fragment key={it.id}>
                    <ActivityItem
                      title={title}
                      subtitle={formatWhen(it.createdAt)}
                      showRate={showRate}
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

  header: { fontSize: 30, fontWeight: "800", color: GREEN },

  scroll: { flex: 1, paddingHorizontal: 14 },

  sectionTitle: {
    color: TEXT,
    opacity: 0.9,
    fontSize: 14,
    marginLeft: 6,
    marginBottom: 8,
    marginTop: 12,
  },

  card: { borderRadius: 16, paddingVertical: 8 },

  sectionSpacer: { height: 8 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },

  itemLeft: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    // @ts-ignore — `gap` support varies by RN version
    gap: 12,
  },

  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110,255,135,0.08)",
  },

  itemTextWrap: { flex: 1 },

  badgeNew: { color: GREEN, fontSize: 12, marginBottom: 2 },

  itemTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },

  itemSubtitle: { color: SUBTEXT, fontSize: 12, marginTop: 2 },

  rateText: { marginTop: 6, color: "#CDEEDA", fontSize: 12 },

  itemRight: { width: 28, alignItems: "flex-end" },

  newDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: GREEN },

  checkWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  divider: {
    height: 1,
    marginLeft: 54,
    marginVertical: 12,
    backgroundColor: DIVIDER,
  },
});
