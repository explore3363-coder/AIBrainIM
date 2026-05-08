# AIBrainIM

AI 大脑移动端 — React Native · iOS · OpenClaw Agent Runtime

---

## 状态

**P1 可用版已收口**（2026-05-08）
- TypeScript ✅ · Jest 138 tests ✅ · iOS Simulator Build ✅
- 五主功能全部可交互（总览/对话/智能体/任务/我的）
- 信息层五入口就绪（记忆库/知识库/附件库/调度链/项目库）
- 上传服务 8 个 queueStage 完整（分片/断点续传/后台队列）
- GitHub Actions CI/CD 就绪
- Git: clean，origin/main 已同步
- 开发者工具已清除（控制台 tab 及相关屏幕已移除）

**唯一阻塞：** Apple Developer 账号 + App Store Connect 记录 + GitHub Secrets/Vars 配置

**上线准备参考：** [APP_STORE_READINESS.md](./APP_STORE_READINESS.md) · [DEPLOY.md](./DEPLOY.md)

---

## 五主功能

| Tab | 入口 | 状态 |
|-----|------|------|
| 总览 | DashboardScreen | ✅ AI 产出流 / 调度状态 / 需确认项 / TODAY FOCUS |
| 对话 | ChatScreen | ✅ 会话持久化 / 附件上传 / 调度状态卡 / typing indicator |
| 智能体 | AgentScreen | ✅ Agent 状态总览 + 详情 + 关联任务/调度 |
| 任务 | TaskScreen | ✅ 全局 Kanban（running/todo/done/blocked）|
| 我的 | ProfileScreen | ✅ 信息层入口 / Gateway 状态 / TestFlight 准备 |

---

## 信息层五入口

| 入口 | 说明 |
|------|------|
| 记忆库 | 本地 + 远程读写，category filter，记忆沉淀 |
| 知识库 | 矿业/工程/技术/政策四类，支持 wiki 全文查询 |
| 附件库 | 历史文件 + 上传队列合并显示 |
| 调度链 | receive → dispatch → feedback → synthesis → deliver |
| 项目库 | AIBrainIM / 聚源三维 / Agent Runtime 三链路运行态投影 |

---

## 快速开始

```bash
npm install
cd ios && pod install && cd ..
npm run ios        # 启动 Metro + 打开 iOS Simulator
npm run typecheck  # TypeScript 检查
npm test           # Jest
```

---

## 技术栈

- React Native **0.85.2**（New Architecture enabled）
- React Navigation **7**（Bottom Tabs + Native Stack）
- TypeScript + Jest
- iOS 15.1+
- `@react-native/new-app-screen` · `react-native-image-picker` · `react-native-document-picker` · `@react-native-async-storage/async-storage`

---

## CI/CD

```
main push        → GitHub Actions: TypeScript + iOS Simulator Build
v*.*.* tag push  → GitHub Actions: TestFlight Archive + Upload → App Store Connect
```

---

## Gateway 连接配置

进入路径：**我的 → OpenClaw 状态** 或 **我的 → Gateway 连接配置**

可配置项：
- Gateway URL / Token / 通道 / 目标账号
- 直连 OpenClaw session（默认）或 Feishu 回退

**安全原则：**
- App 不内置真实 Token，TestFlight / App Store 包默认空白配置
- 用户在 App 内手动填写真实 Gateway Token，避免凭据打入安装包

**可执行动作：**
- 发现可直连 session（自动过滤 agent: 会话）
- 测试 `sessions_list` 连通性
- 发送测试消息，验证真实调度链回流

---

## App Store / TestFlight

| 项目 | 值 |
|------|-----|
| Bundle ID | `com.openclaw.aibrainim` |
| 产品名称 | AI协作平台 |
| CI 自动上传 | `git tag v*.*.*` → GitHub Actions → App Store Connect |
| App Store 截图 | 已生成三尺寸（6.7" / 6.5" / 5.5"），脚本已就绪 |

---

## 上架最短路径

```
1. Apple Developer $99/年注册 → 获取 Team ID
2. GitHub Secrets: APPLE_DIST_P12 / APPLE_APP_PASSWORD
   GitHub Vars: APPLE_TEAM_ID / APPLE_DEV_EMAIL
3. 打 tag: git tag v0.1.0 && git push --tags
4. GitHub Actions 自动 Archive + Upload to App Store Connect
5. App Store Connect → TestFlight → 添加测试人员 → 真机验证
```