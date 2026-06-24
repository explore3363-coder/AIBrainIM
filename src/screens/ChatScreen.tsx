import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {Animated, type NativeSyntheticEvent, type NativeScrollEvent} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
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

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
}

function renderLegacyBubble(msg: LegacyMessage, key: number | string) {
  if (msg.role === 'in') {
    return (
      <View key={String(key)} style={styles.bubbleIncoming}>
        <Text style={styles.bubbleName}>{msg.name}</Text>
        <Text style={styles.bubbleText}>{msg.text}</Text>
      </View>
    );
  }
  return (
    <View key={String(key)} style={styles.bubbleOutgoing}>
      <Text style={[styles.bubbleText, styles.bubbleTextOut]}>{msg.text}</Text>
    </View>
  );
}

function renderNewMessageBubble(item: NewMessage, key: number | string) {
  const isUser = item.role === 'user';
  return (
    <View key={String(key)} style={isUser ? styles.bubbleOutgoing : styles.bubbleIncoming}>
      {!isUser && item.agentName && (
        <Text style={styles.bubbleName}>{item.agentName}</Text>
      )}
      <Text style={isUser ? [styles.bubbleText, styles.bubbleTextOut] : styles.bubbleText}>
        {item.content}
      </Text>
      <Text style={styles.bubbleTime}>{formatTime(item.timestamp)}</Text>
    </View>
  );
}

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
    return (
      <View style={styles.subtaskCompleteBubble}>
        <Text style={styles.subtaskCompleteEmoji}>✅</Text>
        <Text style={styles.subtaskCompleteTitle}>{item.content}</Text>
        {total > 0 && (
          <Text style={styles.subtaskCompleteCounter}>{done.length}/{total} 子任务完成</Text>
        )}
        <Text style={styles.subtaskCompleteTime}>{formatTime(item.timestamp)}</Text>
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

  const [historyRestored, setHistoryRestored] = useState(false);

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
    if (!handle) return;
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
              if (prev.length <= 1) return saved;
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

  useEffect(() => {
    if (messages.length <= 1) return;
    AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    const latest = safeDispatches[0];
    if (!latest || latest.id === lastDispatchIdRef.current) return;
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

    const text = `🛰 调度状态更新:${statusText} · ${detail}`;
    setMessages(messagesNow => {
      const alreadyExists = messagesNow.some(msg => msg.role === 'in' && msg.text === text);
      if (alreadyExists) return messagesNow;
      return [...messagesNow, {role: 'in', name: '助理', text}];
    });
    scheduleTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 150);
  }, [safeDispatches, scheduleTimeout]);

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
    () => queuedAttachmentSummaries.filter(att =>
      att.status === 'done' || att.status === 'dispatched' || att.status === 'processing'
    ).length,
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
      if (!autoSelect) return ids;
      return Array.from(new Set([...ids, fileId]));
    });
  }, []);

  useEffect(() => {
    syncAttachments();
  }, [syncAttachments]);

  useEffect(() => {
    const attachmentPollers = attachmentPollersRef.current;
    return () => {
      timeoutHandlesRef.current.forEach(handle => clearTimeout(handle));
      timeoutHandlesRef.current = [];
      Object.keys(attachmentPollers).forEach(clearAttachmentPoller);
    };
  }, [clearAttachmentPoller]);

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
    '视频':      handlePickImage,
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

    return { memorySignals, knowledgeSignals, dispatchSignals };
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
  }, [contextSignals, queuedAttachmentSummaries]);

  useEffect(() => {
    if (!queuedAttachmentIds.length) return;
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

  const canSend = (draft.trim().length > 0 || queuedAttachmentSummaries.length > 0) && !sending;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>AI 对话</Text>
            <View style={styles.headerStatusRow}>
              <View style={[
                styles.statusDot,
                runtimeMode === 'fallback' ? styles.statusDotOffline : styles.statusDotOnline,
              ]} />
              <Text style={styles.statusLabel}>
                {runtimeMode === 'fallback' ? '离线模式' : '在线'}
              </Text>
            </View>
          </View>
          {messages.length > 2 && (
            <TouchableOpacity
              style={styles.clearBtn}
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
                        const welcome: LegacyMessage = {
                          role: 'in', name: '助理',
                          text: '我已上线,随时接收指令。回复将显示在下方,可前往「智能体」查看调度详情。',
                        };
                        setMessages([welcome]);
                        setAllMessages([{
                          id: makeMessageId(),
                          type: 'text',
                          role: 'agent',
                          agentName: '助理',
                          content: '我已上线，随时接收指令。回复将显示在下方，可前往「智能体」查看调度详情。',
                          timestamp: Date.now(),
                        }]);
                        AsyncStorage.removeItem(CHAT_HISTORY_KEY).catch(() => {});
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.clearBtnText}>清空</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Runtime error banner */}
        {runtimeMode === 'fallback' && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              ⚠️ Gateway 不可用 · 消息暂存本地 · {runtimeError ? `原因:${runtimeError}` : '检查网络后自动重连'}
            </Text>
          </View>
        )}

        {/* Message area — single KeyboardAvoidingView */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
            {/* History restored toast */}
            {historyRestored && (
              <View style={styles.historyBanner}>
                <Text style={styles.historyBannerText}>📜 本地会话历史已恢复</Text>
              </View>
            )}

            {/* allMessages — collaboration cards + AI text bubbles */}
            {allMessages.map((item, i) => {
              const collaboration = detectCollaboration(allMessages, i);
              const isTextBubble = item.type === 'text' || !item.type;
              if (isTextBubble) {
                return renderNewMessageBubble(item, item.id);
              }
              return (
                <View key={item.id} style={styles.collabCardWrap}>
                  {renderMessageContent(item, collaboration)}
                </View>
              );
            })}

            {/* legacy messages — basic text chat */}
            {messages.map((msg, i) => renderLegacyBubble(msg, `legacy-${i}`))}

            {/* Typing indicator */}
            {typing && (
              <View style={styles.bubbleIncoming}>
                <Text style={styles.bubbleName}>助理</Text>
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
          </ScrollView>

          {/* Scroll-to-bottom FAB */}
          {showScrollBtn && (
            <TouchableOpacity
              style={styles.scrollFab}
              activeOpacity={0.8}
              onPress={() => scrollRef.current?.scrollToEnd({animated: true})}
            >
              <Text style={styles.scrollFabIcon}>↓</Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>

        {/* Input area wrapper */}
        <View style={styles.inputAreaWrapper}>
          {/* Queued attachment chips — above input bar */}
          {queuedAttachmentSummaries.length > 0 && (
            <View style={styles.attachmentChipsRow}>
              <Text style={styles.attachmentChipsLabel}>附件:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentChipsScroll}>
                {queuedAttachmentSummaries.map(att => (
                  <TouchableOpacity
                    key={att.id}
                    style={styles.attachmentChip}
                    activeOpacity={0.75}
                    onPress={() => clearQueuedAttachment(att.id)}
                  >
                    <Text style={styles.attachmentChipText} numberOfLines={1}>{att.name}</Text>
                    <Text style={styles.attachmentChipRemove}>×</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.attachmentClearAllBtn}
                activeOpacity={0.75}
                onPress={() => {
                  uploadService.clearFilesForNextDispatch(queuedAttachmentSummaries.map(att => att.id));
                  queuedAttachmentSummaries.forEach(att => clearQueuedAttachment(att.id));
                  syncAttachments();
                }}
              >
                <Text style={styles.attachmentClearAllText}>清空</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input row */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="输入 AI 调度指令..."
                placeholderTextColor={C.textMuted}
                style={[
                  styles.input,
                  {minHeight: Math.max(44, Math.min(inputHeight, 120))},
                ]}
                multiline
                editable={!sending}
                blurOnSubmit={false}
                onSubmitEditing={() => { Keyboard.dismiss(); }}
                onContentSizeChange={e => { setInputHeight(e.nativeEvent.contentSize.height); }}
                returnKeyType="default"
              />
              <Text style={styles.inputHint}>
                {sending
                  ? '正在提交到 OpenClaw 调度链...'
                  : queuedAttachmentSummaries.length > 0 && !draft.trim()
                    ? `已选 ${queuedAttachmentSummaries.length} 个附件,可直接发送给 AI 自动分析`
                    : '消息直接发送至 OpenClaw Gateway'}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.75}
                onPress={handleTakePhoto}
              >
                <Text style={styles.actionBtnText}>📷</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.75}
                onPress={handlePickImage}
              >
                <Text style={styles.actionBtnText}>🖼️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.75}
                onPress={handlePickDocument}
              >
                <Text style={styles.actionBtnText}>📄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                activeOpacity={0.8}
                onPress={handleSend}
                disabled={!canSend}
              >
                <Text style={styles.sendText}>
                  {sending ? '...' : queuedAttachmentSummaries.length > 0 && !draft.trim() ? '分析' : '发送'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root:          {flex: 1, backgroundColor: C.bgRoot},
  flex:          {flex: 1},

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgRoot,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: C.textTitle,
    fontSize: 22,
    fontWeight: '900',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#4DFF88',
  },
  statusDotOffline: {
    backgroundColor: '#f87171',
  },
  statusLabel: {
    color: C.textMuted,
    fontSize: 11,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  clearBtnText: {color: '#f87171', fontSize: 11, fontWeight: '800'},

  // ── Error banner ────────────────────────────────────────────────────────
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(248,113,113,0.2)',
  },
  errorBannerText: {color: '#f87171', fontSize: 11, fontWeight: '700'},

  // ── Chat content ───────────────────────────────────────────────────────
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  collabCardWrap: {
    marginBottom: 12,
  },

  // ── History banner ─────────────────────────────────────────────────────
  historyBanner: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  historyBannerText: {color: '#34d399', fontSize: 11, fontWeight: '800'},

  // ── Chat bubbles ────────────────────────────────────────────────────────
  bubbleIncoming: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    padding: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(14,24,42,0.85)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  bubbleOutgoing: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    padding: 14,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: 'rgba(2,132,199,0.35)',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleName: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  bubbleText: {
    color: C.textBody,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextOut: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    color: C.textMuted,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // ── Typing indicator ────────────────────────────────────────────────────
  typingDot: {color: C.primary, fontSize: 18, marginRight: 4, lineHeight: 22},
  typingDotsRow: {flexDirection: 'row', alignItems: 'center', paddingTop: 4, gap: 5},

  // ── Subtask complete bubble ─────────────────────────────────────────────
  subtaskCompleteBubble: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    alignItems: 'center',
  },
  subtaskCompleteEmoji: {fontSize: 28, marginBottom: 6},
  subtaskCompleteTitle: {color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center'},
  subtaskCompleteCounter: {color: '#4DFF88', fontSize: 12, fontWeight: '700', marginTop: 4},
  subtaskCompleteTime: {color: '#64748B', fontSize: 10, marginTop: 4},

  // ── Scroll FAB ─────────────────────────────────────────────────────────
  scrollFab: {
    position: 'absolute',
    right: 18,
    bottom: 16,
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

  // ── Attachment chips (above input bar) ─────────────────────────────────
  attachmentChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: C.bgRoot,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },
  attachmentChipsLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
  },
  attachmentChipsScroll: {
    flex: 1,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    marginRight: 6,
  },
  attachmentChipText: {
    color: C.textTitle,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 140,
  },
  attachmentChipRemove: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '900',
    marginTop: -1,
  },
  attachmentClearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    flexShrink: 0,
  },
  attachmentClearAllText: {color: '#f87171', fontSize: 10, fontWeight: '800'},

  // ── Input area wrapper ─────────────────────────────────────────────────
  inputAreaWrapper: {
    backgroundColor: C.bgRoot,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },

  // ── Input row ──────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: C.bgRoot,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.textTitle,
    backgroundColor: 'rgba(5,13,26,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 16,
  },
  inputHint: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 5,
    paddingHorizontal: 4,
  },

  // ── Action buttons ─────────────────────────────────────────────────────
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 0,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 18,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: C.bgRoot,
    fontWeight: '800',
    fontSize: 14,
  },
});
