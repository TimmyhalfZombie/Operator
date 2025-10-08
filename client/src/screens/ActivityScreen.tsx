// src/screens/ActivityScreen.tsx
import * as Icons from "phosphor-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

const ActivityItem: React.FC<ActivityItemProps> = ({ title, subtitle, isNew, showRate }) => {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Icons.Wrench size={18} color={GREEN} weight="bold" />
        </View>
        <View style={styles.itemTextWrap}>
          {isNew && <Text style={styles.badgeNew}>Request assistance</Text>}
          <Text numberOfLines={1} style={styles.itemTitle}>{title}</Text>
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

const ActivityScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Activity</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* New */}
        <Text style={styles.sectionTitle}>New</Text>
        <View style={styles.card}>
          <ActivityItem
            isNew
            title="Iloilo Merchant Marine School"
            subtitle="17 Sept 2025, 9:18 AM"
          />
        </View>

        <View style={styles.sectionSpacer} />

        {/* Recent */}
        <Text style={styles.sectionTitle}>Recent</Text>
        <View style={styles.card}>
          <ActivityItem
            title="Botong Bay Resort and Store"
            subtitle="6 Aug 2025, 10:28 AM"
          />
          <View style={styles.divider} />
          <ActivityItem title="The Orchard Valley" subtitle="21 Aug 2025, 2:08 PM" />
          <View style={styles.divider} />
          <ActivityItem
            title="RL Royal Prime Construction Company"
            subtitle="11 July 2025, 11:18 AM"
          />
          <View style={styles.divider} />
          <ActivityItem title="Falsis Rice Mill" subtitle="1 Feb 2025, 4:00 PM" />
          <View style={styles.divider} />
          <ActivityItem
            title="NKS Marketing - Leganes"
            subtitle="17 June 2025, 4:18 AM"
          />
          <View style={styles.divider} />
          <ActivityItem
            title="Iloilo City Hall"
            subtitle="15 June 2025, 3:45 PM"
          />
          <View style={styles.divider} />
          <ActivityItem
            title="SM City Iloilo"
            subtitle="12 June 2025, 11:30 AM"
          />
          <View style={styles.divider} />
          <ActivityItem
            title="Robinsons Place Iloilo"
            subtitle="8 June 2025, 2:15 PM"
          />
          <View style={styles.divider} />
          <ActivityItem
            title="Gaisano Capital"
            subtitle="5 June 2025, 9:20 AM"
          />
        </View>
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
    paddingTop: 8, 
    paddingBottom: 6 
  },

  header: { 
    fontSize: 30, 
    fontWeight: "800", 
    color: GREEN 
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
  },

  card: { 
    borderRadius: 16, 
    paddingVertical: 8 
  
  },
  sectionSpacer: { 
    height: 8
   },

  itemRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 10, 
    paddingVertical: 12 
  },

  itemLeft: { 
    flexDirection: "row", 
    flex: 1, 
    alignItems: "center", 
    gap: 12 
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

  itemTextWrap: { 
    flex: 1
   },

  badgeNew: { 
    color: GREEN, 
    fontSize: 12, 
    marginBottom: 2 
  },

  itemTitle: { 
    color: TEXT, 
    fontSize: 16, 
    fontWeight: "700" 
  },

  itemSubtitle: { 
    color: SUBTEXT, 
    fontSize: 12, 
    marginTop: 2 
  },

  rateText: { 
    marginTop: 6, 
    color: "#CDEEDA", 
    fontSize: 12 
  },

  itemRight: {
    width: 28, 
     alignItems: "flex-end"
 },
  newDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 6, 
    backgroundColor: GREEN 
  },

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
    backgroundColor: DIVIDER
   },
});
