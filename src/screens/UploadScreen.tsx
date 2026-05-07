import React, {useEffect, useMemo, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {C} from '../data/mockData';
import {useAppContext} from '../context/AppContext';
import {uploadService, enqueueUpload, type UploadFile, type UploadQueueStage} from '../services/uploadService';
import {launchImageLibrary, type ImagePickerResponse} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import type {RootStackParamList} from '../App';

const runtimeProcess = (globalThis as {process?: {env?: Record<string, string | undefined>}}).process;
const IS_TEST_ENV = runtimeProcess?.env?.JEST_WORKER_ID != null || runtimeProcess?.env?.NODE_ENV === 'test';

const STATUS_META: Record<string, {label: string; color: string; bg: string}> = {
  queued:     {label:'排队中', color:'#94a3b8', bg:'rgba(148,163,184,0.1)'},
  uploading:  {label:'上传中', color: C.primary,  bg:'rgba(56,100,200,0.12)'},
  processing: {label:'处理中', color:'#818cf8', bg:'rgba(129,140,248,0.1)'},
  done:       {label:'已完成', color:'#34d399', bg:'rgba(52,211,153,0.1)'},
  dispatched: {label:'已分派', color:'#34d399', bg:'rgba(52,211,153,0.1)'},
  error:      {label:'失败',   color:'#f87171', bg:'rgba(248,113,113,0.1)'},
};

const QUEUE_STAGE_LABEL: Record<UploadQueueStage, string> = {
  queued: '等待上传',
  chunking: '分片准备中',
  uploading: '上传中',
  merging: '分片合并中',
  processing: '后台处理中',
  dispatched: '已进入调度链',
  done: '已完成',
  error: '上传失败',
};

function describeTransfer(file: UploadFile): string {
  const stage = QUEUE_STAGE_LABEL[file.queueStage] ?? '处理中';
  if (file.transferMode === 'direct') {
    return `直传 · ${stage}`;
  }

  const chunkText = file.totalChunks
    ? `${file.uploadedChunks ?? 0}/${file.totalChunks} 片`
    : '分片模式';
  return `分片 / 断点续传 · ${chunkText} · ${stage}`;
}

function FileTypeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '📦';
  return '📎';
}

export function UploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Defensive: useRoute is a React Navigation hook that may not be available in test environments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rawRoute = (typeof useRoute === 'function') ? useRoute() : null;
  const route = (rawRoute ?? {params: undefined}) as RouteProp<RootStackParamList, 'Upload'> | {params?: RootStackParamList['Upload']};
  const {runtimeMode, runtimeError, gatewayConfigValid} = useAppContext();
  const [files, setFiles] = useState<UploadFile[]>([]);

  const focusFileId = route.params?.focusFileId;
  const focusDispatchId = route.params?.focusDispatchId;

  useEffect(() => {
    setFiles([...uploadService.getQueue()]);

    let cancelled = false;
    if (IS_TEST_ENV) {
      return () => {
        cancelled = true;
      };
    }

    const poll = setInterval(() => {
      if (cancelled) {
        return;
      }
      setFiles([...uploadService.getQueue()]);
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const handleRetry = (file: UploadFile) => {
    uploadService.retryUpload(file.id);
    setFiles([...uploadService.getQueue()]);
  };

  const handleUpload = () => {
    Alert.alert(
      '📎 添加文件',
      '选择文件来源',
      [
        {
          text: '图片 / 视频',
          onPress: () => {
            launchImageLibrary({mediaType: 'mixed', selectionLimit: 0}, (res: ImagePickerResponse) => {
              if (res.didCancel || res.errorCode) return;
              (res.assets ?? []).forEach(asset => {
                if (!asset.uri) return;
                const name = asset.fileName ?? `file_${Date.now()}`;
                enqueueUpload(name, asset.uri, asset.type ?? 'application/octet-stream', asset.fileSize ?? 0);
              });
              setFiles([...uploadService.getQueue()]);
            });
          },
        },
        {
          text: '文档 / 其他',
          onPress: () => {
            DocumentPicker.pick({allowMultiSelection: true})
              .then((results) => {
                results.forEach(doc => {
                  if (!doc.uri) return;
                  enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0);
                });
                setFiles([...uploadService.getQueue()]);
              })
              .catch((err) => {
                if (DocumentPicker.isCancel(err)) return;
                Alert.alert('选择失败', String(err));
              });
          },
        },
        {text: '取消', style: 'cancel'},
      ],
    );
  };

  const handleAnalyzeInChat = (file: UploadFile) => {
    uploadService.markFileForNextDispatch(file.id);
    navigation.navigate('Tabs', {screen: 'Chat'});
  };

  const handleDelete = (fileId: string) => {
    Alert.alert('删除文件', '确定从上传队列中移除？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          uploadService.removeFile(fileId);
          setFiles([...uploadService.getQueue()]);
        },
      },
    ]);
  };

  const rankedFiles = useMemo(() => {
    if (!focusFileId && !focusDispatchId) {
      return files;
    }

    const score = (file: UploadFile) => {
      if (focusFileId && file.id === focusFileId) return 0;
      if (focusDispatchId && file.dispatchId === focusDispatchId) return 1;
      return 9;
    };

    return [...files].sort((a, b) => score(a) - score(b));
  }, [files, focusDispatchId, focusFileId]);

  const completed = rankedFiles.filter(f => f.status === 'done' || f.status === 'dispatched');
  const active    = rankedFiles.filter(f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing');
  const failed    = rankedFiles.filter(f => f.status === 'error');
  const spotlightFile = rankedFiles.find(file => file.id === focusFileId)
    ?? rankedFiles.find(file => focusDispatchId != null && file.dispatchId === focusDispatchId)
    ?? rankedFiles[0];
  const completedCount = completed.length;
  const latestCompleted = completed[0];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>📤 上传管理</Text>
            <Text style={styles.sub}>
              {files.length} 个文件{files.length > 0 ? ` · ${active.length} 上传中 · ${failed.length} 失败` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.8} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>+ 上传</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {runtimeMode !== 'live' && (
        <View style={styles.runtimeBanner}>
          <Text style={styles.runtimeBannerIcon}>🛰️</Text>
          <View style={styles.runtimeBannerText}>
            <Text style={styles.runtimeBannerTitle}>当前为回退模式</Text>
            <Text style={styles.runtimeBannerSub}>
              {runtimeError
                ? runtimeError
                : gatewayConfigValid
                  ? 'Gateway 配置已就绪，可尝试切换至 LIVE 模式'
                  : '附件上传后需真实 Gateway 才能完成后续 AI 处理'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.runtimeBannerBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GatewaySettings')}
          >
            <Text style={styles.runtimeBannerBtnText}>去配置</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {(spotlightFile || completedCount > 0) && (
          <View style={styles.closureCard}>
            <Text style={styles.closureEyebrow}>上传闭环</Text>
            <Text style={styles.closureTitle}>
              {spotlightFile
                ? `当前焦点：${spotlightFile.name}`
                : `最近已完成 ${completedCount} 个附件处理`}
            </Text>
            <Text style={styles.closureDetail}>
              {spotlightFile
                ? `${describeTransfer(spotlightFile)}${spotlightFile.dispatchId ? ` · 已关联调度 ${spotlightFile.dispatchId}` : ''}`
                : '附件上传、后台处理和调度链已经形成可见闭环。'}
            </Text>
            <View style={styles.closureActions}>
              {spotlightFile?.dispatchId ? (
                <TouchableOpacity
                  style={styles.closurePrimaryBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('DispatchChain', {focusDispatchId: spotlightFile.dispatchId})}
                >
                  <Text style={styles.closurePrimaryBtnText}>查看调度链</Text>
                </TouchableOpacity>
              ) : null}
              {spotlightFile ? (
                <TouchableOpacity
                  style={styles.closureSecondaryBtn}
                  activeOpacity={0.82}
                  onPress={() => handleAnalyzeInChat(spotlightFile)}
                >
                  <Text style={styles.closureSecondaryBtnText}>回到对话继续分析</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {latestCompleted ? (
              <Text style={styles.closureSubtext}>
                最近完成：{latestCompleted.name}{latestCompleted.agent ? ` · ${latestCompleted.agent}` : ''}
              </Text>
            ) : null}
          </View>
        )}

        {/* Active uploads — always visible at top when any are running */}
        {active.length > 0 && (
          <View style={styles.activeBanner}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              {active.length} 个文件正在上传/处理中，结果会自动进入 AI 产出流
            </Text>
          </View>
        )}

        {/* 上传链路说明：不做大小限制 */}
        <View style={styles.uploadPolicyBanner}>
          <Text style={styles.uploadPolicyText}>
            📡 无大小限制 · 小文件直传 · 大文件自动分片/断点续传 · 后台 AI 处理队列
          </Text>
        </View>

        {files.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>暂无上传任务</Text>
            <Text style={styles.emptyDesc}>
              直接点击下方按钮上传文件，无大小限制。
            </Text>
            <Text style={styles.emptyHint}>
              小文件直传；≥10 MB 或未知大小文件自动分片上传 + 断点续传
            </Text>
            <View style={styles.emptyUploadRow}>
              <TouchableOpacity
                style={styles.emptyUploadBtn}
                activeOpacity={0.8}
                onPress={handleUpload}
              >
                <Text style={styles.emptyUploadBtnText}>📎 选择文件上传</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.emptyNote}>
              上传后文件自动进入后台处理队列，AI 分析结果实时回流到首页。
            </Text>
          </View>
        ) : null}

        {files.length > 0 && (
          <>
            {/* Failed first */}
            {failed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>❌ 失败 ({failed.length})</Text>
                {failed.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.error;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {meta.label}
                          </Text>
                          {f.error ? (
                            <Text style={styles.errorText}>{f.error}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.retryBtn}
                          activeOpacity={0.75}
                          onPress={() => handleRetry(f)}
                        >
                          <Text style={styles.retryBtnText}>🔄 重试</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          activeOpacity={0.75}
                          onPress={() => handleDelete(f.id)}
                        >
                          <Text style={styles.deleteBtnText}>🗑 删除</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Active uploads */}
            {active.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>⏳ 进行中 ({active.length})</Text>
                {active.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.uploading;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {meta.label}
                            {f.status === 'uploading' && ` · ${Math.round(f.progress)}%`}
                          </Text>
                          <Text style={styles.transferMeta}>{describeTransfer(f)}</Text>
                          {f.transferMode === 'chunked' && typeof f.totalChunks === 'number' ? (
                            <Text style={styles.chunkMeta}>已完成 {f.uploadedChunks ?? 0}/{f.totalChunks} 片</Text>
                          ) : null}
                          {(f.status === 'uploading' || f.status === 'processing') && (
                            <View style={styles.progressBar}>
                              <View style={[styles.progressFill, {width: `${f.progress}%`}]} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.statusDot}>●</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>✅ 已完成 ({completed.length})</Text>
                {completed.map(f => {
                  const meta = STATUS_META[f.status] ?? STATUS_META.done;
                  const isFocused = focusFileId === f.id || (focusDispatchId && focusDispatchId === f.dispatchId);
                  return (
                    <View key={f.id} style={[styles.card, isFocused && styles.focusCard]}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardLeft}>
                          <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                        </View>
                        <View style={styles.cardBody}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileMeta}>
                            {uploadService.formatBytes(f.size)} · {f.agent ? `分派给 ${f.agent}` : meta.label}
                          </Text>
                          {f.dispatchId ? (
                            <TouchableOpacity
                              style={styles.dispatchLink}
                              activeOpacity={0.7}
                              onPress={() => navigation.navigate('DispatchChain', {focusDispatchId: f.dispatchId})}
                            >
                              <Text style={styles.dispatchLinkText}>
                                🔗 查看调度单 {f.dispatchId.length > 18 ? `…${f.dispatchId.slice(-14)}` : f.dispatchId}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            style={styles.chatLink}
                            activeOpacity={0.78}
                            onPress={() => handleAnalyzeInChat(f)}
                          >
                            <Text style={styles.chatLinkText}>💬 回到对话继续分析</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(f.id)}>
                          <Text style={styles.doneIcon}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       {flex: 1, backgroundColor: C.bgRoot},
  header:     {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12},
  headerRow:  {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerActions:{flexDirection: 'row', gap: 8, alignItems: 'center'},
  uploadBtn:  {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.primary,
  },
  uploadBtnText:{color: C.bgRoot, fontWeight: '900', fontSize: 14},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  content:    {padding: 16, paddingBottom: 100},

  emptyState: {
    alignItems: 'center', paddingVertical: 48,
    gap: 12,
  },
  emptyEmoji: {fontSize: 48},
  emptyTitle: {color: C.textTitle, fontSize: 18, fontWeight: '800'},
  emptyDesc:  {color: C.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingHorizontal: 32},
  emptyHint:  {color: C.primary, fontSize: 12, textAlign: 'center', paddingHorizontal: 32},
  emptyUploadRow: {marginTop: 8, flexDirection: 'row'},
  emptyUploadBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: C.primary,
  },
  emptyUploadBtnText: {color: C.bgRoot, fontWeight: '900', fontSize: 14},
  emptyNote:  {color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6, fontStyle: 'italic', paddingHorizontal: 32},

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  activeDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary},
  activeText: {color: C.primary, fontSize: 12, fontWeight: '800', flex: 1},

  closureCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.18)',
    marginBottom: 10,
  },
  closureEyebrow: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  closureTitle: {color: C.textTitle, fontSize: 16, fontWeight: '900'},
  closureDetail: {color: C.textBody, fontSize: 12, lineHeight: 18, marginTop: 6},
  closureActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  closurePrimaryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#34d399',
  },
  closurePrimaryBtnText: {color: C.bgRoot, fontSize: 13, fontWeight: '900'},
  closureSecondaryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.borderSubtle,
  },
  closureSecondaryBtnText: {color: C.textTitle, fontSize: 13, fontWeight: '800'},
  closureSubtext: {color: C.textMuted, fontSize: 11, marginTop: 10},

  uploadPolicyBanner: {
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.07)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.18)',
  },
  uploadPolicyText: {color: '#34d399', fontSize: 11, fontWeight: '700', textAlign: 'center'},

  sectionTitle: {
    color: C.textMuted, fontSize: 11, fontWeight: '900',
    marginTop: 8, marginBottom: 8,
    letterSpacing: 1,
  },

  card: {
    padding: 14, borderRadius: 18,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderSubtle,
    marginBottom: 10,
  },
  focusCard: {
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  cardTop: {flexDirection: 'row', alignItems: 'center', gap: 12},
  cardLeft: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  fileEmoji: {fontSize: 22},
  cardBody:  {flex: 1},
  fileName:  {color: C.textTitle, fontSize: 14, fontWeight: '800'},
  fileMeta:  {color: C.textMuted, fontSize: 11, marginTop: 4},
  transferMeta: {color: C.textBody, fontSize: 11, marginTop: 6},
  chunkMeta: {color: C.textMuted, fontSize: 11, marginTop: 2},
  errorText: {color: '#f87171', fontSize: 11, marginTop: 4},
  statusDot: {fontSize: 16, color: C.primary},
  doneIcon:  {fontSize: 18, color: '#34d399', fontWeight: '900'},

  progressBar: {
    marginTop: 8, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(56,100,200,0.2)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: C.primary,
  },

  cardActions: {flexDirection: 'row', gap: 8, marginTop: 10},
  retryBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.15)',
    borderWidth: 1, borderColor: C.borderActive,
  },
  retryBtnText: {color: C.primary, fontSize: 13, fontWeight: '800'},
  deleteBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
  },
  deleteBtnText: {color: '#f87171', fontSize: 13, fontWeight: '800'},

  footer: {height: 24},

  dispatchLink: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(56,100,200,0.1)',
    alignSelf: 'flex-start',
  },
  dispatchLinkText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  chatLink: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(52,211,153,0.1)',
    alignSelf: 'flex-start',
  },
  chatLinkText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },

  runtimeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  runtimeBannerIcon: {fontSize: 20},
  runtimeBannerText: {flex: 1},
  runtimeBannerTitle: {color: '#f97316', fontSize: 13, fontWeight: '800'},
  runtimeBannerSub: {color: C.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16},
  runtimeBannerBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
  },
  runtimeBannerBtnText: {color: '#f97316', fontSize: 12, fontWeight: '800'},
});
