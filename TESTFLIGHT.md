# TestFlight / App Store 上线指南

> 本文档为 AIBrainIM Alpha 提测准备清单，跟随 App Store Connect 流程同步更新。

---

## 当前状态

**判定：待收口**（2026-05-07）

主功能闭环已贯通，剩余工作主要是 Apple 开发者账号配置与提测物料准备。

---

## 一、运行态收口检查清单

| 状态 | 检查项 | 说明 |
|------|--------|------|
| ✅ | React Native 主工程 + iOS 构建 | 已验证 |
| ✅ | 五主功能（总览/对话/智能体/任务/我的） | 已贯通 |
| ✅ | 记忆库 / 知识库 / 附件入口 / 调度链 | 已贯通 |
| ✅ | GitHub Actions + Fastlane TestFlight 链路 | 预置待配 |
| ⏳ | 至少完成一轮 LIVE 网关闭环验证 | Gateway 连通性待验证 |
| ⏳ | 需确认项清零或压到可解释范围 | 3 条 pending |
| ⏳ | 阻塞任务收口到可提测状态 | 视实际任务数 |
| 🔲 | Apple 物料（Icon / 截图 / App Store Connect） | 待开始 |

---

## 二、Apple 开发者链路（约 2–4 小时）

### 2.1 前置条件
- Apple Developer 账号（$99/年）：https://developer.apple.com
- App Store Connect 访问权限

### 2.2 App Store Connect 配置

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. **我的 App → + 新建 App**
   - 平台：iOS
   - 名称：**钨矿AI大脑**（或 AIBrainIM）
   - 主要语言：**简体中文**
   - 套装 ID（Bundle ID）：`com.openclaw.aibrainim`
   - SKU：`AIBrainIM-Alpha`
3. 填写**价格与定价**（选免费）
4. 填写**隐私信息**（无特殊数据）
5. 填写**年龄分级**（4+）

### 2.3 必要物料

| 物料 | 规格 | 状态 |
|------|------|------|
| App Icon | 1024×1024 PNG（App Store 用） | 🔲 待准备 |
| iPhone 截图 6.7" | 1290×2796 px | 🔲 待准备 |
| iPhone 截图 6.5" | 1284×2778 px | 🔲 待准备 |
| iPhone 截图 5.5" | 1242×2208 px | 🔲 待准备 |
| 宣传文本 | 最多 170 字 | 🔲 待准备 |
| 描述文本 | 最多 4000 字 | 🔲 待准备 |
| 关键词 | 最多 100 字符 | 🔲 待准备 |

> **截图替代方案**：先用 Simulator 生成截图，Xcode → Device → Capture Screen Snapshot

### 2.4 提交流程

```bash
# 1. 确保所有代码已 commit 并打 tag
git tag v0.1.0-alpha
git push origin main --tags

# 2. GitHub Actions 自动触发构建
#    - xcodebuild archive
#    - Fastlane upload to TestFlight

# 3. App Store Connect 中：
#    TestFlight → 构建版本 → 添加测试人员 → 发送邀请
```

---

## 三、GitHub Actions + Fastlane 配置

### 3.1 需要的 Secrets（在 GitHub repo Settings → Secrets）

| Secret | 值 |
|--------|----|
| `FASTLANE_USER` | Apple ID（邮箱） |
| `FASTLANE_PASSWORD` | Apple ID 专用密码 |
| `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` | App 专用密码 |
| `MATCH_PASSWORD` | GitHub Actions SSH 密钥 |

### 3.2 Fastlane 配置（已预置）

- `ios/Fastfile`：定义了 `alpha` lane
- `ios/Matchfile`：定义了 App Store Connect 证书获取方式
- `ios/Gymfile`：定义了 archive + export 配置

### 3.3 触发构建

```bash
# 本地验证 Fastlane
cd ios && bundle exec fastlane alpha

# 或通过 GitHub Actions
git tag v0.1.0 && git push --tags
```

---

## 四、TestFlight 公开链接获取

1. App Store Connect → **TestFlight** → **测试信息**
2. 启用**公开链接**（Beta 版 App）
3. 生成链接：`https://testflight.apple.com/join/XXXXXXXX`
4. 将链接加入飞书或微信分享给测试人员

---

## 五、注意事项

### 5.1 Bundle ID 冲突
如果 `com.openclaw.aibrainim` 已被占用，改为：
`com.openclaw.aibrainim.alpha`

### 5.2 TestFlight 构建超时
GitHub Actions 构建超时（60min）时，检查：
- Xcode 版本与 Actions 镜像兼容性
- CocoaPods 依赖下载是否超时

### 5.3 首次上传
首次上传需要 Apple 人工审核（约 1–2 天），之后每次更新通常在 30–60 分钟内通过。

---

## 六、版本节奏建议

| 版本 | 内容 | 目标 |
|------|------|------|
| v0.1.0-alpha | 五主功能 P1 可用版，提 TestFlight | 2026-05 |
| v0.2.0 | 真实 API 闭环、Live Mode 稳定 | 待定 |
| v1.0.0 | App Store 正式版 | 待定 |

---

*本文件随上线进度同步更新。*
