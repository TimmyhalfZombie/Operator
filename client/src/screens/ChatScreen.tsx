import { useLocalSearchParams, router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useChat } from '../features/messages/useChat';

const BG = '#0E0E0E';
const GREEN = '#44ff75';
const TEXT = '#EDEDED';

type Params = { id?: string | string[] };

export default function ChatScreen() {
  const p = useLocalSearchParams<Params>();
  const conversationId = Array.isArray(p.id) ? p.id[0] : p.id;
  const [draft, setDraft] = React.useState('');

  const { messages, loading, typing, send, setIsTyping } = useChat(conversationId);

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.select({ ios: 'padding' })}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}><Text style={{ fontSize: 20 }}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Operator</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        {loading ? <ActivityIndicator /> : (
          <>
            {messages.map((m) => {
              const mine = false; // optional: compare with current user id from tokenStore
              return (
                <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.msgText, mine ? styles.mineText : styles.theirsText]}>{m.text}</Text>
                  <Text style={styles.time}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              );
            })}
            {typing.length > 0 && <Text style={{ color: '#9aa', marginTop: 6 }}>typing…</Text>}
          </>
        )}
      </View>

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attach}><Text>➕</Text></TouchableOpacity>
        <TextInput
          value={draft}
          onChangeText={(t) => { setDraft(t); setIsTyping(true); }}
          onBlur={() => setIsTyping(false)}
          placeholder="Type here"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <TouchableOpacity
          style={styles.send}
          onPress={() => { if (draft.trim()) { send(draft.trim()); setDraft(''); setIsTyping(false); } }}
        >
          <Text style={{ color: '#0a0a0a', fontWeight: '800' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  topbar: { height: 56, backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800' },
  body: { flex: 1, padding: 14 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10, marginBottom: 8 },
  theirs: { alignSelf: 'flex-start', backgroundColor: GREEN, borderTopLeftRadius: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#4a4a4a', borderTopRightRadius: 4 },
  msgText: { fontSize: 15 },
  theirsText: { color: '#0a0a0a', fontWeight: '700' },
  mineText: { color: TEXT, fontWeight: '700' },
  time: { color: '#aaa', fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, borderTopColor: '#1c1c1c', borderTopWidth: StyleSheet.hairlineWidth },
  attach: { backgroundColor: '#1c1c1c', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: '#1c1c1c', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: TEXT },
  send: { backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
});
