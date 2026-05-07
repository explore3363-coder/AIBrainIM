# AIBrainIM TestFlight / App Store 上线准备清单

> 更新：2026-05-07

## 当前定位
- React Native 0.85.2 为主工程（唯一主线，不再做 HTML 体验稿）
- 五主功能固定：总览、对话、智能体、任务、我的
- 产品定位：AI 大脑驾驶舱，不做通用 IM
- 对话上下文不做产品层硬限制，交给后端长上下文+分层记忆

## P1 可用版状态

### ✅ 已完成
- [x] 总览页展示 AI 产出流、调度状态、需确认项
- [x] 对话页（会话持久化 + 附件上传 + 调度状态卡）
- [x] 智能体页（Agent 状态总览 + 详情 + 关联任务/调度）
- [x] 任务页（全局 Kanban：running/todo/done/blocked）
- [x] 我的页（信息层入口 + Gateway 状态 + 上线准备）
- [x] 记忆库（本地写入/远程同步/编辑/补写/category filter）
- [x] 知识库（矿业/工程/技术/政策四类 + wiki 全文查询 + 收录记忆）
- [x] 附件库（历史文件 + 上传队列合并 + 无大小限制）
- [x] 调度链（receive → dispatch → feedback → synthesis → deliver 五阶段）
- [x] 需确认项（pending/confirmed/deferred 状态流转）
- [x] 附件上传：分片/直传/断点续传/指数退避/后台队列/结果回流
- [x] AppContext 全局状态管理（agents/tasks/dispatches/uploads/confirmations）
- [x] Gateway 配置页（URL/Token/通道/账号配置 + 连通性测试）
- [x] CI/CD：GitHub Actions TypeScript + iOS Simulator Build
- [x] Fastlane：sim / tf / appstore lanes
- [x] npm test 通过（5 suites, 51 tests，测试输出无 console.warn 泄漏）
- [x] npm run typecheck 通过
- [x] Demo 模式双入口（Profile 页 + Dashboard Fallback Banner 注入按钮）
- [x] PrivacyInfo.xcprivacy 已配置（NSPrivacyAccessedAPI + NSPrivacyTracking=false）
- [x] LaunchScreen 已配置（LaunchBackgroundColor，#050d1a 背景）
- [x] App Icon 1024×1024 已就位（AppIcon-1024.png）
- [x] 上线文档完整（APPSTORE_LISTING.md / TESTFLIGHT.md / RELEASE_CHECKLIST.md / PRIVACY.md / DEPLOY.md）
- [x] Dashboard Fallback Banner 始终可见，含 Demo 注入按钮

### ⬜ 待完成（Apple 侧 — 需人工处理）
- [ ] Apple Developer 账号 + Team ID 配置
- [ ] App Store Connect 创建 App 记录（Bundle ID: com.openclaw.aibrainim）
- [ ] 隐私清单（PrivacyInfo.xcprivacy）
- [ ] Launch Screen 配置
- [ ] 权限文案（相册/相机如后续启用）
- [ ] 第一个 TestFlight Build 上传 + 验证可安装
- [ ] iPhone 截图（6.7" / 6.5" / 5.5"）
- [ ] App Store 填写内容（描述/关键词/隐私政策/支持链接）

### ⬜ 待完成（非阻塞，可并行）
- [ ] 真实 Gateway API 接入（协议映射层已就位）
- [ ] 消息发送 + 调度状态真实闭环验证
- [ ] memory/knowledge 真实向量检索接入

## Bridge / Backend 对接
- [x] `/agents` — `fetchAgents()` API 已就绪，mock 回退
- [x] `/tasks` — `fetchTasks()` API 已就绪，mock 回退
- [x] `/chat` — `sendMessage()` 已实现，返回 reply + taskId + dispatchId
- [x] `/upload` — uploadService 分片/直传/断点续传架构已就绪
- [ ] memory/knowledge 真实检索接口
- [ ] dispatch 状态真实回流（当前轻量轮询，真实链路下阶段接 webhook）

## iOS 发布准备
- [x] Bundle ID: `com.openclaw.aibrainim`
- [x] App 名称: AI协作平台
- [x] App Icon: 1024×1024 PNG 已备（需确认最终版）
- [ ] Launch Screen
- [ ] 隐私清单（PrivacyInfo.xcprivacy）
- [ ] 权限文案（相册、相机如后续启用）
- [x] Release 配置可编译
- [ ] Archive + TestFlight 验证
- [ ] TestFlight 内测文案

## App Store 素材
- [ ] 6.7-inch 截图（1290×2796）
- [ ] 6.5-inch 截图（1284×2778）
- [ ] 5.5-inch 截图（1242×2208）
- [x] App Icon 1024×1024 ✅
- [ ] 应用描述（中文）
- [ ] 关键词
- [x] 隐私政策（PRIVACY.md）
- [ ] 支持链接

## TestFlight 提交流程

```bash
# 1. 本地验证 Simulator build
npm run build:sim

# 2. Tag 发布（触发 GitHub Actions tf-build）
git tag v0.1.0 && git push origin v0.1.0

# 3. GitHub Actions 自动触发 tf-build job
# 或本地执行：
cd ios/fastlane && bundle exec fastlane tf

# 4. App Store Connect 等待处理（约 5-30 分钟）
# → TestFlight → Builds → 添加测试信息 → 外部测试
```

## 近期建议顺序
```
1. 配置 Apple Developer 账号 + App Store Connect App 记录
2. 验证 Simulator Build 成功（npm run build:sim）
3. 打 tag → GitHub Actions 自动 TestFlight 上传
4. 验证 TestFlight 可安装
5. 准备 App Store 截图，提审
```
