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
import {
  fetchMessages,
  getConversation
} from '../features/messages/api';
import { ensureConversationId } from '../features/messages/ensureConvId';
import {
  LocalMessage,
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
  const [meId, setMeId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState<string>('Chat');
  const [loading, setLoading] = React.useState(true);

  // NEWEST first (DESC) for inverted FlatList
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [input, setInput] = React.useState('');

  // Persisted local attachments (messageId -> uri)
  const [attachMap, setAttachMap] = React.useState<Record<string, string>>({});

  // Lightbox (zoomable) state
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);

  // 0) Resolve/ensure a real conversation id if we arrived as "new"
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const rawId = initialId?.trim();
      // If the id is missing/placeholder, resolve it using peerUserId or requestId
      if (!rawId || rawId === 'new') {
        const resolved = await ensureConversationId(undefined, {
          peerUserId: typeof params?.peerUserId === 'string' ? params.peerUserId : undefined,
          requestId: typeof params?.requestId === 'string' ? params.requestId : undefined,
        });
        if (!cancelled && resolved) {
          setConversationId(resolved);
          // Replace the route param silently so any future navigations reuse the real id
          try {
            router.replace({ pathname: '/(tabs)/chat/[id]', params: { id: resolved } });
          } catch {}
        }
      } else {
        setConversationId(rawId);
      }
    })();

    return () => { cancelled = true; };
    // only on first mount or when incoming params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, params?.peerUserId, params?.requestId]);

  // 1) Load current user id from JWT
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = await tokens.getUserIdAsync();
      if (mounted) setMeId(uid ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  // 2) Load conversation meta (for title/peer) once we have a real id
  React.useEffect(() => {
    if (!conversationId || conversationId === 'new') return;
    let mounted = true;
    (async () => {
      try {
        const conv = await getConversation(conversationId);
        if (mounted) {
          const t =
            conv?.peer?.name ||
            conv?.peer?.username ||
            conv?.peer?.phone ||
            conv?.title ||
            'Chat';
          setTitle(t);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [conversationId]);

  // Android hardware back: go to Messages tab
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/messages');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  // 3) Real-time socket listeners for database changes (after id exists)
  React.useEffect(() => {
    if (!socket || !conversationId || conversationId === 'new') return;

    const handleConversationDeleted = (data: { conversationId: string }) => {
      if (data.conversationId === conversationId) {
        router.replace('/(tabs)/messages');
      }
    };

    const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      }
    };

    const handleNewMessage = (data: { message: any; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        const newMessage: LocalMessage = {
          ...data.message,
          imageUri: attachMap[data.message.id] || null,
        };
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) return prev;
          return [newMessage, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    };

    socket.on('conversation:deleted', handleConversationDeleted);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:created', handleNewMessage);

    return () => {
      socket.off('conversation:deleted', handleConversationDeleted);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:created', handleNewMessage);
    };
  }, [socket, conversationId, router, attachMap]);

  // 4) Load attachments map first, then messages (so we can enrich with imageUri on first render)
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

        const sortedDesc = [...items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

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
    if (!text || !meId) return;
    if (!conversationId || conversationId === 'new') {
      // no valid conversation id yet
      return;
    }

    setInput('');

    await sendTextMessage(
      conversationId,
      meId,
      text,
      (msg) => setMessages((prev) => [msg, ...prev]),
      (tmpId, saved) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === tmpId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...(saved as LocalMessage), pending: false };
            next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return next;
          }
          return [saved as LocalMessage, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      },
      (tmpId) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m))
        );
      }
    );
  }

  // ---- Attachments ----
  async function handleCamera() {
    if (!conversationId || conversationId === 'new' || !meId) return;
    const uri = await pickFromCamera();
    if (uri) {
      await sendImageMessage(
        conversationId,
        meId,
        uri,
        (msg) => setMessages((prev) => [msg, ...prev]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = {
              ...(saved as LocalMessage),
              imageUri,
              text: '',
              pending: false,
            };
            next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    if (!conversationId || conversationId === 'new' || !meId) return;
    const uri = await pickFromLibrary();
    if (uri) {
      await sendImageMessage(
        conversationId,
        meId,
        uri,
        (msg) => setMessages((prev) => [msg, ...prev]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = {
              ...(saved as LocalMessage),
              imageUri,
              text: '',
              pending: false,
            };
            next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const isMine = meId && item.from === meId;
    return (
      <MessageBubble
        msg={item}
        isMine={!!isMine}
        onImagePress={(uri) => setViewerUri(uri)}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      {/* Status bar: black icons over your green header */}
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* Header (green extends under status bar; content sits below it) */}
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

      {/* Messages */}
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

      {/* Input + Attachment */}
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

      {/* Zoomable image viewer */}
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
