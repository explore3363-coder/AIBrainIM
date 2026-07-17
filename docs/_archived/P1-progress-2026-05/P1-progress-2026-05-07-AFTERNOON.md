# AIBrainIM P1 进展记录（2026-05-07 下午）

## 本轮第二部分完成（本轮第二笔 commit）

### 9. 导航类型安全补齐（ConfirmationsScreen / DispatchChainScreen / UploadScreen）

本轮 session 开始时发现三个屏幕存在 `(navigation as any)` 类型cast和 `typeof useRoute === 'function'` defensive pattern，但类型安全不完整。

改造内容：
- `ConfirmationsScreen`：将 `useNavigation` 升级为 `NativeStackNavigationProp<RootStackParamList>`，移除 4 处 `(navigation as any)` cast；将 `useRoute` 防御式调用升级为 `RouteProp<RootStackParamList, 'Confirmations'>` 正确类型，同时保留测试环境兼容的 guard
- `DispatchChainScreen`：将 `useNavigation<NativeStackNavigationProp<any>>` 升级为 `NativeStackNavigationProp<RootStackParamList>`，将 `useRoute` 防御式调用升级为 `RouteProp<RootStackParamList, 'DispatchChain'>` 正确类型
- `UploadScreen`：将 `useRoute` 防御式调用升级为 `RouteProp<RootStackParamList, 'Upload'>` 正确类型，同时保留测试环境兼容的 guard

关键文件：
- `src/screens/ConfirmationsScreen.tsx`：导航类型升级 + 4× `as any` 移除
- `src/screens/DispatchChainScreen.tsx`：导航类型升级
- `src/screens/UploadScreen.tsx`：route 类型升级

验证通过：
- `npm run typecheck` ✅ 通过
- `npm test -- --runInBand` ✅ 5 suites, 55 tests 全部通过
- iOS Simulator build ✅ BUILD SUCCEEDED

---

## 本轮第一部分完成（第一笔 commit）

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

### 3. 需确认项闭环增强：确认/延后结果真正回流
之前“需确认项”虽然支持 pending / confirmed / deferred 状态切换，但用户点完后更像本地 UI 状态变化，闭环感不够强。

本轮改造：
- `ConfirmationItem` 新增 `resolvedAt / followUpTaskId / followUpDispatchId`，把人工决策和后续任务链正式挂上关系
- `confirmItem()` 现在在更新状态的同时，会把 follow-up task / dispatch id 写回确认项本身
- `deferItem()` 同样会保留延后动作对应的 follow-up task / dispatch id，确保“延后”不是静默消失，而是明确进入待后续处理状态
- `ConfirmationsScreen` 新增「闭环回流」信息块，可直接看到该确认动作已经生成的任务号、调度号和处理时间

关键文件：
- `src/types/index.ts`
- `src/context/AppContext.tsx`
- `src/screens/ConfirmationsScreen.tsx`
- `__tests__/AppContext.confirm.test.tsx`

### 4. UploadScreen 运行时态一致性补全
UploadScreen 之前对 runtimeMode 完全无感知，用户在非 LIVE 模式下上传文件时得不到任何提示，不知道这些上传可能无法完成后续 AI 处理闭环。

本轮改造：
- UploadScreen 引入 `useAppContext`，获取 `runtimeMode / runtimeError / gatewayConfigValid`
- 新增运行时态 Banner：当 `runtimeMode !== 'live'` 时显示橙色提示框，包含模式说明、配置状态提示，以及「去配置」导航按钮
- 与 DashboardScreen / TaskScreen / ProfileScreen 的运行时态提示保持同一口径

关键文件：
- `src/screens/UploadScreen.tsx`：新增 `runtimeBanner` 样式、fallback 条件渲染、导航跳转

### 5. 上传 → 调度链 backlink：dispatchId 双向追溯
上传进入 `dispatched` 状态后，UploadScreen 之前没有路径追溯到对应的调度单，用户无法从上传结果跳转回调度链看后续处理。

本轮改造：
- `UploadFile` 接口新增 `dispatchId?: string` 字段（已有类型的自然延伸，不改任何核心结构）
- `uploadService` 新增 `updateFileDispatchId(fileId, dispatchId)` 公开方法，并加入 namespace 导出
- AppContext 在检测到文件从 processing → dispatched 状态跃迁时，主动调用 `uploadService.updateFileDispatchId(file.id, dispatchId)` 建立双向 link
- UploadScreen 已完成列表中，已分派的文件（`dispatched`）底部显示「🔗 查看调度单 {dispatchId 截断}」链接，点击跳转到 DispatchChainScreen

关键文件：
- `src/services/uploadService.ts`：`UploadFile.dispatchId` 字段 + `updateFileDispatchId` 方法 + namespace
- `src/context/AppContext.tsx`：状态跃迁处注入 backlink
- `src/screens/UploadScreen.tsx`：dispatchId 链路追溯 UI

### 6. 验证通过
- `npm run typecheck` ✅ 通过
- `npm test -- --runInBand` ✅ 5 suites, 54 tests 全部通过
- 确认链路测试已覆盖 `followUpTaskId / followUpDispatchId / resolvedAt`
- 测试输出中不再有 `console.warn` 泄漏

### 7. 需确认项重新打开能力补齐
之前一条确认项一旦被标记为 deferred，就只能停留在“已延后”状态；虽然链路没有丢，但用户无法把它明确重新放回待确认队列，人工决策闭环少了一步“重新打开”。

本轮改造：
- `ConfirmationItem` 新增 `reopenedAt / reopenCount`，记录这条确认项被重新打开的时间与次数
- `AppContext` 新增 `reopenItem()`：可将 deferred 项重新恢复为 pending，并生成新的 follow-up dispatch，保留链路连续性
- `ConfirmationsScreen` 对 deferred 项新增「重新打开」操作，同时保留「现在确认」按钮，不再把延后状态当作终局
- 重新打开后，对应任务会回到 `blocked / 待再次拍板` 状态，调度链里也会新增一条“重新打开确认”的记录
- 补充单测覆盖 reopen 场景，确保 deferred → pending → fresh dispatch 这条链路可重复验证

关键文件：
- `src/types/index.ts`
- `src/context/AppContext.tsx`
- `src/screens/ConfirmationsScreen.tsx`
- `__tests__/AppContext.confirm.test.tsx`

### 8. 验证更新
- `npm run typecheck` ✅ 通过
- `npm test -- --runInBand` ✅ 5 suites, 55 tests 全部通过
- 新增 reopenItem 测试通过

## 当前 P1 可用版状态总览

### 代码侧 ✅ 基本收口
- [x] React Native 主工程（唯一主线）
- [x] 五主功能（总览/对话/智能体/任务/我的）全部贯通
- [x] 记忆库 / 知识库 / 附件入口 / 调度链
- [x] 附件上传（分片/直传/断点续传/指数退避/后台队列）
- [x] 需确认项状态流转（pending/confirmed/deferred）
- [x] 需确认项 → follow-up task / dispatch 回流可见化
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
- [x] 导航类型安全（ConfirmationsScreen / DispatchChainScreen / UploadScreen）

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
