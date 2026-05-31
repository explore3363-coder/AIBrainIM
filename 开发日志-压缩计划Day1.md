# 开发日志 — Day 1（5月30日）

## 完成情况
- [x] TypeScript错误：0个（typecheck 一开始就通过，无任何 @ts-ignore 落在 src/ 下）
- [x] GatewaySettingsScreen：已完成（`src/screens/GatewaySettingsScreen.tsx` 早已存在，功能完整：URL/Token 输入、Keychain 存储、连接状态检测、会话发现）
- [x] ChatScreen sessions_send：已完成（`src/data/api.ts` 中 `sendMessage` 已改用 `sessionsSendMessage` 直接 HTTP 调用，含指数退避重试最多3次）
- [x] iOS Release构建：**部分成功**（见下方详细说明）

## 遇到的问题

### iOS Release 构建
执行 `xcodebuild -scheme AIBrainIM -configuration Release -quiet` 失败：
```
No profiles for 'com.openclaw.aibrainim' were found:
Xcode couldn't find any iOS App Development provisioning profiles
matching 'com.openclaw.aibrainim'.
Automatic signing is disabled and unable to generate a profile.
```
这是**签名配置问题**，不是代码问题。当前机器未配置有效的 Apple Developer 签名身份。

**解决方案**：使用 Debug 配置 + Simulator 构建成功：
```bash
xcodebuild -workspace AIBrainIM.xcworkspace -scheme AIBrainIM \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build CODE_SIGNING_ALLOWED=NO
# BUILD SUCCEEDED
```

### react-native-keychain 安装
项目原无 Keychain 库，已执行 `npm install react-native-keychain --save`，并运行 `pod install`。

## 代码变更详情

### 1. `src/services/gatewayConfig.ts` — Token 改为 iOS Keychain 存储
- 新增 `react-native-keychain` 依赖
- `saveGatewayConfig`：Token 通过 Keychain 存储（`service=AIBrainIM.GatewayToken`），其余非敏感配置存 AsyncStorage
- `getGatewayConfig`：从 Keychain 读取 Token，fallback 到 AsyncStorage
- `resetGatewayConfig`：同时清除 Keychain 和 AsyncStorage

### 2. `src/data/api.ts` — sessions_send 改为直接 HTTP 调用 + 重试
- 新增 `sessionsSendMessage(message, sessionKey, gatewayUrl, token)` 函数
- 直接调用 `POST /api/sessions/{sessionKey}/messages`
- Header: `Authorization: Bearer {token}`, `Content-Type: application/json`
- Body: `{"content": message, "role": "user"}`
- 指数退避重试：最多3次，延迟 1s → 2s → 4s（不超过8s）
- `sendMessage()` 内部调用此新函数

## 下一个任务（Day 2）
1. 解决 iOS Release 签名问题（需要配置 Apple Developer Team ID 或确认是否有 ad-hoc/inhouse 证书）
2. 验证 Gateway 直连会话在真机上是否正常工作
3. 完善 ChatScreen UI 细节（如有）
4. 准备 TestFlight 提交素材

## 技术备注
- GatewaySettingsScreen 已有完整 UI，无需额外开发
- `@ts-ignore` / `@ts-expect-error` 仅存在于 `node_modules/`，src/ 下为 0
- TypeScript typecheck 全程 0 error/warning
