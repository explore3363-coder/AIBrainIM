import React, {useState, useCallback, useMemo} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {launchImageLibrary} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import {C} from '../data/constants';
import {enqueueUpload, uploadService, type UploadFile} from '../services/uploadService';
import {useAppContext} from '../context/AppContext';
import type {RootStackParamList} from '../App';

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB — matches uploadService threshold



// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<string, {emoji: string; color: string}> = {
  image:    {emoji:'🖼️', color:'#34d399'},
  video:    {emoji:'🎬', color:'#f97316'},
  document: {emoji:'📄', color:C.primary},
  archive:  {emoji:'📦', color:'#a78bfa'},
};
const STATUS_META: Record<string, {label: string; color: string}> = {
  dispatched: {label:'已分派', color:'#34d399'},
  pending:    {label:'待处理', color: C.normalUrgency},
  reviewed:  {label:'已查看', color: C.primary},
  queued:    {label:'排队中', color: '#94a3b8'},
  uploading: {label:'上传中', color: C.primary},
  processing:{label:'处理中', color: '#818cf8'},
  done:      {label:'已完成', color: '#34d399'},
  error:     {label:'失败',   color: '#f87171'},
};

const FILTER_TYPES = ['全部', '图片', '视频', '文档', '压缩包'] as const;
type FilterType = typeof FILTER_TYPES[number];

type AnyFile = UploadFile;

function getFileTimestamp(f: UploadFile): string {
  return f.timestamp ?? '';
}

function sortByTimestamp(files: UploadFile[]): UploadFile[] {
  return [...files].sort((a, b) => getFileTimestamp(b).localeCompare(getFileTimestamp(a)));
}

function getFileType(f: AnyFile): string {
  return f.type;
}

function buildTransferSummary(file: UploadFile): string | null {
  if (file.status === 'error') {
    return file.error ? `失败原因：${file.error}` : '上传失败，请重试';
  }

  if (file.transferMode === 'chunked') {
    const uploadedChunks = file.uploadedChunks ?? 0;
    const totalChunks = file.totalChunks ?? 0;

    if (file.status === 'queued') {
      return totalChunks > 0
        ? `分片准备中 · ${uploadedChunks}/${totalChunks} 片`
        : '分片准备中';
    }

    if (file.status === 'uploading') {
      return totalChunks > 0
        ? `分片上传中 · ${uploadedChunks}/${totalChunks} 片 · ${file.progress}%`
        : `分片上传中 · ${file.progress}%`;
    }

    if (file.status === 'processing') {
      return '上传已完成，后台正在解析与分派';
    }
  }

  if (file.status === 'processing') {
    return '上传已完成，后台正在解析与分派';
  }

  if (file.status === 'dispatched') {
    return file.agent ? `已分派给 ${file.agent}` : '已进入调度链';
  }

  if (file.status === 'done') {
    return file.agent ? `${file.agent} 已完成处理` : '处理已完成';
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FileLibraryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeType, setActiveType] = useState<FilterType>('全部');
  const [_queuedVersion, setQueuedVersion] = useState(0);
  const {uploads} = useAppContext();

  const refreshQueuedContext = useCallback(() => {
    setQueuedVersion(version => version + 1);
  }, []);

  const allFiles = useMemo(() => sortByTimestamp(uploads), [uploads]);

  const filtered = activeType === '全部'
    ? allFiles
    : allFiles.filter(f => {
        const t = getFileType(f);
        const map: Record<string, string> = {
          '图片':'image', '视频':'video', '文档':'document', '压缩包':'archive',
        };
        return t === map[activeType];
      });

  const handleUpload = useCallback(() => {
    Alert.alert(
      '📎 上传附件',
      '选择文件类型',
      [
        {text: '图片/视频', onPress: () => {
          launchImageLibrary({mediaType: 'mixed', selectionLimit: 0}, res => {
            if (res.didCancel || res.errorCode) return;
            (res.assets ?? []).forEach(asset => {
              if (!asset.uri) return;
              const name = asset.fileName ?? `file_${Date.now()}`;
              enqueueUpload(name, asset.uri, asset.type ?? 'application/octet-stream', asset.fileSize ?? 0);
            });
            if (res.assets && res.assets.length > 0) {
              Alert.alert('已开始上传', `${res.assets.length} 个文件已加入上传队列`);
            }
          });
        }},
        {text: '文档/其他', onPress: () => {
          DocumentPicker.pick({allowMultiSelection: true})
            .then(results => {
              results.forEach(doc => {
                if (!doc.uri) return;
                enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0);
              });
              if (results.length > 0) {
                Alert.alert('已开始上传', `${results.length} 个文件已加入上传队列`);
              }
            })
            .catch(err => {
              if (DocumentPicker.isCancel(err)) return;
              Alert.alert('选择失败', String(err));
            });
        }},
        {text: '取消', style: 'cancel'},
      ],
    );
  }, []);

  const totalCount = allFiles.length;
  const uploadingCount = uploads.filter(f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing').length;
  const failedFiles = useMemo(
    () => allFiles.filter(file => file.status === 'error'),
    [allFiles],
  );
  const queuedIds = uploadService.getFilesForNextDispatch().map(file => file.id);
  const queuedIdSet = useMemo(() => new Set(queuedIds), [queuedIds]);
  const queuedFiles = useMemo(
    () => allFiles.filter(file => queuedIdSet.has(file.id)),
    [allFiles, queuedIdSet],
  );

  const openDispatchChain = useCallback((file: UploadFile) => {
    navigation.navigate('DispatchChain', {
      focusDispatchId: file.dispatchId,
      focusTaskId: `upload-${file.id}`,
      focusSessionKey: file.dispatchId,
    });
  }, [navigation]);

  const continueInChat = useCallback((file: UploadFile) => {
    uploadService.markFileForNextDispatch(file.id);
    refreshQueuedContext();
    navigation.navigate('Tabs', {screen: 'Chat'});
  }, [navigation, refreshQueuedContext]);

  const removeFromQueuedContext = useCallback((file: UploadFile) => {
    uploadService.unmarkFileForNextDispatch(file.id);
    refreshQueuedContext();
  }, [refreshQueuedContext]);

  const clearQueuedContext = useCallback(() => {
    queuedFiles.forEach(file => uploadService.unmarkFileForNextDispatch(file.id));
    refreshQueuedContext();
  }, [queuedFiles, refreshQueuedContext]);

  const retryFile = useCallback((file: UploadFile) => {
    uploadService.retryUpload(file.id);
  }, []);

  const retryAllFailedFiles = useCallback(() => {
    failedFiles.forEach(file => uploadService.retryUpload(file.id));
  }, [failedFiles]);

  const removeFile = useCallback((file: UploadFile) => {
    Alert.alert('移除附件', `确定从附件库移除「${file.name}」？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '移除',
        style: 'destructive',
        onPress: () => uploadService.removeFile(file.id),
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>📎 附件库</Text>
            <Text style={styles.sub}>
              {totalCount} 个文件
              {uploadingCount > 0 ? ` · ${uploadingCount} 个上传中` : ''}
              · 无大小限制
            </Text>
          </View>
          <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.8} onPress={handleUpload}>
            <Text style={styles.uploadBtnText}>+ 上传</Text>
          </TouchableOpacity>
        </View>

        {/* Active upload indicators */}
        {uploadingCount > 0 && (
          <View style={styles.uploadingBanner}>
            <View style={styles.uploadingDot} />
            <Text style={styles.uploadingText}>{uploadingCount} 个文件正在上传/处理中</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTER_TYPES.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeType === f && styles.filterChipActive]}
            onPress={() => setActiveType(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterText, activeType === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {failedFiles.length > 0 && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerHeader}>
              <View style={styles.errorBannerTextWrap}>
                <Text style={styles.errorBannerTitle}>有 {failedFiles.length} 个附件处理失败</Text>
                <Text style={styles.errorBannerSub}>可以直接重试，不用逐个翻卡片处理。</Text>
              </View>
              <TouchableOpacity
                style={styles.errorBannerBtn}
                activeOpacity={0.8}
                onPress={retryAllFailedFiles}
              >
                <Text style={styles.errorBannerBtnText}>全部重试</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {queuedFiles.length > 0 && (
          <View style={styles.contextBanner}>
            <View style={styles.contextBannerHeader}>
              <View style={styles.contextBannerTextWrap}>
                <Text style={styles.contextBannerTitle}>已加入下一轮对话上下文</Text>
                <Text style={styles.contextBannerSub}>{queuedFiles.length} 个附件会随下一条消息一起进入调度链</Text>
              </View>
              <View style={styles.contextBannerActions}>
                <TouchableOpacity
                  style={styles.contextBannerGhostBtn}
                  activeOpacity={0.8}
                  onPress={clearQueuedContext}
                >
                  <Text style={styles.contextBannerGhostBtnText}>全部移出</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextBannerBtn}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Tabs', {screen: 'Chat'})}
                >
                  <Text style={styles.contextBannerBtnText}>去对话</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.contextBannerChips}>
              {queuedFiles.slice(0, 3).map(file => (
                <View key={file.id} style={styles.contextChip}>
                  <Text style={styles.contextChipText} numberOfLines={1}>{file.name}</Text>
                </View>
              ))}
              {queuedFiles.length > 3 ? (
                <View style={styles.contextChipMuted}>
                  <Text style={styles.contextChipMutedText}>+{queuedFiles.length - 3}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
        {/* Empty state — user-facing, no developer noise */}
        {allFiles.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📎</Text>
            <Text style={styles.emptyTitle}>附件库是空的</Text>
            <Text style={styles.emptyDesc}>
              上传图片、视频或文档，AI 会自动分派处理，附件状态会实时回流到 AI 产出流。
            </Text>
            <Text style={styles.emptySub}>
              无大小限制；系统会自动选择直传或分片续传。
            </Text>
            <TouchableOpacity
              style={styles.emptyPrimaryBtn}
              activeOpacity={0.8}
              onPress={handleUpload}
            >
              <Text style={styles.emptyPrimaryBtnText}>上传第一个文件</Text>
            </TouchableOpacity>
            <Text style={styles.emptyNote}>
              也可以在「对话」中直接拍照或添加附件，随消息一并进入调度链。
            </Text>
          </View>
        )}

        {/* Empty filter result — specific to current filter */}
        {allFiles.length > 0 && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>没有 {activeType} 文件</Text>
            <Text style={styles.emptyDesc}>
              当前上传的文件中，没有 {activeType === '全部' ? '' : activeType} 类型的附件。
            </Text>
            <TouchableOpacity
              style={styles.emptySecondaryBtn}
              activeOpacity={0.8}
              onPress={() => setActiveType('全部')}
            >
              <Text style={styles.emptySecondaryBtnText}>查看全部</Text>
            </TouchableOpacity>
          </View>
        )}

        {filtered.map(file => {
          const type = getFileType(file);
          const typeMeta = TYPE_META[type] ?? TYPE_META.document;
          // Derive display fields from UploadFile
          const fileName = file.name;
          const fileAgent = file.agent ?? '—';
          const fileStatus = file.status as string;
          const statusMeta = STATUS_META[fileStatus] ?? STATUS_META.pending;
          const fileSize = uploadService.formatBytes(file.size);
          const fileTime = file.timestamp ?? '';
          const isLargeFile = file.transferMode === 'chunked' || file.size > LARGE_FILE_THRESHOLD;
          const isChunked = file.transferMode === 'chunked' || file.size === 0 || file.size > LARGE_FILE_THRESHOLD;
          const queuedForChat = queuedIdSet.has(file.id);
          const transferSummary = buildTransferSummary(file);

          // Build pipeline step label for chunked/background pipeline files
          const pipelineStep =
            file.status === 'queued' && isChunked ? '分片中'
            : file.status === 'uploading' && isChunked ? `上传 ${file.progress}%`
            : file.status === 'processing' ? 'AI 分析中'
            : file.status === 'dispatched' ? '已分派'
            : null;

          return (
            <View key={file.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.fileEmoji}>{typeMeta.emoji}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.fileNameRow}>
                  <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
                  {isLargeFile && (
                    <View style={styles.largeFileBadge}>
                      <Text style={styles.largeFileBadgeText}>分片续传</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.fileMeta}>{fileSize} · {fileAgent} · {fileTime}</Text>
                {transferSummary ? (
                  <Text style={[
                    styles.transferSummary,
                    file.status === 'error' && styles.transferSummaryError,
                  ]}>
                    {transferSummary}
                  </Text>
                ) : null}
                {/* Large file pipeline step */}
                {pipelineStep ? (
                  <View style={[styles.pipelineBadge, {borderColor: statusMeta.color + '44', backgroundColor: `${statusMeta.color}11`}]}>
                    <Text style={[styles.pipelineText, {color: statusMeta.color}]}>{pipelineStep}</Text>
                    {file.status === 'uploading' && isChunked && (
                      <Text style={[styles.pipelineSub, {color: statusMeta.color}]}>
                        {' '}{file.progress < 50 ? '分片上传中…' : '合并中…'}
                      </Text>
                    )}
                  </View>
                ) : null}
                <View style={styles.fileMetaRow}>
                  <View style={[styles.statusBadge, {borderColor: statusMeta.color + '44'}]}>
                    <Text style={[styles.statusText, {color: statusMeta.color}]}>{statusMeta.label}</Text>
                  </View>
                  {queuedForChat ? (
                    <View style={styles.queuedContextBadge}>
                      <Text style={styles.queuedContextBadgeText}>已带入下一轮对话</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.fileActions}>
                  {file.dispatchId ? (
                    <TouchableOpacity
                      style={styles.fileActionBtn}
                      activeOpacity={0.78}
                      onPress={() => openDispatchChain(file)}
                    >
                      <Text style={styles.fileActionText}>调度链</Text>
                    </TouchableOpacity>
                  ) : null}
                  {(file.status === 'done' || file.status === 'dispatched' || file.status === 'processing') ? (
                    queuedForChat ? (
                      <TouchableOpacity
                        style={[styles.fileActionBtn, styles.fileActionQueuedBtn]}
                        activeOpacity={0.78}
                        onPress={() => removeFromQueuedContext(file)}
                      >
                        <Text style={[styles.fileActionText, styles.fileActionQueuedText]}>取消带入</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.fileActionBtn}
                        activeOpacity={0.78}
                        onPress={() => continueInChat(file)}
                      >
                        <Text style={styles.fileActionText}>带入对话</Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                  {file.status === 'error' ? (
                    <TouchableOpacity
                      style={[styles.fileActionBtn, styles.retryActionBtn]}
                      activeOpacity={0.78}
                      onPress={() => retryFile(file)}
                    >
                      <Text style={[styles.fileActionText, styles.retryActionText]}>重试</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.fileActionGhostBtn}
                    activeOpacity={0.78}
                    onPress={() => removeFile(file)}
                  >
                    <Text style={styles.fileActionGhostText}>移除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  headerRow:  {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  title:      {color: C.textTitle, fontSize: 28, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 13, marginTop: 4},
  uploadBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.primary,
  },
  uploadBtnText:{color: C.bgRoot, fontWeight: '900', fontSize: 15},
  uploadingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  uploadingDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary,
  },
  uploadingText: {color: C.primary, fontSize: 13, fontWeight: '700'},
  filterRow:  {paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexDirection: 'row'},
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56,100,200,0.25)',
    borderColor: C.borderActive,
  },
  filterText:      {color: C.textMuted, fontSize: 14, fontWeight: '700'},
  filterTextActive:{color: C.primary},
  content:    {padding: 16, paddingBottom: 100, gap: 10},
  errorBanner: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    gap: 10,
  },
  errorBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerTextWrap: {flex: 1},
  errorBannerTitle: {color: '#fda4af', fontSize: 14, fontWeight: '900'},
  errorBannerSub: {color: C.textBody, fontSize: 12, marginTop: 3},
  errorBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
  },
  errorBannerBtnText: {color: '#fda4af', fontSize: 13, fontWeight: '900'},
  contextBanner: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
    gap: 10,
  },
  contextBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  contextBannerTextWrap: {flex: 1},
  contextBannerTitle: {color: '#34d399', fontSize: 14, fontWeight: '900'},
  contextBannerSub: {color: C.textBody, fontSize: 12, marginTop: 3},
  contextBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
  },
  contextBannerBtnText: {color: '#34d399', fontSize: 12, fontWeight: '900'},
  contextBannerGhostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  contextBannerGhostBtnText: {color: C.textMuted, fontSize: 12, fontWeight: '800'},
  contextBannerChips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  contextChip: {
    maxWidth: '80%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  contextChipText: {color: C.textTitle, fontSize: 11, fontWeight: '700'},
  contextChipMuted: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  contextChipMutedText: {color: C.textMuted, fontSize: 11, fontWeight: '800'},
  card: {
    flexDirection: 'row', gap: 12,
    padding: 14, borderRadius: 18,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  cardLeft: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileEmoji:  {fontSize: 22},
  cardBody:   {flex: 1, justifyContent: 'center'},
  fileName:   {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  fileMeta:   {color: C.textMuted, fontSize: 11, marginTop: 4},
  transferSummary: {color: C.textBody, fontSize: 11, marginTop: 4, lineHeight: 16},
  transferSummaryError: {color: '#fca5a5'},
  fileNameRow: {flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'},
  largeFileBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  largeFileBadgeText: {color: '#fbbf24', fontSize: 9, fontWeight: '900'},
  pipelineBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pipelineText: {fontSize: 10, fontWeight: '800'},
  pipelineSub: {fontSize: 10, fontWeight: '700'},
  fileMetaRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 5},
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusText: {fontSize: 10, fontWeight: '800'},
  queuedContextBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.26)',
  },
  queuedContextBadgeText: {color: '#34d399', fontSize: 10, fontWeight: '800'},
  fileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  fileActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  fileActionText: {color: C.primary, fontSize: 11, fontWeight: '900'},
  fileActionQueuedBtn: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderColor: 'rgba(52,211,153,0.3)',
  },
  fileActionQueuedText: {color: '#34d399'},
  retryActionBtn: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  retryActionText: {color: '#f87171'},
  fileActionGhostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  fileActionGhostText: {color: C.textMuted, fontSize: 11, fontWeight: '800'},
  footer:     {height: 24},

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIcon:   {fontSize: 48},
  emptyTitle:  {color: C.textTitle, fontSize: 18, fontWeight: '900', textAlign: 'center'},
  emptyDesc:   {color: C.textBody, fontSize: 13, lineHeight: 20, textAlign: 'center'},
  emptySub:    {color: C.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', fontStyle: 'italic'},
  emptyPrimaryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: C.primary,
  },
  emptyPrimaryBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  emptySecondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.12)',
    borderWidth: 1,
    borderColor: C.borderActive,
  },
  emptySecondaryBtnText: {color: C.primary, fontWeight: '800', fontSize: 13},
  emptyNote: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
