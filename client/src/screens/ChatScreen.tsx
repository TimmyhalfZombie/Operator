import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
    ActivityIndicator,
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

// Try to extract the current user's id from your token store.
// Adjust these fallbacks to match what you actually save.
function getMyId(): string {
  return (
    (tokens as any).userId ||
    (tokens as any).user?.id ||
    (tokens as any).profile?.id ||
    (tokens as any).sub ||
    (tokens as any).id ||
    'me'
  );
}

const BG = '#121212';
const CARD = '#1c1c1c';
const GREEN = '#6EFF87';
const BORDER = '#262626';
const DIM = '#9AA09C';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = React.useMemo(getMyId, []);
  const { messages, loading, send, setIsTyping } = useChat(id, myId);

  const [text, setText] = React.useState('');

  const onSend = () => {
    const t = text.trim();
    if (!t) return;
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
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={{ color: DIM }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Chat
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
            const mine = item.from === myId;
            return (
              <View
                style={[
                  styles.row,
                  mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                    item.failed && styles.bubbleFailed,
                  ]}
                >
                  <Text style={mine ? styles.textMine : styles.textOther}>{item.text}</Text>
                  {item.pending && <Text style={styles.meta}>sending…</Text>}
                  {item.failed && <Text style={styles.meta}>failed</Text>}
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerBtn: { width: 60, paddingVertical: 8 },
  title: { flex: 1, textAlign: 'center', color: '#EDEDED', fontSize: 16, fontWeight: '700' },

  row: { flexDirection: 'row', marginVertical: 6 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bubbleMine: { backgroundColor: GREEN },
  bubbleOther: { backgroundColor: CARD, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2A2A' },
  bubbleFailed: { borderColor: '#ff6464', borderWidth: 1 },
  textMine: { color: '#0B0B0B' },
  textOther: { color: '#F2F2F2' },
  meta: { color: DIM, fontSize: 11, marginTop: 4 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    padding: 10,
    color: '#EDEDED',
    backgroundColor: '#191919',
    borderRadius: 12,
  },
  sendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: GREEN,
  },
});
