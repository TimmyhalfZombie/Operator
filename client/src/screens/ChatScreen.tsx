import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { tokens } from '../auth/tokenStore';
import { useChat } from '../features/messages/useChat';
import { getMyIdSync, isMyMessage, useResolvedConversationId } from './functions/chat';
import { getConversation } from '@/features/messages/api';

const BG = '#121212';
const CARD = '#1c1c1c';
const GREEN = '#6EFF87';
const BORDER = '#262626';
const DIM = '#9AA09C';

export default function ChatScreen() {
  const { id: idParam, requestId, peer } = useLocalSearchParams<{ id?: string; requestId?: string; peer?: string }>();
  const [myId, setMyId] = React.useState<string>('me');
  const [title, setTitle] = React.useState<string>('Conversation');

  React.useEffect(() => {
    (async () => {
      try { await (tokens as any).waitUntilReady?.(); } catch {}
      setMyId(getMyIdSync());
    })();
  }, []);

  // Always go back to Messages tab (also for Android hardware back)
  React.useEffect(() => {
    const onBack = () => { router.replace('/messages'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => { sub.remove(); };
  }, []);

  const convId = useResolvedConversationId(
    typeof idParam === 'string' ? idParam : undefined,
    typeof requestId === 'string' ? requestId : undefined,
    typeof peer === 'string' ? peer : undefined
  );

  // Load conversation title/peer for header
  React.useEffect(() => {
    let live = true;
    (async () => {
      if (!convId) return;
      try {
        const d = await getConversation(convId);
        const t =
          d?.title ||
          d?.peer?.name ||
          d?.peer?.username ||
          d?.peer?.phone ||
          d?.peer?.email ||
          'Conversation';
        if (live) setTitle(String(t));
      } catch {
        if (live) setTitle('Conversation');
      }
    })();
    return () => { live = false; };
  }, [convId]);

  const { messages, loading, send, setIsTyping } = useChat(convId, myId);
  const [text, setText] = React.useState('');

  const onSend = () => {
    const t = text.trim();
    if (!t || !convId) return;
    send(t);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 72, android: 0 })}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/messages')} style={styles.headerBtn}>
          <Text style={{ color: DIM }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          contentContainerStyle={{ padding: 12, paddingBottom: 16, flexGrow: 1, justifyContent: 'flex-end' }}
          renderItem={({ item }) => {
            type RenderMessage = typeof item & { pending?: boolean; failed?: boolean };
            const m = item as RenderMessage;
            const mine = isMyMessage(m.from, myId);
            return (
              <View style={[styles.row, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, m.failed && styles.bubbleFailed]}>
                  <Text style={mine ? styles.textMine : styles.textOther}>{m.text}</Text>
                  {m.pending && <Text style={styles.meta}>sending…</Text>}
                  {m.failed && <Text style={styles.meta}>failed</Text>}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 20 }}>
              <Text style={{ color: DIM, textAlign: 'center' }}>No messages yet</Text>
            </View>
          }
        />
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setIsTyping?.(!!v);
          }}
          placeholder="Type a message"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
          multiline
        />
        <TouchableOpacity onPress={onSend} style={styles.sendBtn}>
          <Text style={{ color: '#0B0B0B', fontWeight: '700' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
  },
  headerBtn: { width: 60, paddingVertical: 8 },
  title: { flex: 1, textAlign: 'center', color: '#EDEDED', fontSize: 16, fontWeight: '700' },

  row: { flexDirection: 'row', marginVertical: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: GREEN },
  bubbleOther: { backgroundColor: CARD, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2A2A' },
  bubbleFailed: { borderColor: '#ff6464', borderWidth: 1 },
  textMine: { color: '#0B0B0B' },
  textOther: { color: '#F2F2F2' },
  meta: { color: DIM, fontSize: 11, marginTop: 4 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 140, padding: 10,
    color: '#EDEDED', backgroundColor: '#191919', borderRadius: 12,
  },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: GREEN },
});
