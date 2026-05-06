import React from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C, profileStatsMock} from '../data/mockData';
import {MetricCard} from '../components/MetricCard';
import {useAppContext} from '../context/AppContext';

type RootStackParamList = {
  Tabs: undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: undefined;
  Confirmations: undefined;
  Upload: undefined;
};

interface MenuItemProps {
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  badge?: string;
}

function MenuItem({emoji, title, subtitle, accent, onPress, badge}: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.menuIcon, {backgroundColor: accent + '22', borderColor: accent + '44'}]}>
        <Text style={styles.menuEmoji}>{emoji}</Text>
      </View>
      <View style={styles.menuText}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>{title}</Text>
          {badge && <View style={[styles.menuBadge, {backgroundColor: accent}]}><Text style={styles.menuBadgeText}>{badge}</Text></View>}
        </View>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const buildNumber = '1'; // iOS CFBundleVersion — update via CI

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const stats = profileStatsMock;
  const {uploads, runtimeMode, runtimeError, lastSyncedAt, sessionCount, pendingConfirmations} = useAppContext();
  const activeUploads = uploads.filter(
    f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing',
  ).length;
  const runtimeSummary = runtimeMode === 'live'
    ? `已连接 OpenClaw Gateway · ${sessionCount} 个会话 · 最近同步 ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : '刚刚'}`
    : `当前处于本地回退模式${runtimeError ? ` · ${runtimeError}` : ''}`;

  const handleJoinTestFlight = () => {
    // Replace with actual TestFlight public link from App Store Connect
    Alert.alert(
      '加入 TestFlight',
      '需要先在 App Store Connect 创建 App 记录并上传第一个 Build 后，才能获取 TestFlight 公开链接。\n\n下一步：配置 Apple Developer 账号并触发 TestFlight CI。',
      [
        {text: '查看上线准备', onPress: handleShowAppStoreGuide},
        {text: '好的'},
      ],
    );
  };

  const handleShowAppStoreGuide = () => {
    Alert.alert(
      '📋 App Store 上线清单',
      [
        '✅ GitHub Actions CI/CD 已配置',
        '✅ GitHub Actions TestFlight Upload 已配置',
        '✅ Fastlane lanes（sim/tf/appstore）已配置',
        '',
        '📝 待完成：',
        '1. Apple Developer 账号（$99/年）',
        '2. App Store Connect → 创建 App（Bundle ID: com.openclaw.aibrainim）',
        '3. 配置 App Icon（1024×1024）',
        '4. 添加截图（iPhone 6.7" / 6.5" / 5.5"）',
        '5. 填写隐私信息、年龄分级',
        '6. 运行: git tag v0.1.0 && git push --tags',
        '7. GitHub Actions 自动构建并上传 TestFlight',
        '8. App Store Connect → TestFlight → 添加测试人员',
        '9. 提交审核（~24-48h）',
      ].join('\n'),
      [{text: '知道了'}],
    );
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      {text: '取消', style: 'cancel'},
      {text: '退出', style: 'destructive', onPress: () => {}},
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>我</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>用户</Text>
            <Text style={styles.profileRole}>AI 大脑驾驶舱</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>在线</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <MetricCard label="总任务"     value={`${stats.totalTasks}`}     accent={C.primary} />
          <MetricCard label="已完成"     value={`${stats.completedTasks}`}  accent="#34d399" />
          <MetricCard label="活跃 Agent" value={`${stats.activeAgents}`}  accent={C.accent} />
        </View>

        {/* 信息层入口 */}
        <Text style={styles.sectionTitle}>📚 信息层</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="🧠"
            title="记忆库"
            subtitle={`${stats.memoryEntries} 条记忆 · 长期 + 短期`}
            accent="#a78bfa"
            onPress={() => navigation.navigate('MemoryStore')}
          />
          <MenuItem
            emoji="📖"
            title="知识库"
            subtitle={`${stats.knowledgeDocs} 篇文档 · 矿业 + 工程 + 技术`}
            accent={C.primary}
            onPress={() => navigation.navigate('KnowledgeBase')}
          />
          <MenuItem
            emoji="📎"
            title="附件库"
            subtitle="图片 / 视频 / 文档 · 上传后 AI 自动分派"
            accent="#f97316"
            onPress={() => navigation.navigate('FileLibrary')}
          />
          <MenuItem
            emoji="🔗"
            title="调度链"
            subtitle="查看指令从接收到交付的完整流转"
            accent={C.accent}
            onPress={() => navigation.navigate('DispatchChain')}
          />
          <MenuItem
            emoji="📁"
            title="项目库"
            subtitle="AIBrainIM / 聚源三维 · 项目文档与进度"
            accent="#34d399"
            onPress={() => navigation.navigate('ProjectLibrary')}
          />
        </View>

        {/* 🚀 TestFlight / App Store 准备 */}
        <Text style={styles.sectionTitle}>🚀 上线准备</Text>
        <View style={styles.releaseCard}>
          <View style={styles.releaseHeader}>
            <View style={styles.releaseIconWrap}>
              <Text style={styles.releaseIcon}>🚀</Text>
            </View>
            <View style={styles.releaseHeaderText}>
              <Text style={styles.releaseTitle}>AIBrainIM Alpha</Text>
              <Text style={styles.releaseVersion}>v0.1.0 · Build {buildNumber}</Text>
            </View>
            <View style={styles.releaseBadge}>
              <Text style={styles.releaseBadgeText}>Alpha</Text>
            </View>
          </View>

          <Text style={styles.releaseDesc}>
            已完成 P1 可用闭环：总览驾驶舱 / AI 对话 / 智能体状态 / 任务看板 / 我的页。五主功能固定，附件上传已通，记忆库·知识库·调度链入口已串。
          </Text>

          <View style={styles.releaseChecklist}>
            {[
              {done: true,  text: 'React Native 主工程 + iOS 构建'},      
              {done: true,  text: '五主功能（总览/对话/智能体/任务/我的）'}, 
              {done: true,  text: '附件上传（分片/断点续传/后台队列）'},    
              {done: true,  text: '记忆库 + 知识库 + 调度链入口'},         
              {done: true,  text: 'GitHub Actions CI（Simulator Build）'}, 
              {done: true,  text: 'GitHub Actions TestFlight Upload'},     
              {done: false, text: 'Apple Developer 账号配置（team ID / API Key）'}, 
              {done: false, text: 'App Store Connect App 记录创建'},       
              {done: false, text: 'App Icon（1024×1024）+ 截图'},          
              {done: false, text: 'TestFlight External Testing 发布'},     
            ].map((item, i) => (
              <View key={i} style={styles.checkItem}>
                <Text style={[styles.checkIcon, {color: item.done ? '#34d399' : C.textMuted}]}>
                  {item.done ? '✅' : '⬜'}
                </Text>
                <Text style={[styles.checkText, !item.done && styles.checkTextPending]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.releaseActions}>
            <TouchableOpacity
              style={styles.releaseBtnPrimary}
              activeOpacity={0.8}
              onPress={handleJoinTestFlight}
            >
              <Text style={styles.releaseBtnPrimaryText}>📱 加入 TestFlight</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.releaseBtnSecondary}
              activeOpacity={0.8}
              onPress={handleShowAppStoreGuide}
            >
              <Text style={styles.releaseBtnSecondaryText}>📋 App Store 准备清单</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 系统 */}
        <Text style={styles.sectionTitle}>⚙️ 系统</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="🔔"
            title="需确认项"
            subtitle="待你决策的任务与问题"
            accent="#f87171"
            onPress={() => navigation.navigate('Confirmations')}
            badge={pendingConfirmations > 0 ? String(pendingConfirmations) : undefined}
          />
          <MenuItem
            emoji="📤"
            title="上传管理"
            subtitle={activeUploads > 0 ? `${activeUploads} 个文件上传/处理中` : '查看上传队列与处理状态'}
            accent={activeUploads > 0 ? C.primary : '#94a3b8'}
            onPress={() => navigation.navigate('Upload')}
            badge={activeUploads > 0 ? String(activeUploads) : undefined}
          />
          <MenuItem
            emoji="🛰️"
            title="当前可用闭环"
            subtitle="总览 / 对话 / 智能体 / 任务 / 我的 已全功能贯通"
            accent="#34d399"
            onPress={() => {}}
          />
          <MenuItem
            emoji="🌐"
            title="OpenClaw 状态"
            subtitle={runtimeSummary}
            accent={runtimeMode === 'live' ? C.primary : '#f97316'}
            onPress={() => {}}
            badge={runtimeMode === 'live' ? 'LIVE' : 'FALLBACK'}
          />
          <MenuItem
            emoji="📊"
            title="使用统计"
            subtitle="任务完成率 · Agent 活跃趋势"
            accent={C.accent}
            onPress={() => {}}
          />
        </View>

        {/* 设置 */}
        <Text style={styles.sectionTitle}>🔧 设置</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="⚡"
            title="AI 模型配置"
            subtitle="选择语言模型 · 调整生成参数"
            accent="#fbbf24"
            onPress={() => Alert.alert('提示', '模型配置功能开发中')}
          />
          <MenuItem
            emoji="🔊"
            title="通知与提醒"
            subtitle="任务状态变更 · AI 产出提醒"
            accent={C.primary}
            onPress={() => Alert.alert('提示', '通知设置功能开发中')}
          />
          <MenuItem
            emoji="🔒"
            title="隐私与安全"
            subtitle="数据存储 · 权限管理"
            accent={C.accent}
            onPress={() => Alert.alert('提示', '隐私设置功能开发中')}
          />
        </View>

        {/* 退出 */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: C.bgRoot},
  content:      {padding: 16, paddingBottom: 100},

  // Header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    marginBottom: 16,
  },
  avatarWrap: {position: 'relative'},
  avatar: {
    width: 64, height: 64, borderRadius: 24,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {color: C.bgRoot, fontSize: 26, fontWeight: '900'},
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22d3ee',
    borderWidth: 2, borderColor: C.bgRoot,
  },
  profileInfo: {flex: 1},
  profileName: {color: C.textTitle, fontSize: 22, fontWeight: '900'},
  profileRole: {color: C.textMuted, fontSize: 12, marginTop: 3},
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1, borderColor: C.accent,
    alignSelf: 'flex-start',
  },
  statusDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 5},
  statusText: {color: C.accent, fontSize: 11, fontWeight: '800'},

  // Stats
  statsGrid: {flexDirection: 'row', gap: 10, marginBottom: 8},

  // Sections
  sectionTitle: {
    color: C.textTitle, fontSize: 16, fontWeight: '900',
    marginTop: 24, marginBottom: 10,
  },
  menuGroup: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1, borderColor: C.borderSubtle,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 13, padding: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  menuEmoji: {fontSize: 18},
  menuText:  {flex: 1},
  menuTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  menuTitle:    {color: C.textTitle, fontSize: 15, fontWeight: '800'},
  menuBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, marginLeft: 4,
  },
  menuBadgeText: {color: C.bgRoot, fontSize: 10, fontWeight: '900'},
  menuSubtitle: {color: C.textMuted, fontSize: 12, marginTop: 3},
  menuArrow: {color: C.textMuted, fontSize: 22, fontWeight: '300'},

  // Release / TestFlight card
  releaseCard: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: 'hidden',
    marginBottom: 8,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(56,100,200,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  releaseIconWrap: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(56,100,200,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseIcon: {fontSize: 24},
  releaseHeaderText: {flex: 1},
  releaseTitle: {color: C.textTitle, fontSize: 17, fontWeight: '900'},
  releaseVersion: {color: C.textMuted, fontSize: 11, marginTop: 3},
  releaseBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(56,100,200,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,100,200,0.35)',
  },
  releaseBadgeText: {color: C.primary, fontSize: 11, fontWeight: '900'},
  releaseDesc: {
    color: C.textBody, fontSize: 12, lineHeight: 18,
    padding: 14, paddingBottom: 0,
  },
  releaseChecklist: {
    padding: 14,
    gap: 7,
  },
  checkItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checkIcon: {fontSize: 13, width: 18},
  checkText: {color: C.textBody, fontSize: 12, flex: 1},
  checkTextPending: {color: C.textMuted},
  releaseActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },
  releaseBtnPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  releaseBtnPrimaryText: {color: C.bgRoot, fontWeight: '900', fontSize: 13},
  releaseBtnSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(56,100,200,0.1)',
    borderWidth: 1,
    borderColor: C.borderActive,
    alignItems: 'center',
  },
  releaseBtnSecondaryText: {color: C.primary, fontWeight: '700', fontSize: 13},
  versionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  versionText: {color: C.textMuted, fontSize: 11},
  versionSep: {width: 1, height: 10, backgroundColor: C.borderSubtle},
  buildText: {color: C.textMuted, fontSize: 11},

  // Logout
  logoutBtn: {
    marginTop: 32,
    padding: 15, borderRadius: 16,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: '#f87171',
    alignItems: 'center',
  },
  logoutText: {color: '#f87171', fontSize: 15, fontWeight: '800'},

  footer: {height: 32},
});
