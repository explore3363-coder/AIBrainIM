# AIBrainIM TestFlight / App Store 上线准备清单

## 当前定位
- React Native 0.85.2 为主工程（唯一主线，不再做 HTML 体验稿）
- 五主功能固定：总览、对话、智能体、任务、我的
- 产品定位：AI 大脑驾驶舱，不做通用 IM
- 对话上下文不做产品层硬限制，交给后端长上下文+分层记忆

## P1 可用版状态

### ✅ 已完成
- [x] 总览页展示 AI 产出流、调度状态、需确认项
- [x] 对话页（API + mock 回退，调度单语义，taskId/dispatchId 追踪）
- [x] 智能体页（真实 agent 状态，8 个 Agent 视图）
- [x] 任务页（Kanban，合并上传链路与原始任务）
- [x] 我的页（四个信息层入口：记忆库/知识库/附件库/项目库）
- [x] 需确认项支持 pending/confirmed/deferred 状态流转
- [x] 附件上传：无前端大小限制，分片上传（≥10MB / 2MB片），断点续传，指数退避重试，后台处理队列，done 收口
- [x] 记忆库/知识库/附件库/项目库/调度链入口全通
- [x] AppContext 全局状态管理，dispatch 链路注册与追踪
- [x] CI/CD：GitHub Actions TypeScript + iOS Simulator Build
- [x] Fastlane：sim / tf / appstore lanes

### ⬜ 待完成
- [ ] Launch Screen（启动屏）
- [ ] 隐私清单（PrivacyInfo.xcprivacy）
- [ ] 权限文案（相册/文件/相机）
- [ ] Archive 成功验证
- [ ] TestFlight 提交并验证
- [ ] App Store 截图（6.7" / 6.5" / 5.5"）

## Bridge / Backend 对接
- [x] `/agents` — `fetchAgents()` API 已就绪，mock 回退
- [x] `/tasks` — `fetchTasks()` API 已就绪，mock 回退
- [x] `/chat` — `sendMessage()` 已实现，返回 reply + taskId + dispatchId
- [x] `/upload` — uploadService 分片/直传架构已就绪
- [ ] memory / knowledge / files 真实读取接口
- [ ] dispatch 状态真实回流（当前轻量轮询，真实链路下阶段接 webhook）

## iOS 发布准备
- [x] Bundle ID: `com.openclaw.aibrainim`
- [x] App 名称: AI 大脑（app.json displayName）
- [x] App Icon: AppIcon.appiconset（需替换 1024x1024 PNG）
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
- [ ] 应用描述（中文）
- [ ] 关键词
- [ ] 隐私政策链接
- [ ] 支持链接
- [ ] 营销文案

## TestFlight 提交流程

```bash
# 1. 本地验证 Simulator build
npm run build:sim

# 2. Tag 发布
git tag v0.1.0 && git push origin v0.1.0

# 3. GitHub Actions 自动触发 tf-build job
# 或本地执行：
cd ios/fastlane && bundle exec fastlane tf

# 4. App Store Connect 等待处理（约 5-30 分钟）
# → TestFlight → Builds → 添加测试信息 → 外部测试
```

## 近期建议顺序
1. 先验证 Simulator Build 成功
2. 配置 App Store Connect API Key（GitHub Secrets）
3. 打 tag → GitHub Actions 自动 TestFlight 上传
4. 验证 TestFlight 可安装
5. 接真实 Agent / Task / Chat / Memory / Knowledge 接口
6. 准备 App Store 截图，提审
