# AIBrainIM P1 可用版 — 进展记录

> 最后更新：2026-05-07 09:15 GMT+8

---

## 当前状态：P1 可用版已收口 ✅

**代码冻结点**：本轮完成后核心产品代码基本稳定，下一步优先真实 API 接入 + Apple 侧物料。

---

## 已完成

### 1. React Native 主工程唯一化
- 已删除 HTML 体验稿，React Native 是唯一交付物
- iOS 构建：`npm run build:sim` / `npm run build:release`
- `npm run typecheck` ✅ `npm test` ✅（3 suites, 9 tests passing）

### 2. 五主功能骨架稳定
| Tab | 入口 | 状态 |
|-----|------|------|
| 总览 | DashboardScreen | ✅ AI 产出流 / 调度状态 / 需确认项 / 实时统计 |
| 对话 | ChatScreen | ✅ 会话持久化 / 附件上传 / 调度状态卡 |
| 智能体 | AgentScreen | ✅ Agent 状态总览 + 详情 + 关联任务/调度 |
| 任务 | TaskScreen | ✅ 全局 Kanban（running/todo/done/blocked）|
| 我的 | ProfileScreen | ✅ 信息层入口 / Gateway 状态 / 上线准备 |

### 3. 信息层五入口已串通
- **记忆库**（MemoryStoreScreen）：本地 + 远程写入/检索，category filter，支持编辑/补写
- **知识库**（KnowledgeBaseScreen）：矿业/工程/技术/政策四类，支持 wiki 全文查询（降级显示摘要）
- **附件库**（FileLibraryScreen）：历史文件 + 上传队列合并显示
- **调度链**（DispatchChainScreen）：receive → dispatch → feedback → synthesis → deliver 五阶段链路
- **项目库**（ProjectLibraryScreen）：AIBrainIM / 聚源三维 / Runtime 项目视图，叠加运行态任务、上传、调度、确认项形成实时项目面板

### 4. 首页已收窄为驾驶舱
- 删除所有开发者自嗨信息
- 重点展示：AI 产出流、调度状态、需确认项、记忆/知识/项目/附件入口
- TODAY FOCUS 面板：直接告诉用户现在最该盯哪条
- “项目库”入口已不再是空壳，可直接查看移动端闭环、调度接入与智能体负载投影

### 5. 对话上下文无产品层硬限制
- MAX_HISTORY = 300（纯存储考量，非产品截断）
- 思路：长上下文 + 分层记忆 + 按需回补
- ChatScreen 支持：发送、附件上下文携带、调度状态卡片、会话历史清空

### 6. 附件上传设计已落地
- `uploadService.ts`：分片上传（≥10MB）/ 直传（<10MB）/ 断点续传（chunk 级别 retry）/ 指数退避 + jitter
- 后台处理队列：Promise 非阻塞，不卡 UI
- 前端无大小限制（size=0/unknown 按大文件处理）
- 附件状态自动回流到 dispatch + task + 首页产出流

### 7. TestFlight / App Store 链路预置
- `TESTFLIGHT.md`：完整操作手册
- `APPSTORE_LISTING.md`：App Store Connect 填写内容
- `PRIVACY.md`：隐私政策
- `DEPLOY.md`：CI/CD 说明
- GitHub Actions：`git tag v*.*.*` → 自动 Archive + Upload to App Store Connect
- Bundle ID：`com.openclaw.aibrainim`

### 8. Gateway 配置页已就位
- `GatewaySettingsScreen`：URL / Token / 通道 / 目标账号配置
- 连通性测试（sessions_list）、测试消息发送
- App 不内置真实凭据，TestFlight / App Store 包默认空白配置

---

## 还差什么

### 阻塞项（需人工处理才能推进）
| 阻塞项 | 影响 | 状态 |
|--------|------|------|
| Apple Developer 账号 + Team ID | 无法配置证书、无法真机构建 | ⏳ 待配置 |
| App Store Connect App 记录 | 无法上传 Build | ⏳ 待创建 |
| 1024×1024 App Icon 最终版 | App Store Connect 必需 | ✅ 已备（需确认）|
| iPhone 截图（6.7" / 6.5" / 5.5"）| App Store Connect 必需 | ⏳ 待制作 |
| 隐私信息 / 年龄分级 | App Store Connect 必需 | ⏳ 待填写 |

### 非阻塞项（可并行处理）
| 事项 | 说明 |
|------|------|
| 真实 Gateway API 接入 | 当前为 mock + fallback，协议映射层已就位 |
| 消息发送真实闭环验证 | 需要真实 Gateway Token 在真机上跑一轮 |
| dispatch 视图真实字段映射 | 协议映射层还需压一层 |
| ProjectLibrary 数据源继续去 mock | 当前已接入运行态投影，后续可继续换成真实项目/文档源 |

---

## 下一步（最短路径）

```
1. Apple Developer 账号 → 创建 App Store Connect 记录
2. 配置证书 + 运行: git tag v0.1.0 && git push --tags
3. GitHub Actions 自动上传第一个 TestFlight Build
4. App Store Connect 添加测试人员
5. 真机验证 Gateway 真实闭环（对话 / 任务 / 调度状态回流）
```

---

## 目录结构

```
AIBrainIM/
├── src/
│   ├── App.tsx              # 导航 + 路由
│   ├── context/AppContext.tsx  # 全局状态（agents/tasks/dispatches/uploads/confirmations）
│   ├── data/
│   │   ├── api.ts          # Gateway API 调用 + 协议映射
│   │   └── mockData.ts      # 常量 + mock 数据
│   ├── services/
│   │   ├── uploadService.ts # 分片/直传/断点续传/队列
│   │   └── gatewayConfig.ts  # Gateway 配置读写
│   ├── screens/
│   │   ├── DashboardScreen   # 总览驾驶舱
│   │   ├── ChatScreen        # 对话 + 附件
│   │   ├── AgentScreen       # 智能体状态
│   │   ├── TaskScreen        # Kanban 任务
│   │   ├── ProfileScreen     # 我的 + Gateway + 上线
│   │   ├── MemoryStoreScreen # 记忆库
│   │   ├── KnowledgeBaseScreen # 知识库
│   │   ├── FileLibraryScreen  # 附件库
│   │   ├── DispatchChainScreen # 调度链
│   │   ├── ConfirmationsScreen # 需确认项
│   │   ├── UploadScreen      # 上传管理
│   │   └── GatewaySettingsScreen # Gateway 配置
│   └── components/
├── docs/
│   ├── P1-mobile-closed-loop.md  # 设计原则
│   ├── P1-PROGRESS.md           # 本文件
│   ├── RELEASE_CHECKLIST.md      # 上线检查清单
│   └── TESTFLIGHT.md            # TestFlight 操作手册
├── APP_STORE_READINESS.md
├── TESTFLIGHT.md
└── DEPLOY.md
```
