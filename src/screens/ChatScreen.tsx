import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {Animated, type NativeSyntheticEvent, type NativeScrollEvent} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import DocumentPicker, {
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import {C} from '../data/mockData';
import {sendMessage} from '../data/api';
import {enqueueUpload, uploadService, retryUpload as retryUploadFn} from '../services/uploadService';
import {useAppContext} from '../context/AppContext';

interface Message {
  role: 'in' | 'out';
  text: string;
  name?: string;
}

interface AttachmentPreview {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  progress: number;
  status: string;
}

type RootStackParamList = {
  Tabs: undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  DispatchChain: undefined;
};

const DISPATCH_STATUS_LABEL = {
  submitted: '已提交',
  dispatched: '执行中',
  processing: '处理中',
  completed: '已完成',
  failed: '执行失败',
} as const;

const CHAT_HISTORY_KEY = '@AIBrainIM:chatHistory';
// 不做产品层硬限制；长上下文+分层记忆+按需回补在后端处理，前端保留足够历史用于展示
const MAX_HISTORY = 300;

export function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {dispatches, registerDispatch, runtimeMode, runtimeError, refreshing, refresh} = useAppContext();
  const [draft, setDraft]   = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {role: 'in', name: '助理', text: '我已上线，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。'},
  ]);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [queuedAttachmentIds, setQueuedAttachmentIds] = useState<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef   = useRef<ScrollView>(null);
  const lastDispatchIdRef = useRef<string | undefined>(undefined);
  // Animated typing indicator — three dots pulse in sequence
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!typing) {
      dot1.setValue(0); dot2.setValue(0); dot3.setValue(0);
      return;
    }
    const makeLoop = (dot: Animated.Value, _delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {toValue: 1, duration: 380, useNativeDriver: true}),
          Animated.timing(dot, {toValue: 0, duration: 380, useNativeDriver: true}),
        ]),
      );
    const a1 = makeLoop(dot1, 0);
    const a2 = makeLoop(dot2, 160);
    const a3 = makeLoop(dot3, 320);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [typing, dot1, dot2, dot3]);

  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeAttachments = useMemo(() => Array.isArray(attachments) ? attachments : [], [attachments]);

  // ── Chat history persistence ─────────────────────────────────────────
  const [historyRestored, setHistoryRestored] = useState(false);

  // Load persisted history on mount
  useEffect(() => {
    AsyncStorage.getItem(CHAT_HISTORY_KEY)
      .then(json => {
        if (!json) return;
        try {
          const saved: Message[] = JSON.parse(json);
          if (Array.isArray(saved) && saved.length > 0) {
            setMessages(prev => {
              // If user hasn't sent anything new yet, restore full history
              if (prev.length <= 1) return saved;
              // Otherwise just add restored messages to avoid duplicates
              const existing = new Set(prev.map(m => `${m.role}:${m.text}`));
              const newOnes = saved.filter(m => !existing.has(`${m.role}:${m.text}`));
              return [...prev, ...newOnes];
            });
            setHistoryRestored(true);
            setTimeout(() => {
              setHistoryRestored(false);
              scrollRef.current?.scrollToEnd({animated: true});
            }, 800);
          }
        } catch { /* ignore corrupt storage */ }
      })
      .catch(() => { /* ignore storage errors */ });
  }, []);

  // Persist messages whenever they change (after initial mount)
  useEffect(() => {
    if (messages.length <= 1) return; // don't persist just the welcome message
    const toSave = messages.slice(-MAX_HISTORY);
    AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [messages]);

  // ── Dispatch status updates ───────────────────────────────────────────
  useEffect(() => {
    const latest = safeDispatches[0];
    if (!latest || latest.id === lastDispatchIdRef.current) {
      return;
    }

    lastDispatchIdRef.current = latest.id;

    const statusText =
      latest.status === 'completed' ? '已完成'
      : latest.status === 'failed' ? '执行失败'
      : latest.status === 'dispatched' ? '执行中'
      : latest.status === 'processing' ? '处理中'
      : '已提交';

    const detail = latest.taskId
      ? `taskId=${latest.taskId}${latest.dispatchId ? ` · dispatchId=${latest.dispatchId}` : ''}`
      : latest.dispatchId
        ? `dispatchId=${latest.dispatchId}`
        : '等待后端继续回填';

    setMessages(messagesNow => {
      const text = `🛰 调度状态更新：${statusText} · ${detail}`;
      const alreadyExists = messagesNow.some(msg => msg.role === 'in' && msg.text === text);
      if (alreadyExists) {
        return messagesNow;
      }
      return [...messagesNow, {role: 'in', name: '助理', text}];
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 150);
  }, [safeDispatches]);

  // Sync attachment previews from upload queue
  const syncAttachments = useCallback(() => {
    const files = uploadService.getQueue();
    const preview = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      sizeLabel: uploadService.formatBytes(f.size),
      progress: f.progress,
      status: f.status,
    }));
    setAttachments(preview);
  }, []);

  const queuedAttachmentSummaries = useMemo(
    () => safeAttachments.filter(att => queuedAttachmentIds.includes(att.id)),
    [safeAttachments, queuedAttachmentIds],
  );

  const clearQueuedAttachment = useCallback((id: string) => {
    setQueuedAttachmentIds(ids => ids.filter(item => item !== id));
  }, []);

  const trackAttachment = useCallback((fileId: string) => {
    setQueuedAttachmentIds(ids => Array.from(new Set([...ids, fileId])));
  }, []);

  // ── File picking handlers ───────────────────────────────────────────────

  const handlePickImage = useCallback(() => {
    launchImageLibrary(
      {mediaType: 'mixed', selectionLimit: 0},
      (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        (res.assets ?? []).forEach(asset => {
          if (!asset.uri) return;
          const name = asset.fileName ?? `image_${Date.now()}`;
          const size = asset.fileSize ?? 0;
          const mime = asset.type ?? 'image/jpeg';
          void enqueueUpload(name, asset.uri, mime, size).then(_f => {
            const fileId = _f.id;
            trackAttachment(fileId);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📎 已收到附件「${name}」（${uploadService.formatBytes(size)}），正在上传处理中…`,
              },
            ]);
            // Poll for attachment status update and notify user
            const pollAttachment = setInterval(() => {
                const updated = uploadService.getFile(fileId);
                if (!updated) { clearInterval(pollAttachment); return; }
                syncAttachments();
                if (updated.status === 'dispatched') {
                  clearInterval(pollAttachment);
                  setMessages(ms => [
                    ...ms,
                    {
                      role: 'in',
                      name: '助理',
                      text: `📎 附件「${updated.name}」已上传并分派给 ${updated.agent ?? 'AI'} 处理。`,
                    },
                  ]);
                } else if (updated.status === 'error') {
                  clearInterval(pollAttachment);
                  setMessages(ms => [
                    ...ms,
                    {
                      role: 'in',
                      name: '助理',
                      text: `⚠️ 附件「${updated.name}」上传失败：${updated.error}`,
                    },
                  ]);
                }
              }, 1000);
          });
        });
      },
    );
  }, [syncAttachments, trackAttachment]);

  const handleTakePhoto = useCallback(() => {
    launchCamera(
      {mediaType: 'mixed', saveToPhotos: false},
      (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        (res.assets ?? []).forEach(asset => {
          if (!asset.uri) return;
          const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
          const size = asset.fileSize ?? 0;
          const mime = asset.type ?? 'image/jpeg';
          void enqueueUpload(name, asset.uri, mime, size).then(_f => {
            trackAttachment(_f.id);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📷 已拍摄「${name}」，正在上传处理…`,
              },
            ]);
          });
        });
      },
    );
  }, [syncAttachments, trackAttachment]);

  const handlePickDocument = useCallback(() => {
    DocumentPicker.pick({allowMultiSelection: true})
      .then((results: DocumentPickerResponse[]) => {
        results.forEach(doc => {
          if (!doc.uri) return;
          void enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0).then(_f => {
            trackAttachment(_f.id);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📄 文档「${doc.name}」已加入上传队列（${uploadService.formatBytes(doc.size ?? 0)}）。`,
              },
            ]);
          });
        });
      })
      .catch((err: unknown) => {
        if (DocumentPicker.isCancel(err)) return;
        Alert.alert('选择失败', String(err));
      });
  }, [syncAttachments, trackAttachment]);

  const handleRetryAttachment = useCallback((id: string) => {
    retryUploadFn(id);
    syncAttachments();
    setMessages(m => [
      ...m,
      {
        role: 'in',
        name: '助理',
        text: '↻ 正在重试上传，请稍候…',
      },
    ]);
  }, [syncAttachments]);

  const TYPE_CHIP_HANDLERS: Record<string, () => void> = {
    '图片':      handlePickImage,
    '视频':      handlePickImage,   // image picker 也支持视频
    'PDF/文档':  handlePickDocument,
    '压缩包':    handlePickDocument,
    '矿山资料':  handlePickDocument,
    '代码文件':  handlePickDocument,
  };

  const latestDispatch = safeDispatches[0];

  useEffect(() => {
    if (!queuedAttachmentIds.length) {
      return;
    }

    const activeIds = new Set(safeAttachments.map(item => item.id));
    const doneIds = queuedAttachmentIds.filter(id => !activeIds.has(id));
    if (doneIds.length > 0) {
      setQueuedAttachmentIds(ids => ids.filter(id => !doneIds.includes(id)));
    }
  }, [safeAttachments, queuedAttachmentIds]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    const userText = draft.trim();
    const attachmentContext = queuedAttachmentSummaries.length > 0
      ? `\n\n[附件上下文]\n${queuedAttachmentSummaries.map(att => `- ${att.name} · ${att.sizeLabel} · ${att.status}`).join('\n')}`
      : '';
    const outboundText = `${userText}${attachmentContext}`;

    setMessages(m => [...m, {role: 'out', text: userText}]);
    setDraft('');
    setSending(true);
    setTyping(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);

    try {
      const {reply, sent, taskId, dispatchId, sessionKey} = await sendMessage(outboundText);

      registerDispatch({
        userText: queuedAttachmentSummaries.length > 0
          ? `${userText}（携带 ${queuedAttachmentSummaries.length} 个附件）`
          : userText,
        reply,
        taskId,
        dispatchId,
        sessionKey,
        sent,
        source: 'chat',
      });

      // Sync the rest of the app (Dashboard AI feed, Agent status, Task/Kanban)
      // so the send action immediately reflects everywhere without requiring pull-to-refresh.
      void refresh();

      if (sent && queuedAttachmentSummaries.length > 0) {
        setMessages(m => [
          ...m,
          {
            role: 'in',
            name: '助理',
            text: `📎 本轮指令已携带 ${queuedAttachmentSummaries.length} 个附件上下文，一并进入调度链。`,
          },
        ]);
        queuedAttachmentSummaries.forEach(att => clearQueuedAttachment(att.id));
      }

      setMessages(m => [...m, {role: 'in', name: '助理', text: reply}]);
    } catch (err) {
      setMessages(m => [
        ...m,
        {
          role: 'in',
          name: '助理',
          text: `⚠️ 发送失败：${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setSending(false);
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 150);
    }
  }, [
    clearQueuedAttachment,
    draft,
    queuedAttachmentSummaries,
    registerDispatch,
    refresh,
    sending,
  ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>AI 对话</Text>
            <Text style={styles.sub}>OpenClaw · 调度中枢</Text>
          </View>
          {messages.length > 2 && (
            <TouchableOpacity
              style={styles.clearHistoryBtn}
              activeOpacity={0.75}
              onPress={() => {
                Alert.alert(
                  '清空对话历史',
                  '确定清空所有对话记录？此操作不可撤销。',
                  [
                    {text: '取消', style: 'cancel'},
                    {
                      text: '清空',
                      style: 'destructive',
                      onPress: () => {
                        const welcome: Message = {role: 'in', name: '助理', text: '我已上线，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。'};
                        setMessages([welcome]);
                        AsyncStorage.removeItem(CHAT_HISTORY_KEY).catch(() => {});
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.clearHistoryBtnText}>清空记录</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.entryRow}>
          <TouchableOpacity style={styles.entryChip} activeOpacity={0.8} onPress={() => navigation.navigate('MemoryStore')}>
            <Text style={styles.entryChipText}>记忆库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.entryChip} activeOpacity={0.8} onPress={() => navigation.navigate('KnowledgeBase')}>
            <Text style={styles.entryChipText}>知识库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.entryChip} activeOpacity={0.8} onPress={() => navigation.navigate('FileLibrary')}>
            <Text style={styles.entryChipText}>附件库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.entryChip} activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
            <Text style={styles.entryChipText}>调度链</Text>
          </TouchableOpacity>
        </View>
        {runtimeMode === 'fallback' && (
          <View style={styles.gatewayBanner}>
            <Text style={styles.gatewayBannerText}>
              ⚠️ Gateway 不可用 · 消息暂存本地 · {runtimeError ? `原因：${runtimeError}` : '检查网络后自动重连'}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
            const atBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - 60;
            setShowScrollBtn(!atBottom);
          }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={C.primary}
            />
          }
        >
          <View style={styles.dispatchStatusCard}>
            <View style={styles.dispatchStatusTop}>
              <Text style={styles.dispatchStatusTitle}>当前调度状态</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
                <Text style={styles.dispatchStatusLink}>查看链路</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dispatchStatusSummary}>
              {sending
                ? '指令提交中…'
                : latestDispatch
                  ? `调度状态：${DISPATCH_STATUS_LABEL[latestDispatch.status]} · ${latestDispatch.taskId ?? 'taskId 回填中'}`
                  : '暂无调度记录'}
            </Text>
            {queuedAttachmentSummaries.length > 0 ? (
              <Text style={styles.dispatchAttachmentHint}>
                当前待随消息一并进入调度链的附件：{queuedAttachmentSummaries.length} 个
              </Text>
            ) : null}
            {latestDispatch ? (
              <Text style={styles.dispatchStatusMeta}>
                dispatchId: {latestDispatch.dispatchId ?? '未生成'}{latestDispatch.sessionKey ? ` · session: ${latestDispatch.sessionKey}` : ''}
              </Text>
            ) : null}
          </View>
          {messages.map((msg, i) =>
            msg.role === 'in' ? (
              <View key={i} style={styles.msgIn}>
                <Text style={styles.msgName}>{msg.name}</Text>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ) : (
              <View key={i} style={styles.msgOut}>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            )
          )}

          {/* History restored toast */}
          {historyRestored && (
            <View style={styles.historyRestoredBanner}>
              <Text style={styles.historyRestoredText}>📜 本地会话历史已恢复</Text>
            </View>
          )}

          {/* Typing indicator — animated bounce dots */}
          {typing && (
            <View style={styles.msgIn}>
              <Text style={styles.msgName}>助理</Text>
              <View style={{flexDirection:'row', alignItems:'center', paddingTop:4, gap:5}}>
                {[dot1, dot2, dot3].map((dot, i) => (
                  <Animated.Text
                    key={i}
                    style={[
                      styles.typingDot,
                      {opacity: dot.interpolate({inputRange: [0, 1], outputRange: [0.25, 1]})},
                    ]}
                  >●</Animated.Text>
                ))}
              </View>
            </View>
          )}

          {/* Upload panel */}
          <View style={styles.uploadPanel}>
            <Text style={styles.uploadTitle}>📎 附件上传</Text>
            <Text style={styles.uploadHint}>无大小限制 · 大文件自动后台处理 · 断点续传</Text>
            <View style={styles.chipRow}>
              {(['图片', '视频', 'PDF/文档', '压缩包', '矿山资料', '代码文件'] as string[]).map((type: string) => (
                <TouchableOpacity
                  key={type}
                  style={styles.chip}
                  activeOpacity={0.75}
                  onPress={TYPE_CHIP_HANDLERS[type] ?? handlePickDocument}
                >
                  <Text style={styles.chipText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Camera shortcut */}
            <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.8} onPress={handleTakePhoto}>
              <Text style={styles.cameraBtnText}>📷 拍照上传</Text>
            </TouchableOpacity>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <View style={styles.attachmentList}>
                <Text style={styles.attachmentListTitle}>上传队列</Text>
                {queuedAttachmentSummaries.length > 0 ? (
                  <Text style={styles.attachmentQueueHint}>
                    已选 {queuedAttachmentSummaries.length} 个附件，将在下一条消息发送时一并携带上下文
                  </Text>
                ) : null}
                {attachments.map(att => {
                  const isLargeFile = att.sizeLabel !== '未知大小' &&
                    (att.sizeLabel.includes('MB') || att.sizeLabel.includes('GB'));
                  const statusColor =
                    att.status === 'done' || att.status === 'dispatched' ? '#34d399'
                    : att.status === 'error' ? '#f87171'
                    : att.status === 'uploading' ? '#38bdf8'
                    : att.status === 'processing' ? '#fbbf24'
                    : '#64748b';
                  const statusLabel =
                    att.status === 'queued' ? '等待上传'
                    : att.status === 'uploading' ? `上传中 ${att.progress}%`
                    : att.status === 'processing' ? 'AI 分析中'
                    : att.status === 'dispatched' ? '已分派'
                    : att.status === 'done' ? '已完成'
                    : att.status === 'error' ? '失败'
                    : att.status;
                  return (
                    <View key={att.id} style={styles.attachmentItem}>
                      <View style={styles.attachmentItemLeft}>
                        <View style={styles.attachmentNameRow}>
                          <Text style={styles.attachmentName} numberOfLines={1}>{att.name}</Text>
                          {isLargeFile && (
                            <View style={styles.largeFileBadge}>
                              <Text style={styles.largeFileBadgeText}>大文件</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.attachmentMeta, {color: statusColor}]}>
                          {att.sizeLabel} · {statusLabel}
                        </Text>
                        {att.status === 'uploading' && isLargeFile && (
                          <Text style={styles.chunkHint}>
                            ≥10MB 文件自动分片上传，断点续传
                          </Text>
                        )}
                        {att.status === 'processing' && isLargeFile && (
                          <Text style={styles.chunkHint}>
                            后台 AI 分析中，结果自动回流
                          </Text>
                        )}
                      </View>
                      {att.status === 'uploading' || att.status === 'processing' ? (
                        <View style={styles.progressBarContainer}>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {width: `${att.progress}%`}]} />
                          </View>
                          <Text style={styles.progressPct}>{att.progress}%</Text>
                        </View>
                      ) : att.status === 'error' ? (
                        <TouchableOpacity
                          style={styles.retryBtn}
                          activeOpacity={0.75}
                          onPress={() => handleRetryAttachment(att.id)}
                        >
                          <Text style={styles.retryBtnText}>重试</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.attachmentStatus, {color: statusColor}]}>
                          {att.status === 'dispatched' ? '✓' : att.status === 'done' ? '✓' : att.status === 'queued' ? '⏳' : '✓'}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {showScrollBtn && (
          <TouchableOpacity
            style={styles.scrollFab}
            activeOpacity={0.8}
            onPress={() => scrollRef.current?.scrollToEnd({animated: true})}
          >
            <Text style={styles.scrollFabIcon}>↓</Text>
          </TouchableOpacity>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="输入 AI 调度指令…"
              placeholderTextColor={C.textMuted}
              style={styles.input}
              multiline
              editable={!sending}
            />
            <Text style={styles.inputHint}>
              {sending ? '正在提交到 OpenClaw 调度链…' : '消息直接发送至 OpenClaw Gateway'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? '发送中' : '发送'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  flex:         {flex: 1},
  header:       {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title:        {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:          {color: C.textMuted, fontSize: 12, marginTop: 4},
  clearHistoryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  clearHistoryBtnText: {color: '#f87171', fontSize: 11, fontWeight: '800'},
  entryRow:     {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  entryChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  entryChipText: {color: C.primary, fontSize: 12, fontWeight: '800'},
  gatewayBanner: {
    marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  historyRestoredBanner: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  historyRestoredText: {color: '#34d399', fontSize: 11, fontWeight: '800'},
  gatewayBannerText: {color: '#f87171', fontSize: 11, fontWeight: '700'},
  chatContent:  {padding: 16, paddingBottom: 16},

  msgIn: {
    alignSelf: 'flex-start', maxWidth: '90%',
    padding: 13, borderRadius: 18, borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(16,31,51,0.8)',
    marginBottom: 10, borderWidth: 1, borderColor: C.borderSubtle,
  },
  msgOut: {
    alignSelf: 'flex-end', maxWidth: '90%',
    padding: 13, borderRadius: 18, borderBottomRightRadius: 6,
    backgroundColor: 'rgba(2,132,199,0.25)',
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
  },
  msgName: {color: C.primary, fontSize: 11, fontWeight: '800', marginBottom: 4},
  typingDot: {color: C.primary, fontSize: 18, marginRight: 4, lineHeight: 22},
  msgText: {color: C.textBody, fontSize: 14, lineHeight: 20},

  dispatchStatusCard: {
    padding: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(9,20,38,0.72)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginBottom: 12,
  },
  dispatchStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dispatchStatusTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  dispatchStatusLink: {color: C.primary, fontSize: 12, fontWeight: '800'},
  dispatchStatusSummary: {color: C.textBody, fontSize: 13, lineHeight: 19, marginTop: 8},
  dispatchStatusMeta: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6},
  dispatchAttachmentHint: {color: C.primary, fontSize: 11, lineHeight: 16, marginTop: 6, fontWeight: '700'},

  uploadPanel: {
    padding: 13, borderRadius: 18,
    backgroundColor: 'rgba(8,18,36,0.6)',
    borderWidth: 1, borderColor: C.borderSubtle,
    marginBottom: 12,
  },
  uploadTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  uploadHint:  {color: C.textMuted, fontSize: 11, marginTop: 4},
  chipRow:     {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  chip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  chipText: {color: C.primary, fontSize: 12, fontWeight: '800'},

  inputRow: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    backgroundColor: C.bgRoot,
  },
  inputWrap: {flex: 1},
  input: {
    minHeight: 44, maxHeight: 96,
    borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1, borderColor: C.borderSubtle,
    fontSize: 14,
  },
  inputHint: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sendBtn: {
    height: 44, paddingHorizontal: 18, borderRadius: 16,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: {opacity: 0.4},
  sendText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},

  scrollFab: {
    position: 'absolute',
    right: 18,
    bottom: 90,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56,100,200,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollFabIcon: {color: '#fff', fontSize: 20, fontWeight: '900', marginTop: -2},

  cameraBtn: {
    marginTop: 10,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(2,132,199,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    alignSelf: 'flex-start',
  },
  cameraBtnText: {color: C.primary, fontSize: 13, fontWeight: '800'},

  attachmentList: {marginTop: 12, gap: 8},
  attachmentListTitle: {color: C.textMuted, fontSize: 11, fontWeight: '800', marginBottom: 4},
  attachmentQueueHint: {color: C.primary, fontSize: 11, lineHeight: 16, marginBottom: 6},
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  attachmentItemLeft: {flex: 1},
  attachmentNameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  attachmentName: {color: C.textBody, fontSize: 13, fontWeight: '700', flex: 1},
  attachmentMeta: {color: C.textMuted, fontSize: 11, marginTop: 3},
  largeFileBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  largeFileBadgeText: {color: '#fbbf24', fontSize: 9, fontWeight: '900'},
  chunkHint: {
    color: C.textMuted, fontSize: 10, marginTop: 3,
    fontStyle: 'italic',
  },
  attachmentStatus: {fontSize: 16, fontWeight: '900'},
  progressBarContainer: {alignItems: 'flex-end', gap: 3},
  progressBar: {
    width: 60, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(56,100,200,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: C.primary,
  },
  progressPct: {color: C.textMuted, fontSize: 9, fontWeight: '700'},
  retryBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  retryBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
  },
});
