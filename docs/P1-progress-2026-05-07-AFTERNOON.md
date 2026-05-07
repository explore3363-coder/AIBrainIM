# AIBrainIM P1 进展记录（2026-05-07 下午）

## 本轮完成

### 1. Dashboard Fallback Banner 增强：注入 Demo 按钮
之前 Fallback Banner 只提供跳转到 Gateway Settings 的入口，用户在没有真实 Gateway 时无法快速体验完整闭环。

本轮改造：
- Fallback Banner 始终在 runtimeMode === 'fallback' 时显示（不再只在 dispatches === 0 时）
- 新增「注入 Demo」按钮：点击后调用 `injectDemoData()` + `enqueueDemoUpload(0)` + `enqueueDemoUpload(2)`，向 AppContext 注入 3 条模拟调度 + 2 个演示附件（图片 + 视频）
- 新增「配置」按钮：保留跳转到 Gateway Settings
- 两种状态文案：dispatches 为空时提示"先体验完整闭环"，有缓存数据时提示"来自本地缓存"

关键文件：
- `src/screens/DashboardScreen.tsx`：Fallback Banner UI 改造 + `demoInjectBtn`/`demoSettingsBtn` 样式

### 2. 测试输出清理：移除 console.warn
`src/data/api.ts` 中有两处 `console.warn` 在测试时会泄漏到 Jest 输出，影响测试可读性：
- `fetchRuntimeSnapshot` 失败时的 fallback warn → 已移除（fallback 是预期行为，不需要 warn）
- `sendMessage` 失败时的 warn → 已移除（错误已被捕获并返回失败 reply，warn 是冗余信息）

关键文件：
- `src/data/api.ts`：移除 2 处 console.warn 调用

### 3. 验证通过
- `npm run typecheck` ✅ 通过
- `npm test` ✅ 5 suites, 51 tests 全部通过
- 测试输出中不再有 `console.warn` 泄漏

## 当前 P1 可用版状态总览

### 代码侧 ✅ 基本收口
- [x] React Native 主工程（唯一主线）
- [x] 五主功能（总览/对话/智能体/任务/我的）全部贯通
- [x] 记忆库 / 知识库 / 附件入口 / 调度链
- [x] 附件上传（分片/直传/断点续传/指数退避/后台队列）
- [x] 需确认项状态流转（pending/confirmed/deferred）
- [x] ChatScreen typing indicator bug fix
- [x] ProfileScreen 实时 context 统计
- [x] TaskScreen / DispatchChainScreen 下拉刷新
- [x] Demo 模式注入（Profile + Dashboard 双入口）
- [x] 上线文档（APPSTORE_LISTING.md / TESTFLIGHT.md / RELEASE_CHECKLIST.md）
- [x] PrivacyInfo.xcprivacy 已配置
- [x] App Icon 1024×1024 已就位
- [x] LaunchScreen（LaunchBackgroundColor）已配置
- [x] 协议映射层（sessions → agents/tasks/dispatches）已就绪
- [x] 测试输出清理（无 console.warn 泄漏）

### Apple 侧 ⏳ 待处理
- [ ] Apple Developer 账号 + Team ID 配置
- [ ] App Store Connect 创建 App 记录（Bundle ID: com.openclaw.aibrainim）
- [ ] 截图（6.7" / 6.5" / 5.5"）
- [ ] 第一个 TestFlight Build 验证

### 运行态验证 ⏳ 待真实闭环
- [ ] Gateway 连通性真实验证（一轮 LIVE 消息发送 + 调度状态回流）
- [ ] 需确认项清零或压到可解释范围

## 还差什么

### 阻塞项
1. **Apple Developer 账号配置**（无法绕过，需人工处理）
2. **App Store Connect 创建 App 记录**（同上）
3. **截图**（可以用 Simulator capture 替代，但需人工操作）

### 非阻塞项（可并行推进）
1. 真实 Gateway API 接入（协议映射层已就绪，但还需真实环境验证）
2. 需确认项收口（3 条 pending，需人工拍板）
3. 真实上传闭环验证

## 下一步

**第一优先级**：Apple 侧配置
1. 登录 App Store Connect，创建 App（Bundle ID: com.openclaw.aibrainim）
2. 填写隐私信息、年龄分级（4+）
3. 用 Simulator capture 生成截图（iPhone 6.7" / 6.5" / 5.5"）
4. `git tag v0.1.0 && git push --tags` 触发 GitHub Actions TestFlight 构建

**第二优先级**：运行态验证
1. 配置 Gateway URL + Token
2. 发送一条真实消息，确认调度状态回流到首页 AI 产出流
3. 上传一个附件，确认分派链路正常

**第三优先级**：上架物料
1. 截图完成后填入 App Store Connect
2. 填写宣传文本、描述、关键词
3. 提交审核
