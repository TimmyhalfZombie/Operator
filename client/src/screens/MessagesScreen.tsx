import * as Icons from 'phosphor-react-native';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '../features/useMessages';

const colors = {
  bg: '#101010',
  card: '#101010',
  border: '#222',
  brandGreen: '#44ff75',
  text: '#ffffff',
  sub: '#bdbdbd',
};

type Msg = {
  id: string;
  name: string;
  preview: string;
  time: string; // "now", "10 hrs", etc.
  unread?: boolean;
};

const DATA: Msg[] = [
  { id: '1', name: 'Isabella Ramos', preview: '1 new message', time: 'now', unread: true },
  { id: '2', name: 'Diego Morales', preview: 'Location: Villa Arevalo…', time: '10 hrs' },
  { id: '3', name: 'Sofia Hernandez', preview: 'Location: Poto…', time: '13 hrs' },
  { id: '4', name: 'Sebastian Lopez', preview: 'Location: Circumferential Road…', time: '17 hrs' },
  { id: '5', name: 'Valentina Castro', preview: 'Location: Dumangas…', time: '22 hrs' },
  { id: '6', name: 'Mateo Rodriguez', preview: 'Location: Leganes…', time: '31 hrs' },
  { id: '7', name: 'Camila Gutierrez', preview: 'Location: Iloilo City…', time: '2 days' },
  { id: '8', name: 'Santiago Jimenez', preview: 'Location: Jaro…', time: '3 days' },
  { id: '9', name: 'Valeria Martinez', preview: 'Location: Mandurriao…', time: '4 days' },
  { id: '10', name: 'Nicolas Fernandez', preview: 'Location: La Paz…', time: '5 days' },
];

export default function MessagesScreen() {
  const { data } = useMessages();
  const list = (data?.length ? data : DATA) as Msg[];

  const renderItem = ({ item }: { item: Msg }) => (
    <View style={styles.row}>
      {/* avatar */}
      <View style={styles.avatar}>
        <Icons.User size={22} color={colors.sub} />
      </View>

      {/* center text */}
      <View style={styles.textCol}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.preview, item.unread && { color: colors.brandGreen }]}>
          {item.preview}
        </Text>
      </View>

      {/* right meta */}
      <View style={styles.metaCol}>
        <Text style={styles.time}>{item.time}</Text>
        {item.unread ? <View style={styles.dot} /> : <View style={{ width: 8, height: 8 }} />}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* brand */}
      <View style={styles.brandWrap}>
        <Text style={styles.brand}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
        </Text>
      </View>

      {/* header */}
      <Text style={styles.pageTitle}>Message</Text>

      {/* list */}
      <FlatList
        data={list}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const AVATAR = 44;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.bg 
  },

  brandWrap: { 
    paddingHorizontal: 16, 
    paddingTop: 36, 
    paddingBottom: 8 
  },

  brand: { 
    fontSize: 28, 
    letterSpacing: 1 
  },

  pageTitle: {
    color: colors.brandGreen,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sep: { 
    height: 1, 
    backgroundColor: colors.border, 
    marginLeft: AVATAR + 16,
    marginVertical: 8
  },
  
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textCol: { flex: 1 },
  name: { color: colors.text, fontWeight: '800', marginBottom: 2 },
  preview: { color: colors.sub, fontSize: 12 },
  metaCol: { alignItems: 'flex-end', gap: 6 },
  time: { color: colors.sub, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandGreen },
});