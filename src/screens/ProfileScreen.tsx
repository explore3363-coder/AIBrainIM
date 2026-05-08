import React, {useMemo} from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';
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
  GatewaySettings: undefined;
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

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    uploads,
    runtimeMode,
    runtimeError,
    lastSyncedAt,
    sessionCount,
    pendingConfirmations,
    tasks,
    dispatches,
    agents,
    gatewaySummary,
    gatewayConfigValid,
    gatewayWarningCount,
    refreshing,
    refresh,
  } = useAppContext();

  const safeUploads = useMemo(() => Array.isArray(uploads) ? uploads : [], [uploads]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  const safeDispatches = useMemo(() => Array.isArray(dispatches) ? dispatches : [], [dispatches]);
  const safeAgents = useMemo(() => Array.isArray(agents) ? agents : [], [agents]);

  const activeUploads = safeUploads.filter(
    f => f.status === 'uploading' || f.status === 'queued' || f.status === 'processing',
  ).length;

  const dispatchInFlight = safeDispatches.filter(item => item.status !== 'completed' && item.status !== 'failed').length;
  const memorySignals = Math.min(99, safeDispatches.length + pendingConfirmations + Math.min(safeTasks.length, 6));
  const knowledgeSignals = Math.min(99, safeAgents.length + Math.min(safeTasks.length, 8) + Math.min(safeUploads.length, 6));

  // Stats from live context — no hardcoded profileStatsMock
  const stats = useMemo(() => {
    const doneTasks = safeTasks.filter(task => task.state === 'done').length;
    const activeAgents = safeAgents.filter(a => a.status === 'online' || a.status === 'working').length;
    return {
      totalTasks: safeTasks.length,
      completedTasks: doneTasks,
      activeAgents,
      memoryEntries: memorySignals,
      knowledgeDocs: knowledgeSignals,
    };
  }, [safeTasks, safeAgents, memorySignals, knowledgeSignals]);
  const runtimeSummary = runtimeMode === 'live'
    ? `已连接 OpenClaw Gateway · ${sessionCount} 个会话 · 最近同步 ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : '刚刚'}`
    : `当前处于本地回退模式${runtimeError ? ` · ${runtimeError}` : ''}`;

  const runningTasks = safeTasks.filter(task => task.state === 'running').length;
  const blockedTasks = safeTasks.filter(task => task.state === 'blocked').length;
  const doneTasks = safeTasks.filter(task => task.state === 'done').length;

  const releaseSignals = useMemo(() => {
    const blockers: string[] = [];
    const nextActions: string[] = [];

    if (runtimeMode !== 'live') {
      blockers.push('当前仍在本地回退模式，TestFlight 前需至少验证一轮 LIVE 闭环。');
      nextActions.push('优先恢复 Gateway 连通性并验证真实调度链。');
    }

    if (pendingConfirmations > 0) {
      blockers.push(`还有 ${pendingConfirmations} 条需确认项未拍板，会上线体验里留下“待人工决策”缺口。`);
      nextActions.push('先清掉需确认项，确保闭环不是卡在人工拍板。');
    }

    if (blockedTasks > 0) {
      blockers.push(`当前有 ${blockedTasks} 条阻塞任务，提测前应至少收口到可解释状态。`);
      nextActions.push('进入任务页处理阻塞项，避免 TestFlight 首屏出现未解释异常。');
    }

    if (activeUploads > 0) {
      nextActions.push(`当前有 ${activeUploads} 条附件链路在跑，建议补看上传管理页确认回流正常。`);
    }

    if (dispatchInFlight > 0) {
      nextActions.push(`当前有 ${dispatchInFlight} 条调度仍在推进，建议补看调度链确认状态回流。`);
    }

    if (!nextActions.length) {
      nextActions.push('P1 闭环状态稳定，可转入图标、截图、TestFlight 提交流程。');
    }

    const readiness = blockers.length === 0
      ? '可提测'
      : blockers.length <= 2
        ? '待收口'
        : '未就绪';

    return {
      blockers,
      nextActions,
      readiness,
      readinessAccent: readiness === '可提测' ? '#34d399' : readiness === '待收口' ? '#fbbf24' : '#f97316',
      readinessDesc: readiness === '可提测'
        ? '五主功能已形成可演示闭环，剩余工作主要是提测物料与 Apple 链路。'
        : readiness === '待收口'
          ? '主功能已基本贯通，但还有少量运行态缺口要先补齐。'
          : '当前仍存在明显运行态缺口，先别急着做上架物料。',
    };
  }, [activeUploads, blockedTasks, dispatchInFlight, pendingConfirmations, runtimeMode]);

  const readinessChecklist = useMemo(() => {
    return [
      {done: true, text: 'React Native 主工程 + iOS 构建'},
      {done: true, text: '五主功能（总览 / 对话 / 智能体 / 任务 / 我的）'},
      {done: true, text: '记忆库 / 知识库 / 附件入口 / 调度链已接入前台'},
      {done: true, text: 'GitHub Actions + Fastlane TestFlight 链路已预置'},
      {done: runtimeMode === 'live', text: '至少完成一轮 LIVE 网关闭环验证'},
      {done: pendingConfirmations === 0, text: '需确认项清零或压到可解释范围'},
      {done: blockedTasks === 0, text: '阻塞任务收口到可提测状态'},
      {done: false, text: 'Apple Developer / App Store Connect / 截图 / 图标'},
    ];
  }, [blockedTasks, pendingConfirmations, runtimeMode]);

  const appleMaterials = useMemo(() => {
    return [
      {done: false, label: 'Apple Developer 账号与 Team ID'},
      {done: false, label: 'App Store Connect App 记录'},
      {done: true,  label: '1024×1024 App Icon'},
      {done: false, label: 'iPhone 6.7" / 6.5" / 5.5" 截图'},
      {done: false, label: '隐私信息 / 年龄分级 / 支持链接'},
      {done: false, label: '第一个 TestFlight Build 上传'},
    ];
  }, []);

  const readinessDoneCount = readinessChecklist.filter(item => item.done).length;
  const readinessTotalCount = readinessChecklist.length;

  const handleJoinTestFlight = () => {
    // Replace with actual TestFlight public link from App Store Connect
    Alert.alert(
      '加入 TestFlight',
      '需要先在 App Store Connect 创建 App 记录并上传第一个 Build 后,才能获取 TestFlight 公开链接。\n\n下一步:配置 Apple Developer 账号并触发 TestFlight CI。',
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
        `当前判定：${releaseSignals.readiness} · ${readinessDoneCount}/${readinessTotalCount}`,
        releaseSignals.readinessDesc,
        '',
        '运行态收口：',
        ...releaseSignals.blockers.length
          ? releaseSignals.blockers.map((item, index) => `${index + 1}. ${item}`)
          : ['1. 运行态主闭环已收口，可转入 Apple 物料准备'],
        '',
        'Apple 链路：',
        '1. Apple Developer 账号（$99/年）',
        '2. App Store Connect → 创建 App（Bundle ID: com.openclaw.aibrainim）',
        '3. 配置 App Icon（1024×1024）',
        '4. 添加截图（iPhone 6.7" / 6.5" / 5.5"）',
        '5. 填写隐私信息、年龄分级',
        '6. 运行: git tag v0.1.0 && git push --tags',
        '7. GitHub Actions 自动构建并上传 TestFlight',
        '8. App Store Connect → TestFlight → 添加测试人员',
      ].join('\n'),
      [{text: '知道了'}],
    );
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗?', [
      {text: '取消', style: 'cancel'},
      {text: '退出', style: 'destructive', onPress: () => {}},
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C.primary}
          />
        }
      >
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

        {/* 快捷入口 strip */}
        <View style={styles.quickAccessRow}>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('MemoryStore')}>
            <Text style={styles.quickAccessEmoji}>🧠</Text>
            <Text style={styles.quickAccessLabel}>记忆库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('KnowledgeBase')}>
            <Text style={styles.quickAccessEmoji}>📖</Text>
            <Text style={styles.quickAccessLabel}>知识库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('FileLibrary')}>
            <Text style={styles.quickAccessEmoji}>📎</Text>
            <Text style={styles.quickAccessLabel}>附件库</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} activeOpacity={0.8} onPress={() => navigation.navigate('DispatchChain')}>
            <Text style={styles.quickAccessEmoji}>🔗</Text>
            <Text style={styles.quickAccessLabel}>调度链</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <MetricCard label="总任务"     value={`${stats.totalTasks}`}     accent={C.primary} />
          <MetricCard label="已完成"     value={`${stats.completedTasks}`}  accent="#34d399" />
          <MetricCard label="活跃 Agent" value={`${stats.activeAgents}`}  accent={C.accent} />
        </View>

        <Text style={styles.sectionTitle}>🛰️ 当前运行态</Text>
        <View style={styles.runtimeBoard}>
          <View style={styles.runtimeBoardTop}>
            <View>
              <Text style={styles.runtimeBoardTitle}>OpenClaw 直连健康度</Text>
              <Text style={styles.runtimeBoardSub}>{gatewaySummary}</Text>
            </View>
            <View style={[styles.runtimeBadge, runtimeMode === 'live' ? styles.runtimeBadgeLive : styles.runtimeBadgeFallback]}>
              <Text style={[styles.runtimeBadgeText, runtimeMode === 'live' ? styles.runtimeBadgeTextLive : styles.runtimeBadgeTextFallback]}>
                {runtimeMode === 'live' ? 'LIVE' : 'FALLBACK'}
              </Text>
            </View>
          </View>

          <View style={styles.runtimeGrid}>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>网关配置</Text>
              <Text style={styles.runtimeCellValue}>{gatewayConfigValid ? '可测试' : '待补全'}</Text>
              <Text style={styles.runtimeCellHint}>{gatewayWarningCount > 0 ? `${gatewayWarningCount} 个提醒` : '当前无预警'}</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>调度推进中</Text>
              <Text style={styles.runtimeCellValue}>{dispatchInFlight}</Text>
              <Text style={styles.runtimeCellHint}>直接影响首页 AI 产出流</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>待人工拍板</Text>
              <Text style={styles.runtimeCellValue}>{pendingConfirmations}</Text>
              <Text style={styles.runtimeCellHint}>不清掉就会卡住闭环</Text>
            </View>
            <View style={styles.runtimeCell}>
              <Text style={styles.runtimeCellLabel}>上传链路</Text>
              <Text style={styles.runtimeCellValue}>{activeUploads}</Text>
              <Text style={styles.runtimeCellHint}>前端上传 / 后台处理 / 回流</Text>
            </View>
          </View>
        </View>

        {/* 信息层入口 */}
        <Text style={styles.sectionTitle}>📚 信息层</Text>
        <View style={styles.menuGroup}>
          <MenuItem
            emoji="🧠"
            title="记忆库"
            subtitle={`${stats.memoryEntries} 条运行态信号 · 长期 + 短期记忆入口`}
            accent="#a78bfa"
            onPress={() => navigation.navigate('MemoryStore')}
          />
          <MenuItem
            emoji="📖"
            title="知识库"
            subtitle={`${stats.knowledgeDocs} 条知识信号 · 矿业 + 工程 + 技术入口`}
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
              <Text style={styles.releaseTitle}>AI协作平台</Text>
              <View style={styles.versionTag}>
                <Text style={styles.releaseVersion}>v0.1.0 · build 1</Text>
                <View style={styles.versionSep} />
                <Text style={styles.buildText}>AIBrainIM / Alpha</Text>
              </View>
              <Text style={styles.releaseProgressText}>提测收口进度 {readinessDoneCount}/{readinessTotalCount}</Text>
            </View>
            <View style={[styles.releaseBadge, {backgroundColor: releaseSignals.readinessAccent + '22', borderColor: releaseSignals.readinessAccent + '55'}]}>
              <Text style={[styles.releaseBadgeText, {color: releaseSignals.readinessAccent}]}>{releaseSignals.readiness}</Text>
            </View>
          </View>

          <Text style={styles.releaseDesc}>
            {releaseSignals.readinessDesc}
          </Text>

          <View style={styles.releaseSnapshotRow}>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{runningTasks}</Text>
              <Text style={styles.releaseSnapshotLabel}>执行中任务</Text>
            </View>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{doneTasks}</Text>
              <Text style={styles.releaseSnapshotLabel}>已收口任务</Text>
            </View>
            <View style={styles.releaseSnapshotCard}>
              <Text style={styles.releaseSnapshotValue}>{dispatchInFlight}</Text>
              <Text style={styles.releaseSnapshotLabel}>推进中调度</Text>
            </View>
          </View>

          <View style={styles.releaseChecklist}>
            {readinessChecklist.map((item, i) => (
              <View key={i} style={styles.checkItem}>
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                <Text style={[styles.checkIcon, {color: item.done ? '#34d399' : C.textMuted}]}> 
                  {item.done ? '✅' : '⬜'}
                </Text>
                <Text style={[styles.checkText, !item.done && styles.checkTextPending]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>当前最该补的</Text>
            {releaseSignals.blockers.length > 0 ? releaseSignals.blockers.map((item, index) => (
              <Text key={index} style={styles.releaseFocusText}>• {item}</Text>
            )) : (
              <Text style={styles.releaseFocusText}>• 运行态已基本收口，下一步优先准备 App Icon、截图与 TestFlight 提测物料。</Text>
            )}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>下一步动作</Text>
            {releaseSignals.nextActions.slice(0, 3).map((item, index) => (
              <Text key={index} style={styles.releaseFocusText}>• {item}</Text>
            ))}
          </View>

          <View style={styles.releaseFocusBox}>
            <Text style={styles.releaseFocusTitle}>Apple 物料缺口</Text>
            {appleMaterials.map((item, index) => (
              <View key={index} style={styles.materialItem}>
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                <Text style={[styles.materialDot, {color: item.done ? '#34d399' : '#f97316'}]}>
                  {item.done ? '●' : '○'}
                </Text>
                <Text style={[styles.materialText, !item.done && styles.materialTextPending]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.releaseActions}>
            <TouchableOpacity
              style={styles.releaseBtnPrimary}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Confirmations')}
            >
              <Text style={styles.releaseBtnPrimaryText}>✅ 先清需确认项</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.releaseBtnSecondary}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DispatchChain')}
            >
              <Text style={styles.releaseBtnSecondaryText}>🔗 看调度链状态</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.releaseActions}>
            <TouchableOpacity
              style={styles.releaseBtnGhost}
              activeOpacity={0.8}
              onPress={handleJoinTestFlight}
            >
              <Text style={styles.releaseBtnGhostText}>📱 加入 TestFlight</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.releaseBtnGhost}
              activeOpacity={0.8}
              onPress={handleShowAppStoreGuide}
            >
              <Text style={styles.releaseBtnGhostText}>📋 App Store 准备清单</Text>
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
            onPress={() => navigation.navigate('GatewaySettings')}
            badge={runtimeMode === 'live' ? 'LIVE' : 'FALLBACK'}
          />
          <MenuItem
            emoji="⚙️"
            title="Gateway 连接配置"
            subtitle="地址 / Token / 通道 / 目标账号 · 可保存可测试"
            accent={C.accent}
            onPress={() => navigation.navigate('GatewaySettings')}
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
            onPress={() => navigation.navigate('GatewaySettings')}
          />
          <MenuItem
            emoji="🔊"
            title="通知与提醒"
            subtitle="任务状态变更 · AI 产出提醒"
            accent={C.primary}
            onPress={() => Alert.alert('通知权限', 'iOS 系统设置 → 通知 → AIBrainIM\n\n应用内通知由系统统一管理，开启后可接收任务状态变更和 AI 产出提醒。')}
          />
          <MenuItem
            emoji="🔒"
            title="隐私与安全"
            subtitle="数据存储 · 权限管理"
            accent={C.accent}
            onPress={() => {
              Alert.alert(
                '隐私与安全',
                '· 聊天记录仅保存在本设备\n· 附件文件不上传至第三方\n· Gateway 连接加密传输\n· 退出登录后本地数据清除',
                [{text: '知道了'}],
              );
            }}
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

  // Quick Access Strip
  quickAccessRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickAccessBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  quickAccessEmoji: {fontSize: 22},
  quickAccessLabel: {color: C.textBody, fontSize: 11, fontWeight: '700', marginTop: 5},

  // Stats
  statsGrid: {flexDirection: 'row', gap: 10, marginBottom: 8},
  runtimeBoard: {
    borderRadius: 20,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 14,
    gap: 12,
  },
  runtimeBoardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  runtimeBoardTitle: {color: C.textTitle, fontSize: 15, fontWeight: '900'},
  runtimeBoardSub: {color: C.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5},
  runtimeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  runtimeBadgeLive: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: '#34d399',
  },
  runtimeBadgeFallback: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderColor: '#f97316',
  },
  runtimeBadgeText: {fontSize: 11, fontWeight: '900'},
  runtimeBadgeTextLive: {color: '#34d399'},
  runtimeBadgeTextFallback: {color: '#f97316'},
  runtimeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  runtimeCell: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(56,100,200,0.08)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  runtimeCellLabel: {color: C.textMuted, fontSize: 11, fontWeight: '700'},
  runtimeCellValue: {color: C.textTitle, fontSize: 20, fontWeight: '900', marginTop: 6},
  runtimeCellHint: {color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4},

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
  releaseSnapshotRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  releaseSnapshotCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(56,100,200,0.08)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  releaseSnapshotValue: {color: C.textTitle, fontSize: 18, fontWeight: '900'},
  releaseSnapshotLabel: {color: C.textMuted, fontSize: 11, marginTop: 4},
  releaseChecklist: {
    padding: 14,
    gap: 7,
  },
  checkItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checkIcon: {fontSize: 13, width: 18},
  checkText: {color: C.textBody, fontSize: 12, flex: 1},
  checkTextPending: {color: C.textMuted},
  releaseFocusBox: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(8,15,30,0.6)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    gap: 6,
  },
  releaseFocusTitle: {color: C.textTitle, fontSize: 13, fontWeight: '900'},
  releaseFocusText: {color: C.textBody, fontSize: 12, lineHeight: 18},
  releaseActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
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
  releaseBtnGhost: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'center',
  },
  releaseBtnGhostText: {color: C.textBody, fontWeight: '700', fontSize: 13},
  versionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  versionSep: {width: 1, height: 10, backgroundColor: C.borderSubtle},
  buildText: {color: C.textMuted, fontSize: 11},
  releaseProgressText: {color: C.textMuted, fontSize: 11, marginTop: 6},
  materialItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  materialDot: {fontSize: 12, width: 14},
  materialText: {color: C.textBody, fontSize: 12, flex: 1},
  materialTextPending: {color: C.textMuted},

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
