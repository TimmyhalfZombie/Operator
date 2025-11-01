import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';

import { tokens } from '../auth/tokenStore';
import { SocketContext } from '../contexts/SocketProvider';
import { fetchMessages } from '../features/messages/api';
import { ensureConversationId } from '../features/messages/ensureConvId';
import { fetchMe } from '../lib/api';
import {
  LocalMessage,
  getMyIdSync,
  isMyMessage,
  loadAttachmentsMap,
  openAttachmentPicker,
  pickFromCamera,
  pickFromLibrary,
  sendImageMessage,
  sendTextMessage,
} from './functions/chat';

const BG = '#0E0E0E';
const MINE_BG = '#6EFF87';
const TEXT_DARK = '#0C0C0C';
const TEXT_LIGHT = '#EDEDED';
const BORDER = '#262626';

// Local wrappers to default all text on this screen to Inter (boldy)
function Text(props: TextProps) {
  return <RNText {...props} style={[{ fontFamily: 'Inter-Bold' }, props.style]} />;
}
function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={[{ fontFamily: 'Inter-Bold' }, props.style]} />;
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; peerUserId?: string; requestId?: string }>();
  const initialId = String(params?.id ?? '');
  const insets = useSafeAreaInsets();
  const { socket } = React.useContext(SocketContext);

  const [conversationId, setConversationId] = React.useState<string>(initialId);
  const [title, setTitle] = React.useState<string>('Chat');
  const [myId, setMyId] = React.useState<string>(getMyIdSync() || 'me');
  const [loading, setLoading] = React.useState(true);

  // NEWEST first (DESC) for inverted FlatList
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [input, setInput] = React.useState('');

  // Persisted local attachments (messageId -> uri)
  const [attachMap, setAttachMap] = React.useState<Record<string, string>>({});

  // Lightbox (zoomable) state
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meInfo = await fetchMe();
        if (!cancelled && meInfo?.id) {
          setMyId(String(meInfo.id));
        }
      } catch {}
      try {
        if ((tokens as any)?.waitUntilReady) {
          await (tokens as any).waitUntilReady();
        }
        const asyncId = await tokens.getUserIdAsync?.();
        if (!cancelled && asyncId) {
          setMyId(String(asyncId));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 0) Resolve/ensure a real conversation id if we arrived as "new"
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const rawId = initialId?.trim();
      if (!rawId || rawId === 'new') {
        const resolved = await ensureConversationId(undefined, {
          peerUserId: typeof params?.peerUserId === 'string' ? params.peerUserId : undefined,
          requestId: typeof params?.requestId === 'string' ? params.requestId : undefined,
        });
        if (!cancelled && resolved) {
          setConversationId(resolved);
          try {
            router.replace({ pathname: '/(tabs)/chat/[id]', params: { id: resolved } });
          } catch {}
        }
      } else {
        setConversationId(rawId);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, params?.peerUserId, params?.requestId]);

  // 1) Derive title via socket: verifyConversationParticipants → pick the "other" name
  React.useEffect(() => {
    if (!socket || !conversationId || conversationId === 'new') return;
    const onReply = (res: any) => {
      if (!res?.success) return;
      try {
        const me = String((socket as any).user?.id ?? '');
        const others = (res.data?.participants || []).filter((p: any) => String(p._id) !== me);
        const peer = others[0];
        const t = peer?.name || 'Conversation';
        setTitle(t);
      } catch {}
    };
    socket.once('verifyConversationParticipants', onReply);
    socket.emit('verifyConversationParticipants', conversationId);
    return () => {
      socket.off('verifyConversationParticipants', onReply);
    };
  }, [socket, conversationId]);

  // Android hardware back: go to Messages tab
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/messages');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  // 2) Real-time: listen for newMessage broadcasts (server sends newest first)
  React.useEffect(() => {
    if (!socket || !conversationId || conversationId === 'new') return;

    const handleNewMessage = (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const m = evt.data;
      if (String(m?.conversationId) !== String(conversationId)) return;

      const fromMe = isMyMessage(String(m?.senderId?._id || m?.senderId), myId || 'me');
      if (fromMe) {
        return;
      }

      const createdAt = new Date(m.createdAt ?? Date.now()).toISOString();
      const local: LocalMessage = {
        id: String(m._id),
        conversationId: String(m.conversationId),
        from: String(m.senderId?._id || m.senderId),
        text: String(m.content ?? ''),
        imageUri: attachMap[String(m._id)] || (m.attachment ? String(m.attachment) : null),
        createdAt,
      };

      setMessages((prev) => {
        const exists = prev.some((x) => x.id === local.id);
        if (exists) {
          return prev.map((x) => (x.id === local.id ? { ...local, pending: false, failed: false } : x));
        }

        return [local, ...prev].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      });
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, conversationId, attachMap]);

  // 3) Load attachments first, then messages
  React.useEffect(() => {
    if (!conversationId || conversationId === 'new') return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const map = await loadAttachmentsMap(conversationId);
        if (!mounted) return;
        setAttachMap(map);

        const items = await fetchMessages(conversationId);
        if (!mounted) return;

        const sortedDesc = [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        const enriched: LocalMessage[] = sortedDesc.map((m) => ({
          ...m,
          imageUri: map[m.id] ?? null,
        }));
        setMessages(enriched);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [conversationId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !conversationId || conversationId === 'new') return;
    setInput('');
    await sendTextMessage(
      conversationId,
      myId || 'me',
      text,
      (msg) => setMessages((prev) => [
        { ...msg, from: myId || 'me' },
        ...prev,
      ]),
      (tmpId, saved) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === tmpId);
          const normalized = {
            ...(saved as LocalMessage),
            from: myId || 'me',
            pending: false,
            failed: false,
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = normalized;
            return next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
          }
          return [normalized, ...prev].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        });
      },
      (tmpId) => {
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
      }
    );
  }

  // ---- Attachments ----
  async function handleCamera() {
    if (!conversationId || conversationId === 'new') return;
    const uri = await pickFromCamera();
    if (uri) {
      await sendImageMessage(
        conversationId,
        myId || 'me',
        uri,
        (msg) => setMessages((prev) => [
          { ...msg, from: myId || 'me' },
          ...prev,
        ]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            const normalized = {
              ...(saved as LocalMessage),
              from: myId || 'me',
              imageUri,
              text: (saved as LocalMessage)?.text ?? '',
              pending: false,
              failed: false,
            };
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = normalized;
            next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
            return next;
          });
        },
        (tmpId) => {
          setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
        }
      );
    }
  }

  async function handleLibrary() {
    if (!conversationId || conversationId === 'new') return;
    const uri = await pickFromLibrary();
    if (uri) {
      await sendImageMessage(
        conversationId,
        myId || 'me',
        uri,
        (msg) => setMessages((prev) => [
          { ...msg, from: myId || 'me' },
          ...prev,
        ]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            const normalized = {
              ...(saved as LocalMessage),
              from: myId || 'me',
              imageUri,
              text: (saved as LocalMessage)?.text ?? '',
              pending: false,
              failed: false,
            };
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = normalized;
            next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
            return next;
          });
        },
        (tmpId) => {
          setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
        }
      );
    }
  }

  const renderItem = ({ item }: { item: LocalMessage }) => {
    const mine = isMyMessage(String(item.from), myId || 'me');
    return (
      <MessageBubble
        msg={item}
        isMine={!!mine}
        onImagePress={(uri) => setViewerUri(uri)}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/messages')}
            accessibilityRole="button"
            accessibilityLabel="Go back to messages"
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icons.ArrowLeft size={22} color={TEXT_DARK} weight="bold" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.rightSpacer} />
        </View>
      </View>

      <View style={styles.listWrap}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator /></View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.inputBar}>
        <TouchableOpacity
          onPress={() => openAttachmentPicker(handleCamera, handleLibrary)}
          style={styles.attachBtn}
          accessibilityLabel="Add attachment"
        >
          <Icons.Plus size={20} color={TEXT_DARK} weight="bold" />
        </TouchableOpacity>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Icons.PaperPlaneRight size={22} color={TEXT_DARK} weight="fill" />
        </TouchableOpacity>
      </View>

      <ImageViewing
        images={viewerUri ? [{ uri: viewerUri }] : []}
        imageIndex={0}
        visible={!!viewerUri}
        onRequestClose={() => setViewerUri(null)}
        presentationStyle="fullScreen"
        backgroundColor="rgba(0,0,0,0.95)"
      />
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  msg,
  isMine,
  onImagePress,
}: {
  msg: LocalMessage;
  isMine: boolean;
  onImagePress: (uri: string) => void;
}) {
  const hasImage = !!msg.imageUri;

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          hasImage && styles.bubbleImage,
        ]}
      >
        {hasImage ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => msg.imageUri && onImagePress(msg.imageUri)}>
            <Image source={{ uri: msg.imageUri! }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}

        {msg.text ? (
          <Text style={[styles.msgText, isMine ? styles.msgMine : styles.msgTheirs]}>
            {msg.text}
          </Text>
        ) : null}

        {msg.pending ? (
          <Text style={[styles.meta, isMine ? styles.metaMine : styles.metaTheirs]}>Sending…</Text>
        ) : msg.failed ? (
          <Text style={[styles.meta, { color: '#ff6b6b' }]}>Failed</Text>
        ) : null}
      </View>
    </View>
  );
}

const HEADER_CONTENT_HEIGHT = 64;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: MINE_BG,
  },
  headerBar: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: 18,
    fontFamily: 'Inter-Black',
    marginTop: 2,
  },
  rightSpacer: { width: 44 },

  listWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 12, paddingBottom: 16 },

  row: { width: '100%', marginVertical: 4, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  bubbleMine: { backgroundColor: MINE_BG, borderTopRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#1C1C1C', borderTopLeftRadius: 4 },

  bubbleImage: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },

  msgText: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter-Bold' },
  msgMine: { color: TEXT_DARK, textAlign: 'left' },
  msgTheirs: { color: TEXT_LIGHT, textAlign: 'left' },

  image: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },

  meta: { marginTop: 4, fontSize: 11, opacity: 0.8, fontFamily: 'Inter-Bold' },
  metaMine: { color: '#124e1f' },
  metaTheirs: { color: '#9AA09C' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C0FFCB',
    borderWidth: 2,
    borderColor: '#000000ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#151515',
    color: TEXT_LIGHT,
    fontSize: 15,
    fontFamily: 'Inter-Bold',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#C0FFCB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
