# Deploy · AIBrainIM

## CI/CD Overview

```
Push to main           → GitHub Actions: TypeScript + iOS Simulator Build
                        → Status: https://github.com/explore3363-coder/AIBrainIM/actions

Tag v*.*.* → main     → GitHub Actions: Release Archive + Upload to TestFlight
                        → App Store Connect → TestFlight (auto)
                        → GitHub Release created
```

**Automation files:**
- `.github/workflows/ci.yml`        — GitHub Actions CI (TypeScript + Simulator Build)
- `.github/workflows/testflight.yml` — GitHub Actions TestFlight Upload
- `ios/fastlane/Fastfile`           — Fastlane lanes: `sim`, `tf`, `appstore`, `test`
- `ios/fastlane/Appfile`            — Bundle ID + team config
- `ios/fastlane/Gemfile`            — Ruby gem dependencies (bundler)

**Local commands:**
```bash
npm run typecheck          # TypeScript compile check
npm run build:sim          # iOS Simulator build (no signing)
npm test                   # Jest
npm run validate:testflight  # Apple CI inputs preflight

cd ios/fastlane
bundle install
bundle exec fastlane sim        # Simulator build via Fastlane
bundle exec fastlane tf         # TestFlight build + upload (requires API key)
bundle exec fastlane appstore   # App Store submission
```

---

## iOS · TestFlight / App Store

> 运行态收口与提测判断，请同时参考 [APP_STORE_READINESS.md](./APP_STORE_READINESS.md)。


### Prerequisites

1. **Apple Developer Account** with paid membership (≈ $99/year)
2. **Xcode 15+** installed
3. **Node.js 22+** and **npm/pnpm**
4. Bundle ID: `com.openclaw.aibrainim`

### Step 1 · App Store Connect Setup (one-time)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → My Apps → **+** → New App
2. Fill in:
   - Platform: iOS
   - Name: AI协作平台（代码仓 / Target 名仍为 AIBrainIM）
   - Primary Language: Chinese (Simplified, zh-Hans)
   - Bundle ID: `com.openclaw.aibrainim`
   - SKU: `aibrainim-001`
3. Note your **App Apple ID** (visible in URL after creation)

### Step 2 · App Store Connect API Key (recommended)

1. App Store Connect → Users & Access → Keys → **+**
2. Create an App Store Connect API Key with "App Manager" role
3. Download the `.p8` key file (only available at creation time!)
4. Add as GitHub Variables / Secrets:
   - `APPLE_API_KEY_ID` — the key ID shown in App Store Connect (对应 testflight.yml 中 `env.ASC_KEY_ID`)
   - `APPLE_API_ISSUER_ID` — the Issuer ID shown in App Store Connect → Users & Access → Keys (对应 testflight.yml 中 `env.ASC_ISSUER_ID`)
   - `APPLE_API_KEY_CONTENT` — base64-encoded `.p8` content (GitHub Secret, 与 TESTFLIGHT.md 保持一致):
     ```bash
     base64 -i AuthKey_XXXXXX.p8 | tr -d '\n'
     ```
5. Add as GitHub Variables:
   - `APPLE_TEAM_ID` — your Apple Developer Team ID
   - `APPLE_DEV_EMAIL` — your Apple Developer email（文档 / 本地操作参考；当前 `testflight.yml` 不直接消费）
6. Optional local preflight before tagging:
   ```bash
   ASC_KEY_ID=... \
   ASC_ISSUER_ID=... \
   APPLE_TEAM_ID=... \
   APPLE_API_KEY_CONTENT=... \
   npm run validate:testflight
   ```

### Step 3 · First TestFlight Build

```bash
# Tag and push — GitHub Actions handles the rest
git tag v0.1.0
git push --tags origin main
```

Or trigger manually: GitHub → Actions → "TestFlight Release" → Run workflow.

Expected timeline:
- Build: ~5-10 min
- App Store Connect processing: ~5-30 min
- Then available in TestFlight → Builds

### Step 4 · Add Testers to TestFlight

1. App Store Connect → AIBrainIM → TestFlight tab
2. **Internal Testing**: Add your own Apple ID directly (immediate access)
3. **External Testing**: Create a group, add tester emails, submit for Apple review (~1 day)

---

## App Store Submission

When ready for production:

1. App Store Connect → **App Store** tab
2. Fill in all required metadata:
   - App name, subtitle, description
   - Keywords, support URL, marketing URL
   - Screenshots (6.7", 6.5", 5.5" — at minimum)
   - App icon (1024×1024 PNG, no alpha)
   - Privacy info (required)
   - Age rating questionnaire
3. Upload a **build** from TestFlight (same build must pass review)
4. Click "Add for Review"

Review typically takes 24-48 hours.

---

## Android · Google Play

TBD — not yet in scope.

---

## Notes

- Product Name: `AI协作平台`（代码仓 / Target 名：`AIBrainIM`）
- Bundle ID: `com.openclaw.aibrainim`
- Marketing Version: `0.1.0`
- Min iOS: **15.1** (iPhone 6s+)
- Architecture: arm64 (device) + x86_64 (simulator)
- React Native New Architecture: **enabled** (`RCTNewArchEnabled=true`)
- Third-party packages:
  - `@react-navigation/native` + `@react-navigation/bottom-tabs` + `@react-navigation/native-stack`
  - `react-native-safe-area-context`
  - `react-native-image-picker`
  - `react-native-document-picker`
