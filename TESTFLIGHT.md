# TestFlight / App Store 上线指南

> 本文档描述 AIBrainIM P1 可用版的上线路径。代码侧已全部收口，剩余工作为 Apple 侧配置。

---

## 当前状态（2026-05-09 更新）

| 检查项 | 状态 |
|--------|------|
| TypeScript 零错误 | ✅ |
| Jest 138 tests 全部通过 | ✅ |
| iOS Simulator Build | ✅ |
| 五主功能（总览/对话/智能体/任务/我的）| ✅ |
| 信息层五入口（记忆/知识/附件/项目/调度链）| ✅ |
| 上传服务（分片/直传/断点续传/后台队列）| ✅ |
| App Icon 1024×1024 PNG | ✅ |
| App Store 三尺寸截图（6.7"/6.5"/5.5"）| ✅ |
| 五 Tab 全覆盖（总览/对话/智能体/任务/我的）| ✅ |
| 隐私政策 GitHub Pages 部署 | ✅ |
| App Store listing 文案 | ✅ |
| GitHub Actions CI | ✅ |
| GitHub Actions TestFlight workflow | ✅ |
| Tag 触发规则与文档一致 (`v*.*.*`) | ✅ |
| Apple Developer 账号配置 | 🔲 待配置 |
| GitHub Secrets & Variables | 🔲 待配置（已改为标准化 Variables/Secrets 驱动，不再在 workflow 写死 Apple 标识） |
| App Store Connect App 记录 | 🔲 待创建 |
| 第一个 TestFlight Build | 🔲 待触发 |

---

## 一、Apple Developer 账号配置

### 1.1 需要的材料

| 项目 | 说明 |
|------|------|
| Apple Developer 账号 | $99/年，apple developer.apple.com |
| App Store Connect 访问权限 | 用同一 Apple ID 登录 appstoreconnect.apple.com |
| App Store Connect API Key | 用于 GitHub Actions 自动导出与上传 |

### 1.2 在 GitHub Repo 设置 Secrets 和 Variables

前往：
- Variables: `https://github.com/explore3363-coder/AIBrainIM/settings/variables/actions`
- Secrets: `https://github.com/explore3363-coder/AIBrainIM/settings/secrets/actions`

#### GitHub Variables（Settings → Variables → Actions）

| Variable 名称 | 值 | 说明 |
|---------------|-----|------|
| `APPLE_API_KEY_ID` | 你在 App Store Connect 创建的 API Key ID | 对应 workflow 的 `ASC_KEY_ID` |
| `APPLE_API_ISSUER_ID` | 你在 App Store Connect 的 Issuer ID | 对应 workflow 的 `ASC_ISSUER_ID` |
| `APPLE_TEAM_ID` | 你自己的 Team ID | 用于签名与导出 |
| `APPLE_DEV_EMAIL` | 你的 Apple ID 邮箱 | 仅供文档 / 本地操作参考，当前 `testflight.yml` 不直接消费 |

#### GitHub Secrets（Settings → Secrets → Actions）

| Secret 名称 | 获取方式 |
|-------------|---------|
| `APPLE_API_KEY_CONTENT` | App Store Connect API 密钥的 `.p8` 文件内容 Base64 编码 |

> 当前 GitHub Actions `testflight.yml` 只依赖 App Store Connect API Key + GitHub Variables，不再消费 `APPLE_DIST_P12` 或 `APPLE_APP_PASSWORD`。

### 1.3 创建 App Store Connect API 密钥

1. 登录 [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Users and Access**
2. **Keys** → **+** 创建新密钥：
   - 名称：`AIBrainIM CI`
   - 角色：**App Manager**
3. 下载 `.p8` 文件（只出现一次，请妥善保存）
4. 将 Key ID 填入 GitHub Variable `APPLE_API_KEY_ID`
5. 将 Issuer ID 填入 GitHub Variable `APPLE_API_ISSUER_ID`
6. Base64 编码并添加为 GitHub Secret `APPLE_API_KEY_CONTENT`：
   ```bash
   base64 -i ~/Downloads/AuthKey_XXXXXX.p8 | tr -d '\n'
   ```

---

## 二、签名与证书说明（按当前 workflow）

当前 `testflight.yml` 走的是这条链路：

1. `xcodebuild archive` 先生成归档
2. `xcodebuild -exportArchive` 时通过 App Store Connect API Key + `-allowProvisioningUpdates` 让 Apple 侧自动处理签名与导出
3. 最后再上传到 App Store Connect

这意味着**当前自动化链路不要求你把 `.p12` 和 app-specific password 塞进 GitHub Secrets**。真正必须补齐的是：

- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`
- `APPLE_TEAM_ID`
- `APPLE_API_KEY_CONTENT`
- App Store Connect 中已存在对应 App 记录

如果后面改回 Fastlane 或手工签名模式，再单独补 `APPLE_DIST_P12 / APPLE_APP_PASSWORD` 这套即可；但那不是现在这条主线的阻塞项。

---

## 三、App Store Connect 配置

### 3.1 创建 App 记录

1. 登录 [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **我的 App** → **+** → **新建 App**
3. 填写：

| 字段 | 值 |
|------|-----|
| 平台 | iOS |
| 名称 | AI协作平台 |
| 主要语言 | 简体中文 |
| 套装 ID | `com.openclaw.aibrainim` |
| SKU | `AIBrainIM-Alpha` |
| 完整访问 | 需要 |

### 3.2 上传截图

在 **App Store Connect → 你的 App → iOS App** 中：

| 位置 | 要求 | 文件 |
|------|------|------|
| iPhone 6.7 英寸（1290×2796） | 1-10 张 | `build/AppStoreScreenshots/0_Dashboard_67.png` 等 |
| iPhone 6.5 英寸（1284×2778） | 1-10 张 | `build/AppStoreScreenshots/*_65.png` |
| iPhone 5.5 英寸（1242×2208） | 1-10 张 | `build/AppStoreScreenshots/*_55.png` |

**五 Tab 截图全套（各尺寸）：**
- `0_Dashboard_67.png` / `_65.png` / `_55.png` — 总览
- `1_Chat_67.png` / `_65.png` / `_55.png` — 对话
- `2_Agent_67.png` / `_65.png` / `_55.png` — 智能体
- `3_Tasks_67.png` / `_65.png` / `_55.png` — 任务
- `4_Profile_67.png` / `_65.png` / `_55.png` — 我的

可直接从 `build/AppStoreScreenshots/` 目录上传。

### 3.3 填写 App 信息

| 字段 | 内容 |
|------|------|
| 副标题 | 智能任务中枢，随时在线 |
| 宣传文本 | 参见 `APPSTORE_LISTING.md` |
| 描述 | 参见 `APPSTORE_LISTING.md` |
| 关键词 | AI, 协作, 任务管理, 效率, 智能助手 |
| 隐私政策 URL | `https://explore3363-coder.github.io/AIBrainIM/privacy.html` |
| 类别 | 效率 |
| 年龄分级 | 4+ |

---

## 四、触发第一个 TestFlight Build

### 4.0 发起前核对清单

在运行 `npm run trigger:testflight` 之前，确认以下配置已完成。不要手工绕过安全脚本直接执行 `git tag v0.1.0 && git push --tags origin main`：

> 变量名说明：对外统一按 GitHub Variables / Secrets 配置 `APPLE_API_KEY_ID`、`APPLE_API_ISSUER_ID`、`APPLE_TEAM_ID`、`APPLE_API_KEY_CONTENT`。CI workflow 内部会把前两项映射到 `ASC_KEY_ID` / `ASC_ISSUER_ID`，本地预检脚本 `npm run validate:testflight` 也同时兼容两组名字，避免变量别名导致假失败。
>
> 一致性说明：打 tag 前再跑一次 `npm run validate:release-config`，它会校验 Bundle ID 是否在 Xcode / fastlane / README / 上线文档中保持一致，并确认 workflow 上传阶段使用的仍是 `ASC_KEY_ID`，避免 CI 上传时因配置漂移失败。
>
> 资产真值说明：再跑一次 `npm run validate:assets`，它会直接核验 App Icon、三尺寸截图和隐私页产物是否真实存在且尺寸正确，避免“文档说齐了，但目录里文件缺失或尺寸漂移”。

| 检查项 | 验证方式 |
|--------|---------|
| GitHub Secret `APPLE_API_KEY_CONTENT` | Settings → Secrets → Actions → 存在且非空 |
| GitHub Variable `APPLE_TEAM_ID` | Settings → Variables → Actions → 存在且非占位符 |
| GitHub Variables `APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID` | Settings → Variables → Actions → 已存在且为你自己的值 |
| GitHub Variable `APPLE_DEV_EMAIL` | 可选校验项；建议补上，当前 workflow 不直接消费 |
| App Store Connect App 记录存在 | appstoreconnect.apple.com → 我的 App → 能看到 AI协作平台 |
| App Icon / 截图 / 隐私页产物真实存在 | `npm run validate:assets` 通过 |

**如果以上任何一项未完成就打 tag**，GitHub Actions 构建会失败。

### 4.1 建议触发顺序

```bash
cd ~/.tungsten_codex/AIBrainIM
npm run preflight:testflight
npm run trigger:testflight
```

`npm run preflight:testflight` 会顺序执行：
1. `npm run typecheck`
2. `npm run test:release`
3. `npm run validate:testflight`
4. `npm run validate:release-config`
5. `npm run validate:assets`
6. `npm run sync:release-status`

第 6 步会把本地预检真值同步到 `src/data/releaseStatus.generated.ts`，让移动端在没有额外运行态注入时，也能直接读到最近一次 Apple / 素材校验结论，而不是永远停留在默认未配置文案。随后 `npm run trigger:testflight` 会先复跑 `preflight:testflight` 刷新当前真值，再运行 `validate:trigger-readiness`；只有 Apple 前置、素材、72 小时内 PASS 总预检都闭合且首个 Build 尚未上传时，才继续执行 `git tag v0.1.0 && git push origin main --tags`。

GitHub Actions 将自动：
1. 安装依赖（npm ci + pod install）
2. 校验 Apple API Key / Team ID / Issuer ID / 私钥内容是否齐全且格式基本正确
3. 校验 Bundle ID / workflow / 文档 / npm 预检脚本一致性
4. 校验 App Icon / 截图 / 隐私页等 App Store 资产真值
5. xcodebuild archive
6. xcodebuild exportArchive（携带 API Key 自动处理导出签名）
7. altool 上传到 App Store Connect

### 4.2 监控构建

前往 `https://github.com/explore3363-coder/AIBrainIM/actions` 查看构建进度。

首次上传后约 5-30 分钟可在 App Store Connect 看到构建版本。

### 4.3 添加测试人员

App Store Connect → **TestFlight** → **测试信息**：
- 启用**公开链接**生成可分享的 TestFlight 邀请链接

---

## 五、常见问题

### Q: 为什么现在不再把 `APPLE_DIST_P12 / APPLE_APP_PASSWORD` 当成首要前置项？
**A**: 因为当前仓库的 `testflight.yml` 已切到 App Store Connect API Key 驱动的自动签名 / 导出链路。现阶段真正要补的是 `APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT`。只有后续明确切回 Fastlane 手工签名链路时，才需要重新启用 `APPLE_DIST_P12 / APPLE_APP_PASSWORD`。

### Q: altool 上传失败怎么办？
**A**: 先核对 API Key、Issuer ID、Team ID、App Store Connect App 记录是否一致；也先运行一次 `npm run validate:testflight`，确认 `APPLE_API_KEY_ID / APPLE_API_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT`（或其 `ASC_*` 别名）不是空值、不是占位符、`.p8` 结构有效；然后再跑 `npm run validate:release-config`，确认 Bundle ID 和 workflow 上传参数没有漂移；最后跑 `npm run validate:assets`，确认 App Icon、三尺寸截图和隐私页产物都是真实可用文件。当前 workflow 不是走 Apple ID + app-specific password 这条旧链路。

### Q: 首次上传需要人工审核？
**A**: App Store Connect 首次发布需要人工审核（约 1-2 天）。TestFlight 上传通常自动通过，不需要人工审。

### Q: Bundle ID 冲突
**A**: 优先在 Apple Developer / App Store Connect 检查 `com.openclaw.aibrainim` 是否已被当前团队占用。如果确实冲突，再改为 `com.openclaw.aibrainim.alpha`，并同步修改 Xcode target、`app.json`、相关文档与 CI 配置，避免只改文档不改工程。

---

## 六、版本节奏

| 版本 | 内容 | 目标 |
|------|------|------|
| v0.1.0 | 五主功能 P1 可用版，提 TestFlight | 2026-05 |
| v0.1.1 | 修提测反馈 | 待定 |
| v0.2.0 | 真实 API 闭环、Live Mode 稳定 | 待定 |

---

*本文档跟随上线进度同步更新。*
