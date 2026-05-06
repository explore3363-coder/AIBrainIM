import React, {useEffect, useState} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/mockData';
import {uploadService, enqueueUpload, enqueueDemoUpload, type UploadFile} from '../services/uploadService';
import {launchImageLibrary, type ImagePickerResponse} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';

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

function FileTypeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz')) return '📦';
  return '📎';
}

export function UploadScreen() {
  const [files, setFiles] = useState<UploadFile[]>([]);

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

  const handleDemo = () => {
    enqueueDemoUpload();
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

  const completed = files.filter(f => f.status === 'done' || f.status === 'dispatched');
  const active    = files.filter(f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing');
  const failed    = files.filter(f => f.status === 'error');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>📤 上传管理</Text>
            <Text style={styles.sub}>
              {files.length} 个文件 · {active.length} 上传中 · {failed.length} 失败
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.demoBtn} activeOpacity={0.8} onPress={handleDemo}>
              <Text style={styles.demoBtnText}>🎲 Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.8} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>+ 上传</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {files.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>暂无上传任务</Text>
            <Text style={styles.emptyHint}>在「对话」或「附件库」页面添加文件即可开始上传</Text>
          </View>
        )}

        {/* Failed first */}
        {failed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>❌ 失败 ({failed.length})</Text>
            {failed.map(f => {
              const meta = STATUS_META[f.status] ?? STATUS_META.error;
              return (
                <View key={f.id} style={styles.card}>
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
              return (
                <View key={f.id} style={styles.card}>
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
              return (
                <View key={f.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.fileEmoji}>{FileTypeIcon(f.mimeType)}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                      <Text style={styles.fileMeta}>
                        {uploadService.formatBytes(f.size)} · {f.agent ? `分派给 ${f.agent}` : meta.label}
                      </Text>
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
  demoBtn:    {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(129,140,248,0.12)',
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.35)',
  },
  demoBtnText: {color: '#818cf8', fontWeight: '900', fontSize: 13},
  uploadBtn:  {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.primary,
  },
  uploadBtnText:{color: C.bgRoot, fontWeight: '900', fontSize: 14},
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  content:    {padding: 16, paddingBottom: 100},

  emptyState: {
    alignItems: 'center', paddingVertical: 60,
    gap: 12,
  },
  emptyEmoji: {fontSize: 48},
  emptyTitle: {color: C.textTitle, fontSize: 18, fontWeight: '800'},
  emptyHint:  {color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40},

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
});
