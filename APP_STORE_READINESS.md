# App Store / TestFlight Readiness

## 当前结论

**状态：待收口，可朝 TestFlight 提测推进。**

现在 React Native 主工程已经明确成为唯一主线，五个核心入口也已经落地成可操作界面：总览、对话、智能体、任务、我的。真正还差的，不是再做一版体验稿，而是把“运行态闭环”和“Apple 上线物料”收干净。

一句话说：**产品骨架已经有了，接下来要做的是把它变成能提测的产品，而不是继续堆演示层。**

补一句很关键的工程判断：**当前 TestFlight workflow 已按 App Store Connect API Key 自动签名 / 导出链路收口，不再建议把 `.p12 + APPLE_APP_PASSWORD` 当成主阻塞项。真正的外部阻塞仍然是 Apple Developer / App Store Connect / API Key / GitHub Variables & Secrets。**

---

## P1 已完成的可用闭环

### 1. 主工程路线已锁定
- React Native 是唯一主线
- 不再回头做 HTML 体验稿
- iOS 构建脚本、GitHub Actions、Fastlane 路径已存在

### 2. 五主功能已具备前台入口
- **总览**：AI 产出流 / 调度状态 / 需确认项 / 闭环摘要
- **对话**：消息发送、调度单生成、附件上下文一并进入调度链
- **智能体**：Agent 在线态与角色分工展示
- **任务**：Kanban 视图，区分执行中 / 待处理 / 已完成 / 需确认
- **我的**：信息层入口 + TestFlight / App Store 准备入口

### 3. 核心产品取向已对齐
- 首页重点展示 **AI 产出流、调度状态、需确认项**，不再塞无用户价值的“开发者自嗨信息”
- 对话上下文不做产品层硬限制，前端策略已按长上下文思路保留
- 文件上传不写死大小限制，前端采用 **直传 / 分片 / 断点续传 / 后台处理队列** 思路
- 记忆库、知识库、附件库、调度链都已变成实际入口，而不只是概念按钮

---

## 当前还差什么

### A. 提测前必须补掉的运行态缺口

#### 1. 至少完成一轮真实 LIVE 闭环验证
当前代码仍兼容 fallback 模式。TestFlight 前至少要确认一轮：
- 移动端发消息
- OpenClaw Gateway 实际接收
- 任务/调度状态真实回流
- 首页 AI 产出流能看到真实链路变化

**这一步没过，就不能算真正可提测。**

#### 2. 需确认项与阻塞任务要收口
P1 可以允许存在少量“待确认”入口，但不能让用户一打开就发现系统大面积卡在人工拍板。

提测前建议标准：
- `需确认项` 清到低位
- `blocked` 任务收口到可解释状态
- 至少保证首页看起来是“系统在工作”，不是“系统在等人救火”

#### 3. 上传闭环要做一次完整验证
需要确认：
- 图片 / 文档 / 视频 至少各过一条
- 大文件分片逻辑没有前端卡死
- 上传完成后进入后台处理队列
- 处理结果能继续回流到任务或 AI 产出流

---

## Apple 上线链路还缺的正式物料

### 1. Apple Developer / App Store Connect
需要确认并配置：
- Apple Developer 付费账号
- App Store Connect App 记录
- Bundle ID：`com.openclaw.aibrainim`
- Team ID / API Key / Issuer ID
- GitHub Variables / Secrets：`APPLE_API_KEY_ID`、`APPLE_API_ISSUER_ID`、`APPLE_TEAM_ID`、`APPLE_API_KEY_CONTENT`

> 说明：当前 workflow 已走 **App Store Connect API Key 自动签名 / 导出** 链路，首轮 TestFlight 不再以 `APPLE_DIST_P12 / APPLE_APP_PASSWORD` 为前置阻塞。只要 App Store Connect App 记录存在，且上述 Variables / Secret 齐全，就可以先触发 v0.1.0 提测。

> 说明：CI workflow 内部实际消费的是 `ASC_KEY_ID / ASC_ISSUER_ID / APPLE_TEAM_ID / APPLE_API_KEY_CONTENT`，其中前两项已经在 workflow `env` 里从 GitHub Variables 映射自 `APPLE_API_KEY_ID / APPLE_API_ISSUER_ID`。本地预检脚本 `npm run validate:testflight` 现同时兼容两组变量名，避免“文档写一套、脚本吃另一套”造成假失败。

### 2. 必备商店素材
当前代码与文档判断，这一块已经基本齐全：
- 1024 × 1024 App Icon
- iPhone 6.7" 截图
- iPhone 6.5" 截图
- 5.5" 截图
- 应用描述、关键词、副标题、支持链接、隐私说明

现在缺的不是“有没有素材”，而是把这些素材正式填进 App Store Connect，并完成一次提测前核对。

另外，TestFlight workflow 的 Apple 前置校验已经抽成独立脚本：`scripts/validate-testflight-inputs.sh`。这一步会校验 `APPLE_API_KEY_ID / ASC_KEY_ID`、`APPLE_API_ISSUER_ID / ASC_ISSUER_ID`、`APPLE_TEAM_ID`、`APPLE_API_KEY_CONTENT` 是否为空、是否仍是占位符，以及 `.p8` 内容结构是否有效，能提前拦住打 tag 后才失败的无效构建。

同时新增了发布配置一致性校验：`npm run validate:release-config`。它会交叉检查 `ios/AIBrainIM.xcodeproj/project.pbxproj`、`ios/fastlane/Appfile`、`README.md`、`APP_STORE_READINESS.md`、`TESTFLIGHT.md`、`APPSTORE_LISTING.md` 中的 Bundle ID 是否一致，并确认 TestFlight workflow 上传步骤实际使用 `ASC_KEY_ID`、workflow env 仍然正确映射 `APPLE_API_KEY_ID / APPLE_API_ISSUER_ID`，也会校验 `package.json` 已暴露预检脚本，避免“文档写对了、工程或 CI 仍漂移”的隐性提测失败。

现在又补了一层素材真值校验：`npm run validate:assets`。它会直接检查 1024×1024 App Icon 是否为真 PNG，并核验五个主 Tab 的 6.7" / 6.5" / 5.5" 截图尺寸，以及 `APPSTORE_LISTING.md`、`docs/privacy.html` 是否真实存在。这样可以把“文档说截图已完成，但产物目录缺文件/尺寸不对”的问题提前拦在打 tag 之前。

### 3. 提测与上架文本
建议统一对外产品名：
- **对外名称：AI协作平台**
- **代码仓 / Target 名：AIBrainIM**

这样能保证：
- 对用户的品牌表达统一
- 对工程、CI、iOS Target 不造成额外重命名扰动

---

## 提测前检查清单

### 运行态
- [ ] 移动端消息发送 → Gateway → 调度回流真实打通一轮
- [ ] 任务页至少有一条真实运行态样本
- [ ] 首页 AI 产出流出现真实回流内容
- [ ] 需确认项收口到可接受范围
- [ ] blocked 任务没有明显失控堆积
- [ ] 附件上传链路跑通至少一轮真实闭环

### 工程态
- [x] React Native 主工程存在
- [x] iOS 工程可构建
- [x] `npm run typecheck` 脚本存在
- [x] `npm run build:sim` 脚本存在
- [x] TestFlight GitHub Actions 路径存在
- [x] Tag 触发规则已对齐 `v*.*.*`
- [x] Fastlane lane 存在
- [x] 发布配置一致性校验已接入（`npm run validate:release-config`）
- [x] App Store 资产真值校验已接入（`npm run validate:assets`）
- [x] 关键提测测试集可一键复跑（`npm run test:release`）
- [ ] 首个 App Store Connect 自动签名 Archive / Export / Upload 真机链路验证

### Apple 物料
- [ ] Apple Developer 账号配置完成
- [ ] App Store Connect 新建 App 完成
- [ ] API Key / Team ID / GitHub Variables & Secrets 配齐（`APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID` / `APPLE_TEAM_ID` / `APPLE_API_KEY_CONTENT`；workflow 会映射到 `ASC_KEY_ID / ASC_ISSUER_ID`，可先用 `scripts/validate-testflight-inputs.sh` 做本地预检）
- [ ] 打 tag 前补跑 `npm run validate:release-config`，确认 Bundle ID / workflow / 文档没有漂移
- [x] App Icon 完成（2026-05-07 修复：原为 JPEG 伪装 PNG，已替换为真 PNG 153KB）
- [x] 截图已生成（6.7" / 6.5" / 5.5"）
- [ ] 隐私信息与年龄分级在 App Store Connect 中填写完成

---

## 建议的最短推进顺序

### 第一步：先补运行态闭环
优先做真实链路验证，而不是先做宣传物料。

顺序建议：
1. 消息真实发送闭环
2. 调度状态真实回流
3. 上传链路真实回流
4. 清掉高优先级确认项/阻塞项

### 第二步：再补 Apple 上线物料
当运行态闭环过关后，再集中补：
1. App Store Connect App 记录
2. App Store Connect 文案与年龄分级
3. API Key / Team / CI secrets
4. 把已生成的 Icon / 截图正式上传到 App Store Connect

### 第三步：触发 TestFlight
建议真正打 tag 前固定执行一条总预检：
```bash
npm run preflight:testflight
npm run trigger:testflight
```

这条会顺序执行：
1. `npm run typecheck`
2. `npm run test:release`
3. `npm run validate:testflight`
4. `npm run validate:release-config`
5. `npm run validate:assets`
6. `npm run sync:release-status`
7. 通过后执行 `npm run trigger:testflight`，脚本会先复跑 `preflight:testflight` 刷新当前真值，再由 `validate:trigger-readiness` 检查 Apple 前置、素材、72 小时内 PASS 总预检和“首个 Build 尚未上传”状态，全部闭合后才自动执行 `git tag v0.1.0 && git push origin main --tags`

第 6 步会把最近一次本地 Apple / 素材预检真值写入 `src/data/releaseStatus.generated.ts`，这样移动端“上线准备”卡片在没有额外 env 注入时，也能直接展示仓库预检结果，而不是一直停留在默认未配置状态。`trigger:testflight` 是最终安全触发入口，未闭合时只会失败并提示继续跑 `npm run preflight:testflight`，不会误打 tag。

建议版本节奏：
- `v0.1.0`：内部 TestFlight
- `v0.1.1`：修提测反馈
- `v0.2.0`：真实 API 替换 mock 的增强版

---

## 当前判断

**这项目现在不是“还没产品”，而是“已经有 P1 形态，差最后一段收口”。**

最重要的不是再加页面，而是把下面三件事做实：
1. **真实调度闭环**
2. **真实上传闭环**
3. **TestFlight 上线链路**

只要这三段收住，AIBrainIM 就可以从“开发中的移动端原型”，切到“可提测的 AI 协作平台”。
