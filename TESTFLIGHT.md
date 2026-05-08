# TestFlight / App Store 上线指南

> 本文档描述 AIBrainIM P1 可用版的上线路径。代码侧已全部收口，剩余工作为 Apple 侧配置。

---

## 当前状态（2026-05-08 更新）

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
| Apple Developer 账号配置 | 🔲 待配置 |
| GitHub Secrets & Variables | 🔲 待配置 |
| App Store Connect App 记录 | 🔲 待创建 |
| 第一个 TestFlight Build | 🔲 待触发 |

---

## 一、Apple Developer 账号配置

### 1.1 需要的材料

| 项目 | 说明 |
|------|------|
| Apple Developer 账号 | $99/年，apple developer.apple.com |
| App Store Connect 访问权限 | 用同一 Apple ID 登录 appstoreconnect.apple.com |
| macOS Keychain Access | 用于导出签名证书 |

### 1.2 在 GitHub Repo 设置 Secrets 和 Variables

前往 `https://github.com/explore3363-coder/AIBrainIM/settings/secrets`：

#### GitHub Variables（Settings → Variables → Actions）

| Variable 名称 | 值 | 说明 |
|---------------|-----|------|
| `APPLE_TEAM_ID` | `7S96N8A32U` | 你的 Apple Team ID（开发者账号页面可见） |
| `APPLE_DEV_EMAIL` | 你的 Apple ID 邮箱 | 用于 altool 上传认证 |

#### GitHub Secrets（Settings → Secrets → Actions）

| Secret 名称 | 获取方式 |
|-------------|---------|
| `APPLE_DIST_P12` | 签名证书的 Base64 编码（见下方步骤） |
| `APPLE_APP_PASSWORD` | Apple ID → 安全 → 专用密码（见下方步骤） |
| `APPLE_API_KEY_CONTENT` | App Store Connect API 密钥的 .p8 文件内容 Base64 编码（见下方 1.3 节） |

> ⚠️ `ASC_KEY_ID` 和 `ASC_ISSUER_ID` 已在 testflight.yml 中硬编码（不是 Secret，是 App Store Connect API 密钥的公开标识符）。如需更换，请同步修改 workflow 文件中的 `env.ASC_KEY_ID` 和 `env.ASC_ISSUER_ID`。

### 1.3 创建 App Store Connect API 密钥（用于自动创建 Provisioning Profile）

1. 登录 [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Users and Access**
2. **Keys** → **+** 创建新密钥：
   - 名称：`AIBrainIM CI`
   - 角色：**App Manager**（需要能创建 provisioning profile）
3. 下载 `.p8` 文件（只出现一次，请妥善保存）
4. 将 Key ID（`HWP45ALL8Y`）和 Issuer ID（`0bc52ef9-a4c4-489e-810c-c8a80db0ab9a`）同步到 testflight.yml 中的 `env.ASC_KEY_ID` 和 `env.ASC_ISSUER_ID`
5. Base64 编码并添加为 GitHub Secret `APPLE_API_KEY_CONTENT`：
   ```bash
   base64 -i ~/Downloads/AuthKey_HWP45ALL8Y.p8 | tr -d '\n'
   ```
   将输出结果添加到 GitHub Secret `APPLE_API_KEY_CONTENT`

---

## 二、生成 APPLE_DIST_P12（签名证书）

### 2.1 在 Mac 上生成签名请求

1. 打开 **Keychain Access** → **证书助理** → **从证书颁发机构请求证书**
2. 填写：
   - 邮箱：你的 Apple Developer 账号邮箱
   - 常用名称：`AIBrainIM Distribution`
   - 存储到磁盘：✅
3. 保存为 `certificate_signing_request.certSigningRequest`

### 2.2 在 Apple Developer Portal 创建证书

1. 登录 [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**
2. **Certificates** → **+** → **iOS Distribution (App Store and Ad Hoc)**
3. 上传 2.1 生成的 `.certSigningRequest` 文件
4. 下载生成的证书（双击自动导入 Keychain）

### 2.3 导出 p12 并编码

在 Mac 上运行：

```bash
# 1. 确认证书名称（Keychain Access 搜索 "AIBrainIM" 或 "Distribution"）
security find-identity -v -p codesigning | grep -i distribution

# 2. 导出 p12（替换 "iPhone Distribution: 你的名字" 为实际证书名）
security export -k ~/Library/Keychains/login.keychain-db \
  -t cert -s "iPhone Distribution: 你的名字 (TEAM_ID)" \
  -P "ci-pass" \
  -o ~/Desktop/certificate.p12

# 3. 转为 Base64（在 Mac Terminal 运行）
base64 -i ~/Desktop/certificate.p12 | tr -d '\n'
```

> **注意**：导出 p12 时设置的密码必须为 `ci-pass`（workflow 硬编码）。  
> 如果之前已在 Keychain 中有 "Hong Yang" 的分发证书，可直接用 `security find-identity` 找到并导出。

### 2.4 创建 APPLE_APP_PASSWORD

1. 登录 [appleid.apple.com](https://appleid.apple.com) → **登录和安全**
2. **专用密码** → **+** 生成一个新密码
3. 命名填写 `GitHub Actions AIBrainIM`
4. 复制生成的密码，填入 GitHub Secret `APPLE_APP_PASSWORD`

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

可直接从 `build/AppStoreScreenshots/` 目录上传（每尺寸上传对应 5 张 Tab 截图）。

### 3.3 填写 App 信息

| 字段 | 内容 |
|------|------|
| 副标题 | 智能任务中枢，随时在线 |
| 宣传文本 | 参见 `APPSTORE_LISTING.md` |
| 描述 | 参见 `APPSTORE_LISTING.md` |
| 关键词 | AI, 协作, 任务管理, 效率, 智能助手（参见 `APPSTORE_LISTING.md`） |
| 隐私政策 URL | `https://explore3363-coder.github.io/AIBrainIM/privacy.html` |
| 类别 | 效率 |
| 年龄分级 | 4+ |

---

## 四、触发第一个 TestFlight Build

### 4.1 一行命令触发

```bash
cd ~/.tungsten_codex/AIBrainIM
git tag v0.1.0 && git push --tags origin main
```

GitHub Actions 将自动：
1. 安装依赖（npm ci + pod install）
2. 导入签名证书（APPLE_DIST_P12）
3. xcodebuild archive
4. altool 上传到 App Store Connect
5. 创建 GitHub Release

### 4.2 监控构建

前往 `https://github.com/explore3363-coder/AIBrainIM/actions` 查看构建进度。

首次上传后约 5-30 分钟可在 App Store Connect 看到构建版本。

### 4.3 添加测试人员

App Store Connect → **TestFlight** → **测试信息**：
- 启用**公开链接**生成可分享的 TestFlight 邀请链接

---

## 五、常见问题

### Q: `APPLE_DIST_P12` 解码失败
**A**: 确认 base64 没有换行符，执行 `cat ~/Desktop/certificate.p12 | base64 | tr -d '\n'` 确保单行输出。

### Q: altool 认证失败 (401 Invalid Username/Password)
**A**: 使用 APPLE_APP_PASSWORD（专用密码），不是 Apple ID 登录密码。

### Q: 首次上传需要人工审核？
**A**: App Store Connect 首次发布需要人工审核（约 1-2 天）。TestFlight 上传通常自动通过，不需要人工审。

### Q: Bundle ID 冲突
**A**: 改为 `com.openclaw.aibrainim.alpha`，同步修改 `ios/AIBrainIM/Info.plist` 和 `app.json`。

---

## 六、版本节奏

| 版本 | 内容 | 目标 |
|------|------|------|
| v0.1.0 | 五主功能 P1 可用版，提 TestFlight | 2026-05 |
| v0.2.0 | 真实 API 闭环、Live Mode 稳定 | 待定 |
| v1.0.0 | App Store 正式版 | 待定 |

---

*本文档跟随上线进度同步更新。*
