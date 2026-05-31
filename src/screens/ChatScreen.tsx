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
import {C, LAYOUT} from '../data/constants';
import {MessageBubble} from '../components/MessageBubble';
import {TaskDecomposeCard} from '../components/TaskDecomposeCard';
import {AgentCollaborationGraph} from '../components/AgentCollaborationGraph';
import type {Message as NewMessage} from '../types';
import {sendMessage} from '../data/api';
import {
  enqueueUpload,
  uploadService,
  retryUpload as retryUploadFn,
} from '../services/uploadService';
import {useAppContext} from '../context/AppContext';

interface LegacyMessage {
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
// 不做产品层硬限制；对话上下文由长上下文 + 分层记忆 + 按需回补承担
// 前端尽量保留完整本地历史，仅在存储失败时保持当前内存会话可用。

// ─── Message ID factory ─────────────────────────────────────────────────────────
function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Collaboration pattern detector ───────────────────────────────────────────
interface CollaborationPattern {
  fromNode: {agentId: string; agentName: string; action: string};
  toNode:   {agentId: string; agentName: string; action: string};
  timestamp: number;
}

function detectCollaboration(msgs: NewMessage[], at: number): CollaborationPattern | null {
  if (at < 1) return null;
  const prev = msgs[at - 1];
  const curr = msgs[at];
  if (
    prev.type === 'task-decompose' &&
    curr.type === 'subtask-create' &&
    prev.agentId !== undefined && curr.agentId !== undefined &&
    prev.agentId !== curr.agentId
  ) {
    return {
      fromNode: {agentId: prev.agentId, agentName: prev.agentName ?? prev.agentId, action: '拆解任务'},
      toNode:   {agentId: curr.agentId, agentName: curr.agentName ?? curr.agentId, action: '创建子任务'},
      timestamp: curr.timestamp,
    };
  }
  return null;
}

// ─── Message render helper ────────────────────────────────────────────────────
function renderMessageContent(
  item: NewMessage,
  collaboration: CollaborationPattern | null,
): React.ReactNode {
  if ((item.type === 'task-decompose' || item.type === 'subtask-create') && item.subTasks && item.subTasks.length > 0) {
    return (
      <View>
        {collaboration && (
          <AgentCollaborationGraph
            nodes={[collaboration.fromNode, collaboration.toNode]}
            links={[{from: collaboration.fromNode.agentId, to: collaboration.toNode.agentId, label: '分发'}]}
            timestamp={collaboration.timestamp}
          />
        )}
        <TaskDecomposeCard
          mainTaskTitle={item.content}
          subTasks={item.subTasks}
          agentName={item.agentName}
          agentId={item.agentId}
          timestamp={item.timestamp}
        />
      </View>
    );
  }
  if (item.type === 'subtask-complete') {
    const done  = item.subTasks?.filter((s) => s.status === 'done') ?? [];
    const total = item.subTasks?.length ?? 0;
    const timeStr = new Date(item.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
    return (
      <View style={{alignSelf: 'center', marginBottom: 10, width: '100%'}}>
        <View style={{alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)'}}>
          <Text style={{fontSize: 28, marginBottom: 6}}>✅</Text>
          <Text style={{color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center'}}>{item.content}</Text>
          {total > 0 && <Text style={{color: '#4DFF88', fontSize: 12, fontWeight: '700', marginTop: 4}}>{done.length}/{total} 子任务完成</Text>}
          <Text style={{color: '#64748B', fontSize: 10, marginTop: 4}}>{timeStr}</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      {collaboration && (
        <AgentCollaborationGraph
          nodes={[collaboration.fromNode, collaboration.toNode]}
          links={[{from: collaboration.fromNode.agentId, to: collaboration.toNode.agentId, label: '协作'}]}
          timestamp={collaboration.timestamp}
        />
      )}
      <MessageBubble message={item} />
    </View>
  );
}

export function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    dispatches,
    tasks,
    confirmations,
    uploads,
    registerDispatch,
    runtimeMode,
    runtimeError,
    refreshing,
    refresh,
  } = useAppContext();
  const [draft, setDraft]   = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const [messages, setMessages] = useState<LegacyMessage[]>([
    {role: 'in', name: '助理', text: '我已上线,随时接收指令。回复将显示在下方,可前往「智能体」查看调度详情。'},
  ]);
  // ── New unified message list for AI↔AI collaboration rendering ────────────
  const [allMessages, setAllMessages] = useState<NewMessage[]>([{
    id: makeMessageId(),
    type: 'text',
    role: 'agent',
    agentName: '助理',
    content: '我已上线，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。',
    timestamp: Date.now(),
  }]);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [queuedAttachmentIds, setQueuedAttachmentIds] = useState<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef   = useRef<ScrollView>(null);
  const lastDispatchIdRef = useRef<string | undefined>(undefined);
  const timeoutHandlesRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const attachmentPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // Animated typing indicator - three dots pulse in sequence
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
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeConfirmations = useMemo(() => Array.isArray(confirmations) ? confirmations : [], [confirmations]);
  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const safeAttachments = useMemo(() => Array.isArray(attachments) ? attachments : [], [attachments]);

  // ── Chat history persistence ─────────────────────────────────────────
  const [historyRestored, setHistoryRestored] = useState(false);

  // Load persisted history on mount
  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const handle = setTimeout(() => {
      timeoutHandlesRef.current = timeoutHandlesRef.current.filter(item => item !== handle);
      fn();
    }, ms);
    timeoutHandlesRef.current.push(handle);
    return handle;
  }, []);

  const clearAttachmentPoller = useCallback((fileId: string) => {
    const handle = attachmentPollersRef.current[fileId];
    if (!handle) {
      return;
    }
    clearInterval(handle);
    delete attachmentPollersRef.current[fileId];
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_HISTORY_KEY)
      .then(json => {
        if (!json) return;
        try {
          const saved: LegacyMessage[] = JSON.parse(json);
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
            scheduleTimeout(() => {
              setHistoryRestored(false);
              scrollRef.current?.scrollToEnd({animated: true});
            }, 800);
          }
        } catch { /* ignore corrupt storage */ }
      })
      .catch(() => { /* ignore storage errors */ });
  }, [scheduleTimeout]);

  // Persist messages whenever they change (after initial mount)
  useEffect(() => {
    if (messages.length <= 1) return; // don't persist just the welcome message
    AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)).catch(() => {
      // 当本地存储空间不足时，不主动截断用户上下文；保持当前会话可继续。
    });
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
      const text = `🛰 调度状态更新:${statusText} · ${detail}`;
      const alreadyExists = messagesNow.some(msg => msg.role === 'in' && msg.text === text);
      if (alreadyExists) {
        return messagesNow;
      }
      return [...messagesNow, {role: 'in', name: '助理', text}];
    });

    scheduleTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 150);
  }, [safeDispatches, scheduleTimeout]);

  // Sync attachment previews from upload queue
  const syncAttachments = useCallback(() => {
    const files = uploadService.getQueue();
    const selectedIds = new Set(uploadService.getFilesForNextDispatch().map(file => file.id));
    const preview = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      sizeLabel: uploadService.formatBytes(f.size),
      progress: f.progress,
      status: f.status,
    }));
    setAttachments(preview);
    setQueuedAttachmentIds(Array.from(selectedIds));
  }, []);

  const queuedAttachmentSummaries = useMemo(
    () => safeAttachments.filter(att => queuedAttachmentIds.includes(att.id)),
    [safeAttachments, queuedAttachmentIds],
  );

  const queuedReadyCount = useMemo(
    () => queuedAttachmentSummaries.filter(att => att.status === 'done' || att.status === 'dispatched' || att.status === 'processing').length,
    [queuedAttachmentSummaries],
  );

  const queuedWaitingCount = Math.max(0, queuedAttachmentSummaries.length - queuedReadyCount);

  const queuedAttachmentStatusText = queuedAttachmentSummaries.length > 0
    ? queuedWaitingCount > 0
      ? `${queuedAttachmentSummaries.length} 个附件已选 · ${queuedWaitingCount} 个仍在上传/排队，发送后会按当前状态进入调度链`
      : `${queuedAttachmentSummaries.length} 个附件已就绪，可直接发给 AI 分析`
    : '';

  const clearQueuedAttachment = useCallback((id: string) => {
    uploadService.unmarkFileForNextDispatch(id);
    setQueuedAttachmentIds(ids => ids.filter(item => item !== id));
  }, []);

  const trackAttachment = useCallback((fileId: string, autoSelect = false) => {
    if (autoSelect) {
      uploadService.markFileForNextDispatch(fileId);
    }
    setQueuedAttachmentIds(ids => {
      if (!autoSelect) {
        return ids;
      }
      return Array.from(new Set([...ids, fileId]));
    });
  }, []);

  useEffect(() => {
    syncAttachments();
  }, [syncAttachments]);

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
          enqueueUpload(name, asset.uri, mime, size).then(_f => {
            const fileId = _f.id;
            trackAttachment(fileId, true);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📎 已收到附件「${name}」(${uploadService.formatBytes(size)}),正在上传处理中...`,
              },
            ]);
            // Poll for attachment status update and notify user
            clearAttachmentPoller(fileId);
            attachmentPollersRef.current[fileId] = setInterval(() => {
              const updated = uploadService.getFile(fileId);
              if (!updated) {
                clearAttachmentPoller(fileId);
                return;
              }
              syncAttachments();
              if (updated.status === 'dispatched') {
                clearAttachmentPoller(fileId);
                setMessages(ms => [
                  ...ms,
                  {
                    role: 'in',
                    name: '助理',
                    text: `📎 附件「${updated.name}」已上传并分派给 ${updated.agent ?? 'AI'} 处理。`,
                  },
                ]);
              } else if (updated.status === 'error') {
                clearAttachmentPoller(fileId);
                setMessages(ms => [
                  ...ms,
                  {
                    role: 'in',
                    name: '助理',
                    text: `⚠️ 附件「${updated.name}」上传失败:${updated.error}`,
                  },
                ]);
              }
            }, 1000);
          });
        });
      },
    );
  }, [clearAttachmentPoller, syncAttachments, trackAttachment]);

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
          enqueueUpload(name, asset.uri, mime, size).then(_f => {
            trackAttachment(_f.id, true);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📷 已拍摄「${name}」,正在上传处理...`,
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
          enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0).then(_f => {
            trackAttachment(_f.id, true);
            syncAttachments();
            setMessages(m => [
              ...m,
              {
                role: 'in',
                name: '助理',
                text: `📄 文档「${doc.name}」已加入上传队列(${uploadService.formatBytes(doc.size ?? 0)})。`,
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
        text: '↻ 正在重试上传,请稍候...',
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
  const latestRunningTask = useMemo(
    () => safeTasks.find(task => task.state === 'running') ?? safeTasks.find(task => task.state === 'todo'),
    [safeTasks],
  );
  const latestPendingConfirmation = useMemo(
    () => safeConfirmations.find(item => item.status !== 'confirmed' && item.status !== 'deferred'),
    [safeConfirmations],
  );
  const latestUploadSignal = useMemo(
    () => safeUploads.find(file => file.status === 'processing' || file.status === 'dispatched' || file.status === 'done'),
    [safeUploads],
  );
  const contextSignals = useMemo(() => {
    const memorySignals = [
      latestPendingConfirmation ? `需确认：${latestPendingConfirmation.title}` : null,
      latestRunningTask ? `当前任务：${latestRunningTask.title}` : null,
    ].filter(Boolean) as string[];

    const knowledgeSignals = [
      latestUploadSignal ? `附件样本：${latestUploadSignal.name} · ${latestUploadSignal.status}` : null,
      latestDispatch ? `调度样本：${latestDispatch.status}${latestDispatch.taskId ? ` · ${latestDispatch.taskId}` : ''}` : null,
    ].filter(Boolean) as string[];

    const dispatchSignals = [
      latestDispatch?.sessionKey ? `session ${latestDispatch.sessionKey}` : null,
      latestDispatch?.dispatchId ? `dispatch ${latestDispatch.dispatchId}` : null,
      latestDispatch?.taskId ? `task ${latestDispatch.taskId}` : null,
    ].filter(Boolean) as string[];

    return {
      memorySignals,
      knowledgeSignals,
      dispatchSignals,
    };
  }, [latestDispatch, latestPendingConfirmation, latestRunningTask, latestUploadSignal]);
  const contextPackPreview = useMemo(() => {
    const sections: string[] = [];

    if (contextSignals.memorySignals.length > 0) {
      sections.push(`[记忆回补]\n${contextSignals.memorySignals.map(item => `- ${item}`).join('\n')}`);
    }
    if (contextSignals.knowledgeSignals.length > 0) {
      sections.push(`[知识/样本回补]\n${contextSignals.knowledgeSignals.map(item => `- ${item}`).join('\n')}`);
    }
    if (queuedAttachmentSummaries.length > 0) {
      sections.push(`[附件上下文]\n${queuedAttachmentSummaries.map(att => `- ${att.name} · ${att.sizeLabel} · ${att.status}`).join('\n')}`);
    }
    if (contextSignals.dispatchSignals.length > 0) {
      sections.push(`[调度链锚点]\n${contextSignals.dispatchSignals.map(item => `- ${item}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }, [contextSignals.dispatchSignals, contextSignals.knowledgeSignals, contextSignals.memorySignals, queuedAttachmentSummaries]);

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
    const trimmedDraft = draft.trim();
    const hasAttachmentContext = queuedAttachmentSummaries.length > 0;

    if ((!trimmedDraft && !hasAttachmentContext) || sending) return;
    const userText = trimmedDraft || '请先分析我刚上传的附件,提取关键信息、给出结论,并把需要我确认的事项单独列出来。';
    const outboundText = contextPackPreview
      ? `${userText}\n\n[本轮上下文包]\n${contextPackPreview}`
      : userText;

    setMessages(m => [...m, {role: 'out', text: userText}]);
    setDraft('');
    setSending(true);
    setTyping(true);

    scheduleTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);

    try {
      const {reply, sent, taskId, dispatchId, sessionKey} = await sendMessage(outboundText);

      const attachedIds = queuedAttachmentSummaries.map(att => att.id);
      const attachedFiles = attachedIds
        .map(id => uploadService.getFile(id))
        .filter((f): f is NonNullable<typeof f> => f != null);

      if (sent && hasAttachmentContext && dispatchId) {
        attachedIds.forEach(id => uploadService.markFileDispatched(id, dispatchId));
      }

      registerDispatch({
        userText: hasAttachmentContext
          ? `${userText}(携带 ${queuedAttachmentSummaries.length} 个附件)`
          : userText,
        reply,
        taskId,
        dispatchId,
        sessionKey,
        sent,
        source: hasAttachmentContext ? 'upload' : 'chat',
        attachmentFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
      });

      // Sync the rest of the app (Dashboard AI feed, Agent status, Task/Kanban)
      // so the send action immediately reflects everywhere without requiring pull-to-refresh.
      refresh();

      if (sent && hasAttachmentContext) {
        if (dispatchId && attachedFiles.length > 0) {
          uploadService.bindFilesToDispatch(attachedFiles.map(file => file.id), dispatchId);
        }
        const evidenceLine = uploadService.buildDispatchEvidenceLine(attachedFiles);
        setMessages(m => [
          ...m,
          {
            role: 'in',
            name: '助理',
            text: evidenceLine
              ? `📎 本轮指令已携带 ${queuedAttachmentSummaries.length} 个附件上下文，一并进入调度链。${evidenceLine}`
              : `📎 本轮指令已携带 ${queuedAttachmentSummaries.length} 个附件上下文，一并进入调度链。`,
          },
        ]);
        uploadService.clearFilesForNextDispatch(queuedAttachmentSummaries.map(att => att.id));
        queuedAttachmentSummaries.forEach(att => clearQueuedAttachment(att.id));
        syncAttachments();
      }

      setMessages(m => [...m, {role: 'in', name: '助理', text: reply}]);
    } catch (err) {
      setMessages(m => [
        ...m,
        {
          role: 'in',
          name: '助理',
          text: `⚠️ 发送失败:${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setSending(false);
      setTyping(false);
      scheduleTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 150);
    }
  }, [
    clearQueuedAttachment,
    contextPackPreview,
    draft,
    queuedAttachmentSummaries,
    registerDispatch,
    refresh,
    scheduleTimeout,
    sending,
    syncAttachments,
  ]);

  useEffect(() => {
    const attachmentPollers = attachmentPollersRef.current;
    return () => {
      timeoutHandlesRef.current.forEach(handle => clearTimeout(handle));
      timeoutHandlesRef.current = [];
      Object.keys(attachmentPollers).forEach(clearAttachmentPoller);
    };
  }, [clearAttachmentPoller]);

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
                  '确定清空所有对话记录?此操作不可撤销。',
                  [
                    {text: '取消', style: 'cancel'},
                    {
                      text: '清空',
                      style: 'destructive',
                      onPress: () => {
                        const welcome: LegacyMessage = {role: 'in', name: '助理', text: '我已上线,随时接收指令。回复将显示在下方,可前往「智能体」查看调度详情。'};
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
              ⚠️ Gateway 不可用 · 消息暂存本地 · {runtimeError ? `原因:${runtimeError}` : '检查网络后自动重连'}
            </Text>
          </View>
        )}

        <View style={styles.contextPackCard}>
          <View style={styles.contextPackHeader}>
            <View>
              <Text style={styles.contextPackEyebrow}>LONG CONTEXT</Text>
              <Text style={styles.contextPackTitle}>本轮上下文包</Text>
            </View>
            <Text style={styles.contextPackBadge}>
              {contextSignals.memorySignals.length + contextSignals.knowledgeSignals.length + queuedAttachmentSummaries.length + contextSignals.dispatchSignals.length} 项信号
            </Text>
          </View>
          <Text style={styles.contextPackSummary}>
            不做产品层硬限制；当前消息会按长上下文 + 分层记忆 + 按需回补送入调度链。
          </Text>
          <View style={styles.contextPackSection}>
            <Text style={styles.contextPackSectionTitle}>记忆回补</Text>
            {contextSignals.memorySignals.length > 0 ? contextSignals.memorySignals.map(item => (
              <Text key={item} style={styles.contextPackLine}>• {item}</Text>
            )) : <Text style={styles.contextPackEmpty}>暂无显式记忆命中，将沿用当前会话历史。</Text>}
          </View>
          <View style={styles.contextPackSection}>
            <Text style={styles.contextPackSectionTitle}>知识 / 样本回补</Text>
            {contextSignals.knowledgeSignals.length > 0 ? contextSignals.knowledgeSignals.map(item => (
              <Text key={item} style={styles.contextPackLine}>• {item}</Text>
            )) : <Text style={styles.contextPackEmpty}>暂无额外知识样本，优先依赖对话与调度链。</Text>}
          </View>
          <View style={styles.contextPackSection}>
            <Text style={styles.contextPackSectionTitle}>附件入口</Text>
            {queuedAttachmentSummaries.length > 0 ? queuedAttachmentSummaries.slice(0, 3).map(att => (
              <Text key={att.id} style={styles.contextPackLine}>• {att.name} · {att.sizeLabel} · {att.status}</Text>
            )) : <Text style={styles.contextPackEmpty}>当前未选择附件；可直接补文件、视频、文档进入本轮分析。</Text>}
          </View>
          <View style={styles.contextPackSection}>
            <Text style={styles.contextPackSectionTitle}>调度链锚点</Text>
            {contextSignals.dispatchSignals.length > 0 ? contextSignals.dispatchSignals.map(item => (
              <Text key={item} style={styles.contextPackLine}>• {item}</Text>
            )) : <Text style={styles.contextPackEmpty}>还没有稳定调度锚点，本轮将以新会话样本生成链路。</Text>}
          </View>
        </View>
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
          {/* Voice Input Indicator */}
          <View style={styles.voiceIndicator}>
            <View style={styles.voiceLeft}>
              <View style={styles.voiceDot} />
              <Text style={styles.voiceLabel}>Voice Ready</Text>
              <Text style={styles.voiceSub}>🎤 语音输入已就绪</Text>
            </View>
            <View style={styles.waveformRow}>
              {[0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.9, 0.65, 0.8, 0.55].map((h, i) => (
                <View key={i} style={[styles.waveformBar, {height: 12 * h, backgroundColor: i === 4 ? C.primary : C.primary + '50'}]} />
              ))}
            </View>
          </View>

          <View style={styles.dispatchStatusCard}>
            <View style={styles.dispatchStatusTop}>
              <Text style={styles.dispatchStatusTitle}>当前调度状态</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
                <Text style={styles.dispatchStatusLink}>查看链路</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.dispatchStatusSummary}>
              {sending
                ? '指令提交中...'
                : latestDispatch
                  ? `调度状态:${DISPATCH_STATUS_LABEL[latestDispatch.status]} · ${latestDispatch.taskId ?? 'taskId 回填中'}`
                  : '暂无调度记录'}
            </Text>
            {queuedAttachmentSummaries.length > 0 ? (
              <View style={styles.queuedAttachmentCard}>
                <View style={styles.queuedAttachmentTopRow}>
                  <View style={styles.queuedAttachmentTextWrap}>
                    <Text style={styles.queuedAttachmentTitle}>下一条消息将携带附件上下文</Text>
                    <Text style={styles.queuedAttachmentSubtitle}>{queuedAttachmentStatusText}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.queuedAttachmentClearBtn}
                    activeOpacity={0.75}
                    onPress={() => {
                      uploadService.clearFilesForNextDispatch(queuedAttachmentSummaries.map(att => att.id));
                      queuedAttachmentSummaries.forEach(att => clearQueuedAttachment(att.id));
                      syncAttachments();
                    }}
                  >
                    <Text style={styles.queuedAttachmentClearText}>清空</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.queuedAttachmentChips}>
                  {queuedAttachmentSummaries.slice(0, 3).map(att => (
                    <TouchableOpacity
                      key={att.id}
                      style={styles.queuedAttachmentChip}
                      activeOpacity={0.75}
                      onPress={() => clearQueuedAttachment(att.id)}
                    >
                      <Text style={styles.queuedAttachmentChipText} numberOfLines={1}>{att.name}</Text>
                      <Text style={styles.queuedAttachmentChipRemove}>×</Text>
                    </TouchableOpacity>
                  ))}
                  {queuedAttachmentSummaries.length > 3 ? (
                    <View style={styles.queuedAttachmentMoreChip}>
                      <Text style={styles.queuedAttachmentMoreText}>+{queuedAttachmentSummaries.length - 3}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
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

          {/* Typing indicator - animated bounce dots */}
          {typing && (
            <View style={styles.msgIn}>
              <Text style={styles.msgName}>助理</Text>
              <View style={styles.typingDotsRow}>
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
            <Text style={styles.uploadHint}>无大小限制 · 自动选择直传或分片续传 · 后台处理</Text>
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
                    已选 {queuedAttachmentSummaries.length} 个附件,将在下一条消息发送时一并携带上下文
                  </Text>
                ) : null}
                {attachments.map(att => {
                  const isLargeFile = att.sizeLabel !== '未知大小' &&
                    (att.sizeLabel.includes('MB') || att.sizeLabel.includes('GB'));
                  const statusColor =
                    att.status === 'done' || att.status === 'dispatched' ? '#34d399'
                    : att.status === 'error' ? '#f87171'
                    : att.status === 'uploading' ? C.primary
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
                              <Text style={styles.largeFileBadgeText}>分片续传</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.attachmentMeta, {color: statusColor}]}> 
                          {att.sizeLabel} · {statusLabel}
                        </Text>
                        {queuedAttachmentIds.includes(att.id) ? (
                          <Text style={styles.selectedAttachmentHint}>
                            本文件已加入下一条消息的分析上下文
                          </Text>
                        ) : null}
                        {att.status === 'uploading' && isLargeFile && (
                          <Text style={styles.chunkHint}>
                            系统已自动走分片续传，上传中断后可继续
                          </Text>
                        )}
                        {att.status === 'processing' && isLargeFile && (
                          <Text style={styles.chunkHint}>
                            后台 AI 分析中,结果自动回流
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
              placeholder="输入 AI 调度指令..."
              placeholderTextColor={C.textMuted}
              style={[styles.input, styles.inputAltBorder, {minHeight: Math.max(44, Math.min(inputHeight, 120))}]}
              multiline
              editable={!sending}
              onContentSizeChange={e => { setInputHeight(e.nativeEvent.contentSize.height); }}
              onFocus={e => { (e.nativeEvent as any); }}
              onBlur={e => { (e.nativeEvent as any); }}
            />
            <Text style={styles.inputHint}>
              {sending
                ? '正在提交到 OpenClaw 调度链...'
                : queuedAttachmentSummaries.length > 0 && !draft.trim()
                  ? `已选 ${queuedAttachmentSummaries.length} 个附件,可直接发送给 AI 自动分析`
                  : '消息直接发送至 OpenClaw Gateway'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!draft.trim() && queuedAttachmentSummaries.length === 0 || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={(!draft.trim() && queuedAttachmentSummaries.length === 0) || sending}
          >
            <Text style={styles.sendText}>
              {sending ? '发送中' : queuedAttachmentSummaries.length > 0 && !draft.trim() ? '分析附件' : '发送'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  flex:         {flex: 1},
  header:       {paddingHorizontal: LAYOUT.pageMargin, paddingTop: 16, paddingBottom: 12},
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
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
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
  contextPackCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(8,18,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.14)',
    gap: 10,
  },
  contextPackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextPackEyebrow: {color: C.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6},
  contextPackTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900', marginTop: 2},
  contextPackBadge: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.12)',
    overflow: 'hidden',
  },
  contextPackSummary: {color: C.textMuted, fontSize: 11, lineHeight: 16},
  contextPackSection: {gap: 4},
  contextPackSectionTitle: {color: C.textSecondary, fontSize: 11, fontWeight: '800'},
  contextPackLine: {color: C.textBody, fontSize: 11, lineHeight: 16},
  contextPackEmpty: {color: C.textMuted, fontSize: 11, lineHeight: 16},

  chatContent:  {padding: 16, paddingBottom: 16},

  msgIn: {
    alignSelf: 'flex-start', maxWidth: '82%',
    padding: 14, borderRadius: 20, borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(14,24,42,0.85)',
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  msgOut: {
    alignSelf: 'flex-end', maxWidth: '82%',
    padding: 14, borderRadius: 20, borderBottomRightRadius: 6,
    backgroundColor: 'rgba(2,132,199,0.35)',
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)',
    shadowColor: C.primary, shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 4,
  },
  msgName: {color: C.primary, fontSize: 11, fontWeight: '800', marginBottom: 4},
  typingDot: {color: C.primary, fontSize: 18, marginRight: 4, lineHeight: 22},
  typingDotsRow: {flexDirection: 'row', alignItems: 'center', paddingTop: 4, gap: 5},
  msgText: {color: C.textBody, fontSize: 14, lineHeight: 20},

  dispatchStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(14,24,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  dispatchStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dispatchStatusTitle: {color: C.textSecondary, fontSize: 11, fontWeight: '800'},
  dispatchStatusLink: {color: C.primary, fontSize: 11, fontWeight: '800'},
  dispatchStatusSummary: {color: C.textSecondary, fontSize: 12, lineHeight: 16, flex: 1},
  dispatchStatusMeta: {color: C.textMuted, fontSize: 10, lineHeight: 14},
  dispatchAttachmentHint: {color: C.primary, fontSize: 10, lineHeight: 14, fontWeight: '700'},
  queuedAttachmentCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.22)',
    gap: 8,
  },
  queuedAttachmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  queuedAttachmentTextWrap: {flex: 1},
  queuedAttachmentTitle: {color: '#34d399', fontSize: 12, fontWeight: '900'},
  queuedAttachmentSubtitle: {color: C.textBody, fontSize: 10, lineHeight: 14, marginTop: 3},
  queuedAttachmentClearBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  queuedAttachmentClearText: {color: C.textMuted, fontSize: 10, fontWeight: '800'},
  queuedAttachmentChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  queuedAttachmentChip: {
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  queuedAttachmentChipText: {color: C.textTitle, fontSize: 10, fontWeight: '700', maxWidth: 160},
  queuedAttachmentChipRemove: {color: C.textMuted, fontSize: 12, fontWeight: '900', marginTop: -1},
  queuedAttachmentMoreChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  queuedAttachmentMoreText: {color: C.textMuted, fontSize: 10, fontWeight: '800'},

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

  // Voice input indicator
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(77,255,136,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(77,255,136,0.18)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  voiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  voiceLabel: {
    color: C.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  voiceSub: {
    color: C.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 16,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },

  inputRow: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    backgroundColor: C.bgRoot,
  },
  inputWrap: {flex: 1},
  input: {
    minHeight: 44, maxHeight: 144,
    borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1, borderColor: C.borderSubtle,
    fontSize: 14,
  },
  inputAltBorder: {borderColor: 'rgba(255,255,255,0.08)'},
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
  selectedAttachmentHint: {color: '#34d399', fontSize: 10, marginTop: 4, fontWeight: '700'},
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
