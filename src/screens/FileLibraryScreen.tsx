import React, {useState, useCallback, useMemo} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import {C} from '../data/mockData';
import {enqueueUpload, uploadService, type UploadFile} from '../services/uploadService';
import {useAppContext} from '../context/AppContext';



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

// ─── Component ────────────────────────────────────────────────────────────────
export function FileLibraryScreen() {
  const [activeType, setActiveType] = useState<FilterType>('全部');
  const {uploads} = useAppContext();

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
              void enqueueUpload(name, asset.uri, asset.type ?? 'application/octet-stream', asset.fileSize ?? 0);
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
                void enqueueUpload(doc.name ?? '文档', doc.uri, doc.type ?? 'application/octet-stream', doc.size ?? 0);
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

          return (
            <View key={file.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.fileEmoji}>{typeMeta.emoji}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
                <Text style={styles.fileMeta}>{fileSize} · {fileAgent} · {fileTime}</Text>
                <View style={[styles.statusBadge, {borderColor: statusMeta.color + '44'}]}>
                  <Text style={[styles.statusText, {color: statusMeta.color}]}>{statusMeta.label}</Text>
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
  title:      {color: C.textTitle, fontSize: 26, fontWeight: '900'},
  sub:        {color: C.textMuted, fontSize: 12, marginTop: 4},
  uploadBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.primary,
  },
  uploadBtnText:{color: C.bgRoot, fontWeight: '900', fontSize: 14},
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
  uploadingText: {color: C.primary, fontSize: 12, fontWeight: '700'},
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
  filterText:      {color: C.textMuted, fontSize: 13, fontWeight: '700'},
  filterTextActive:{color: C.primary},
  content:    {padding: 16, paddingBottom: 100, gap: 10},
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
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusText: {fontSize: 10, fontWeight: '800'},
  footer:     {height: 24},
});
