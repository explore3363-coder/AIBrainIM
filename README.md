# AIBrainIM

AI 大脑移动端 - React Native · iOS · OpenClaw Agent Runtime

---

## 状态

**P1 可用版** - 已贯通以下五个核心功能:

| 入口 | 状态 | 说明 |
|------|------|------|
| 总览 | ✅ | AI 驾驶舱:AI 产出流 / 调度状态 / 需确认项 / 记忆库入口 |
| 对话 | ✅ | AI 对话(会话历史持久化)+ 附件上传(分片/断点续传/后台队列)|
| 智能体 | ✅ | Agent 状态总览 + 详情页 |
| 任务 | ✅ | 全局 Kanban:对话指令 + 附件上传链路合并显示 |
| 我的 | ✅ | 信息层入口 + TestFlight/App Store 准备入口 |

**上线准备参考:** [APP_STORE_READINESS.md](./APP_STORE_READINESS.md)

---

## 当前状态（2026-05-07 夜）

P1 产品层已收口，iOS Simulator Build ✅ / TypeScript ✅ / Jest 70 tests ✅。

GitHub Actions CI 已就绪。唯一阻塞项为 Apple 侧配置（账号 + App Store Connect 记录 + 截图）。

---

## 快速开始

```bash
npm install
cd ios && pod install && cd ..
npm run ios        # 启动 Metro + 打开 iOS Simulator
npm run typecheck  # TypeScript 检查
npm test           # Jest
```

## 技术栈

- React Native **0.85.2**(New Architecture enabled)
- React Navigation **7**(Bottom Tabs + Native Stack)
- TypeScript
- iOS 15.1+
- `@react-native/new-app-screen` · `react-native-image-picker` · `react-native-document-picker` · `@react-native-async-storage/async-storage`

## CI/CD

```
main push        → GitHub Actions: TypeScript + iOS Simulator Build
v*.*.* tag push  → GitHub Actions: TestFlight Archive + Upload → App Store Connect
```

详见 [DEPLOY.md](./DEPLOY.md) 与 [APP_STORE_READINESS.md](./APP_STORE_READINESS.md)

## Gateway 连接配置

进入路径:**我的 → OpenClaw 状态** 或 **我的 → Gateway 连接配置**

可配置项:
- Gateway URL
- Gateway Token
- 消息通道(默认 `feishu`)
- 目标账号 / 会话

安全原则:
- App 不再内置真实 Gateway Token 或真实目标账号
- TestFlight / App Store 包默认只带空白配置,需要在"Gateway 连接配置"里手动填写
- 这样才能避免把生产凭据直接打进安装包

可执行动作:
- 测试 `sessions_list` 连通性
- 发送一条测试消息,验证真实调度链是否开始回流

这一步的目的很直接:让 AIBrainIM 在 TestFlight 环境下切换真实网关时,不需要重新打包改常量。

## App Store / TestFlight

Bundle ID: `com.openclaw.aibrainim`

当前产品对外命名:`AI协作平台`
代码仓与 iOS Target 保持:`AIBrainIM`

详见 [DEPLOY.md](./DEPLOY.md) → Section: iOS · TestFlight / App Store
