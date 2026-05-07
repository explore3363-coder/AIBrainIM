# AIBrainIM TestFlight / App Store 上线准备清单

> 更新：2026-05-08

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
- [x] 对话上下文策略 Banner：实时显示消息条数 + 长上下文+分层记忆+按需回补说明
- [x] 上传页非空状态 Banner：明确标注「无大小限制·分片·断点续传·后台处理」
- [x] Chat/DispatchChain/Task/Upload 路由参数 TypeScript 严格化（?. 链式取值）
- [x] TypeScript check 通过 + 55 tests 全部通过
- [x] AppContext 全局状态管理（agents/tasks/dispatches/uploads/confirmations）
- [x] Gateway 配置页（URL/Token/通道/账号配置 + 连通性测试）
- [x] CI/CD：GitHub Actions TypeScript + iOS Simulator Build
- [x] Fastlane：sim / tf / appstore lanes
- [x] npm test 通过（3 suites, 9 tests，测试输出无 console.warn 泄漏）
- [x] npm run typecheck 通过
- [x] iOS Simulator Build ✅ 成功
- [x] 截图脚本就绪：`bash scripts/capture-screenshots.sh` → `build/AppStoreScreenshots/0_Dashboard_*.png`（1290×2796 / 1284×2778 / 1242×2208）
- [x] App Store 截图已生成（iOS 26.4 simctl io screenshot 语法）
- [x] Demo 模式双入口（Profile 页 + Dashboard Fallback Banner 注入按钮）
- [x] PrivacyInfo.xcprivacy 已配置
- [x] LaunchScreen 已配置（LaunchBackgroundColor，#050d1a 背景）
- [x] App Icon 1024×1024 已就位（AppIcon-1024.png）
- [x] fastlane metadata name.txt 已补全（zh-CN / en-US）
- [x] 上线文档完整（APPSTORE_LISTING.md / TESTFLIGHT.md / RELEASE_CHECKLIST.md / PRIVACY.md / DEPLOY.md）

### ⬜ 待完成（Apple 侧 — 需人工处理，是当前唯一阻塞）
**核心依赖：Apple Developer 账号 + GitHub Secrets 配置**

GitHub Secrets（Settings → Secrets and variables → Actions）需要配置：
- `APPLE_API_KEY_ID` — App Store Connect API Key ID
- `APPLE_API_KEY_CONTENT` — .p8 文件原始内容（base64 解码后的内容）
- `APPLE_APP_PASSWORD` — App 专用密码

GitHub Vars（Settings → Secrets and variables → Actions → Variables）需要配置：
- `APPLE_TEAM_ID` — Apple Team ID（如 DRBZA8XXXX）
- `APPLE_DEV_EMAIL` — Apple Developer 邮箱

待完成清单：
- [ ] Apple Developer 账号（$99/年） + Team ID 获取
- [ ] App Store Connect 创建 App 记录（Bundle ID: com.openclaw.aibrainim）
- [ ] 权限文案（相册/相机如后续启用）
- [ ] 第一个 TestFlight Build 上传 + 验证可安装
- [x] iPhone 截图已刷新（`bash scripts/capture-screenshots.sh` → `build/AppStoreScreenshots/0_Dashboard_67/65/55.png`）
- [ ] App Store 填写内容（描述/关键词/隐私政策/支持链接）

### ⬜ 待完成（非阻塞，可并行）
- [ ] 真实 Gateway API 接入（协议映射层已就绪）
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
- [x] App Icon: 1024×1024 PNG
- [x] PrivacyInfo.xcprivacy 已配置
- [x] Launch Screen 已配置
- [x] Release 配置可编译（xcodebuild archive 成功）
- [ ] Archive + TestFlight 验证

## App Store 素材
- [x] 6.7-inch 截图（1290×2796）→ `build/AppStoreScreenshots/0_Dashboard_67.png`
- [x] 6.5-inch 截图（1284×2778）→ `build/AppStoreScreenshots/0_Dashboard_65.png`
- [x] 5.5-inch 截图（1242×2208）→ `build/AppStoreScreenshots/0_Dashboard_55.png`
- [x] App Icon 1024×1024 ✅
- [ ] 应用描述（中文）
- [ ] 关键词
- [x] 隐私政策（PRIVACY.md）
- [ ] 支持链接

## TestFlight 提交流程

```bash
# 1. 配置 GitHub Secrets 后，打 tag 触发 GitHub Actions
git tag v0.1.0 && git push origin v0.1.0

# 2. GitHub Actions 自动构建并上传到 App Store Connect
# 等待处理（约 5-30 分钟）

# 3. App Store Connect → TestFlight → Builds → 添加测试信息
# → 外部测试 → 添加测试人员

# 本地备选：
cd ios/fastlane && bundle exec fastlane tf
```

## 近期建议顺序
```
1. Apple Developer 账号注册/登录
2. GitHub Secrets + Vars 配置（见上文）
3. 打 tag v0.1.0 → GitHub Actions 自动 TestFlight 上传
4. 验证 TestFlight 可安装
5. 准备 App Store 截图，提审
```
