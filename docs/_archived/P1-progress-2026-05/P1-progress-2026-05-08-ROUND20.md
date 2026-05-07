# AIBrainIM P1 — 第二十轮（2026-05-08 凌晨·持续收口）

> 时间：2026-05-08 04:59（持续开发模式）

---

## 本轮完成

**工程状态：**
- TypeScript ✅ · Jest 10 suites / 82 tests ✅ · iOS Simulator Build ✅（BUILD SUCCEEDED）
- `npm run typecheck` 通过，`npm test` 82/82 通过
- Git clean，origin/main 已同步

**文档状态：**
- README.md 就绪（截图状态 · 五主功能 · 信息层五入口 · CI/CD 路径 · 上线最短路径）
- `RELEASE_CHECKLIST.md` 完整（✅ 完成项 42 项，⬜ 阻塞项全部为人工依赖项）
- `APPSTORE_LISTING.md` 就绪（App Store Connect 可直接复制使用的文案草稿）
- `TESTFLIGHT.md` 完整操作手册
- `DEPLOY.md` CI/CD 说明
- `PRIVACY.md` / `docs/privacy.html`（215 行，GitHub Pages 自动部署）
- GitHub Actions `pages.yml` → 推送 `docs/privacy.html` 自动部署到 GitHub Pages

**核心功能完整性确认：**
- 五主功能（总览/对话/智能体/任务/我的）全部可交互
- 信息层五入口（记忆库/知识库/附件库/调度链/项目库）全部就绪
- 调度链五阶段（receive → dispatch → feedback → synthesis → deliver）含 User-friendly 空状态提示
- ChatScreen：打字机动画 · 附件上下文携带 · 会话历史 MAX_HISTORY=300（无产品层硬截断）· 调度状态卡 · 长上下文提示 Banner
- uploadService：8 个 queueStage（queued→chunking→uploading→merging→processing→dispatched→done/error）· 分片 ≥10MB / 直传 <10MB / 断点续传 / 指数退避+jitter / 后台队列
- ProjectLibraryScreen：运行态项目投影（自动识别 AIBrainIM/聚源三维/Agent Runtime）
- GatewaySettingsScreen：连通性测试（sessions_list）· 直连会话测试
- 隐私 Info.plist 全覆盖（NSCamera / NSPhotoLibrary / NSMicrophone / NSLocationWhenInUse）· PrivacyInfo.xcprivacy 完整 · LaunchBackgroundColor #050d1a · AppIcon 1024 已配置

**CI/CD 清理：**
- `.github/workflows/ci.yml` 移除 129 行硬编码 Apple 团队凭证的重复 `tf-build` job
- `testflight.yml` 使用 GitHub Vars 方式（凭证不硬编码）
- 纯 CI：`main push` → TypeScript + iOS Simulator Build
- TestFlight/Release：`git tag v*.*.*` → 自动 Archive + Upload to App Store Connect

---

## 还差什么

**唯一阻塞（需人工处理）：**

| 阻塞项 | 影响 |
|--------|------|
| Apple Developer 账号 + Team ID | 无法配置证书、无法真机构建 |
| App Store Connect App 记录 | 无法上传 Build |
| GitHub Secrets：`APPLE_API_KEY_ID` / `APPLE_API_KEY_CONTENT` / `APPLE_APP_PASSWORD` | CI 自动上传失败 |
| GitHub Vars：`APPLE_TEAM_ID` / `APPLE_DEV_EMAIL` | CI 自动上传失败 |
| iPhone 截图（6.7" / 6.5" / 5.5"）| App Store Connect 必需（脚本已就绪）|

**非阻塞（可并行处理）：**
- 真实 Gateway API 接入（协议映射层已就绪）
- dispatch 视图真实字段映射
- memory/knowledge 真实向量检索

---

## 下一步（最短路径）

```
1. Apple Developer 账号注册/登录 → 获取 Team ID
2. GitHub Settings → Secrets: APPLE_API_KEY_ID / APPLE_API_KEY_CONTENT / APPLE_APP_PASSWORD
3. GitHub Settings → Variables: APPLE_TEAM_ID / APPLE_DEV_EMAIL
4. App Store Connect → 创建 App（Bundle ID: com.openclaw.aibrainim）
5. 截图：bash scripts/capture-screenshots.sh → 上传到 App Store Connect
6. git tag v0.1.0 && git push --tags
7. GitHub Actions 自动上传第一个 TestFlight Build
8. App Store Connect → TestFlight → 添加测试人员 → 真机验证
```

---

## 快速参考

- Bundle ID：`com.openclaw.aibrainim`
- 产品名：`AI协作平台`
- 隐私政策：https://explore3363-coder.github.io/AIBrainIM/privacy.html
- GitHub：https://github.com/explore3363-coder/AIBrainIM
- CI 脚本：`npm run build:sim`（本地 Simulator）/ `npm run build:release`（Archive）