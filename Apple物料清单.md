# Apple App Store 物料清单
> AIBrainIM | 更新日期：2026-05-30

---

## 基础信息

| 项目 | 值 |
|------|-----|
| App名称 | AIBrainIM |
| Bundle ID | org.reactjs.native.example.AIBrainIM |
| SKU | AIBRAINIM001 |
| 平台 | iOS |
| 主要语言 | 简体中文 |
| 价格 | 免费 |

---

## 年龄分级

**App Store分级：4+**

> 原因：轻微年龄调侃内容，无暴力/色情/粗话

---

## 关键词（50字符内，逗号分隔）

```
AI助手,矿业大脑,智能调度,协作平台,OpenClaw,钨矿,工作流,任务管理,多Agent
```

验证：AI助手(4) + 矿业大脑(4) + 智能调度(4) + 协作平台(4) + OpenClaw(7) + 钨矿(2) + 工作流(3) + 任务管理(4) + 多Agent(5) = 37字符 ✅

---

## 应用描述

### 中文（300字符内）

```
AIBrainIM 是您的随身AI矿业大脑。基于OpenClaw多Agent系统，支持智能调度、任务管理、消息协作。专为矿业从业者打造的移动端AI助手，让现场与后台无缝协同。

【核心功能】
• 智能调度：6大专业Agent协同，钨矿、选矿、工程全覆盖
• 任务管理：实时追踪任务状态，调度结果即时推送
• 消息协作：多Agent并行响应，复杂问题分阶段解答
• 本地优先：消息本地处理，数据完全由您掌控

适用场景：矿山现场管理 / 选矿工艺咨询 / 矿业政策查询 / 项目进度追踪
```

### 英文（300字符内）

```
AIBrainIM is your pocket AI mining brain. Powered by OpenClaw multi-Agent system with intelligent dispatch, task management and messaging collaboration. Designed for mining professionals to seamlessly connect field operations with backend AI.

[Core Features]
• Intelligent Dispatch: 6 specialized Agents working together, covering tungsten mining, ore processing, and engineering
• Task Management: Real-time task tracking with instant push notifications
• Messaging Collaboration: Multi-Agent parallel response for complex questions
• Privacy-First: Messages processed locally, data fully under your control

Use Cases: Mine site management / Mineral processing consulting / Mining policy research / Project progress tracking
```

---

## 支持链接

| 类型 | 链接 |
|------|------|
| 支持网址 | https://github.com/your-org/AIBrainIM |
| 隐私政策 | https://your-domain.com/privacy.html（需替换为真实地址） |

---

## 隐私政策URL（需可访问HTTPS）

**当前状态：需部署后填写**

预计部署地址：待确认

> ⚠️ App Store审核要求隐私政策URL必须为有效的HTTPS地址，不可访问会导致审核被拒

---

## 屏幕截图要求

| 尺寸 | 设备 | 数量 |
|------|------|------|
| 6.7" | iPhone 14 Pro Max / 15 Pro Max / 16 Pro Max | 1张 |
| 6.5" | iPhone 14 Plus / 15 Plus / 16 Plus | 1张 |
| 5.5" | iPhone 8 Plus / 7 Plus / 6s Plus | 1张 |

> 当前已有截图需更新为最新UI界面，建议使用Xcode截图功能获取标准尺寸

---

## GitHub Secrets 配置清单

| Secret名称 | 值 | 状态 |
|-----------|-----|------|
| APPLE_API_KEY_ID | HWP45ALL8Y | ⚠️ 需人工确认 |
| APPLE_API_ISSUER_ID | 0bc52ef9-a4c4-489e-810c-c8a80db0ab9a | ⚠️ 需人工确认 |
| APPLE_TEAM_ID | 1165010090（洪杨账户） | ⚠️ 需人工确认 |
| APPLE_API_KEY_CONTENT | .p8文件内容 | ❌ 缺失，需重新生成 |

> 🔴 APPLE_API_KEY_CONTENT 缺失是最大阻塞项，必须重新生成并配置

---

## TestFlight 配置状态

| 项目 | 状态 | 说明 |
|------|------|------|
| App Store Connect App记录 | ⚠️ 需人工创建/确认 | 访问 appstoreconnect.apple.com |
| TestFlight内部测试组 | ⏳ 待创建 | 需配置内部测试人员 |
| GitHub Actions CI/CD | ⚠️ 需配置Secrets | 需配置Apple API Key |

---

## App Store Connect 必做清单

**人工操作（无法自动化）：**

1. 登录 https://appstoreconnect.apple.com（洪杨账户）
2. 创建App记录：
   - 平台：iOS
   - 名称：AIBrainIM
   - 套装ID：org.reactjs.native.example.AIBrainIM
   - SKU：AIBRAINIM001
   - 最高分级：4+
3. 隐私政策URL：等privacy.html部署到HTTPS后填写
4. 上传截图（6.7"/6.5"/5.5"各一套）
5. 确认GitHub仓库 Secrets 配置完整

**GitHub仓库 Secrets（github.com/your-org/AIBrainIM → Settings → Secrets）：**
- `APPLE_API_KEY_ID` = HWP45ALL8Y
- `APPLE_API_ISSUER_ID` = 0bc52ef9-a4c4-489e-810c-c8a80db0ab9a
- `APPLE_TEAM_ID` = 1165010090
- `APPLE_API_KEY_CONTENT` = （.p8文件内容，**必须重新生成**）

---

## TestFlight 下载失败问题排查

根据历史记录，TestFlight下载失败可能原因：
1. 您的Apple账户未加入到测试组
2. 构建版本未完成处理（Apple服务器延迟）
3. 测试链接已过期

**排查步骤：**
1. 确认收到TestFlight邀请邮件并点击"接受"
2. 在App Store里搜索"TestFlight"，确认已安装
3. 尝试用TestFlight内部链接重新安装
4. 检查邮箱中的过期提醒

---

*本清单由 zhuli 协调，zhilian 执行于 2026-05-30*
