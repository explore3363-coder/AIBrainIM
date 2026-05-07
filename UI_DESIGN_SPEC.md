# AI协作平台 UI 设计规范文档
**版本：v1.0 Raycast + Claude 混血设计语言**  
**日期：2026-05-07**  
**状态：设计稿等效 Figma，可供开发落地**

---

## 一、设计理念

**Raycast 的工具感 + Claude 的温暖卡片质感**

- 深色沉浸背景（#030810 最深）→ 工具感、沉浸感
- 毛玻璃半透明卡片 → 层次分明、轻盈不闷
- 蓝色作为唯一主强调色 → 视觉统一、有呼吸感
- Claude 的 Typography → 给足行高、文字有呼吸感
- 阴影用 rgba(0,0,0,0.3) 而不只是换背景色 → 卡片有"悬浮感"

---

## 二、颜色体系

### 背景层级（7层，由深到浅）

| 层级 | 色值 | 用途 |
|------|------|------|
| bgRoot | `#030810` | 页面最底层背景 |
| bgSurface | `#080e1a` | 页面背景 |
| bgCard | `rgba(14,24,42,0.72)` | 毛玻璃卡片背景 |
| bgElevated | `#0d1830` | 抬升元素（TabBar 等） |
| bgOverlay | `rgba(8,14,28,0.88)` | 弹窗/遮罩层 |
| bgGlass | `rgba(14,24,42,0.65)` | 毛玻璃效果 |
| bgTransparent | `transparent` | 无背景 |

### 边框

| 类型 | 色值 | 用途 |
|------|------|------|
| borderSubtle | `rgba(255,255,255,0.06)` | 卡片默认边框 |
| borderDefault | `rgba(255,255,255,0.10)` | 分割线/输入框边框 |
| borderActive | `rgba(56,189,248,0.5)` | 聚焦/激活态边框 |

### 强调色

| 色名 | 色值 | 用途 |
|------|------|------|
| primary | `#38bdf8` | 主蓝色（按钮/链接/强调） |
| primaryDark | `#0284c7` | 主蓝深色 |
| primaryGlow | `rgba(56,189,248,0.25)` | 光晕背景 |
| accent | `#22d3ee` | 青蓝点缀（次要强调） |

### 文字色

| 类型 | 色值 | 用途 |
|------|------|------|
| textPrimary | `#f1f5f9` | 标题/重要文字 |
| textSecondary | `#94a3b8` | 正文 |
| textMuted | `#475569` | 辅助/次要文字 |
| textDisabled | `#1e293b` | 禁用态文字 |

### 状态色

| 类型 | 色值 | 用途 |
|------|------|------|
| success | `#34d399` | 成功/完成 |
| warning | `#fbbf24` | 警告/注意 |
| error | `#f87171` | 错误/失败 |
| info | `#60a5fa` | 信息 |

### Agent 平台色（各自固定不变）

| Agent | 名称 | 色值 |
|-------|------|------|
| zhuli | 助理 | `#22d3ee` |
| renzhi | 认知中枢 | `#a78bfa` |
| xunlong | 寻龙 | `#fbbf24` |
| wuyin | 无垠 | `#34d399` |
| tansuo | 探索 | `#fb7185` |
| zhilian | 智联 | `#38bdf8` |
| heijin | 黑金 | `#f97316` |
| kaifa | 开发 | `#4ade80` |

---

## 三、Typography

### 字号规范

| 级别 | 字号 | 字重 | 行高 | 颜色 | 用途 |
|------|------|------|------|------|------|
| hero | 28px | 900 | 1.2 | textPrimary | 页面大标题 |
| h1 | 24px | 800 | 1.3 | textPrimary | 区块标题 |
| h2 | 20px | 800 | 1.4 | textPrimary | 卡片标题 |
| h3 | 17px | 700 | 1.45 | textPrimary | 小标题 |
| body | 15px | 400 | 1.6 | textSecondary | 正文 |
| bodySmall | 14px | 400 | 1.6 | textSecondary | 次要正文 |
| caption | 12px | 500 | 1.5 | textMuted | 辅助说明 |
| micro | 11px | 600 | 1.4 | textMuted | 标签/徽章 |

### 行高原则
- 正文统一 `line-height: 1.6`（充分留白，不像机器报告）
- 标题 `line-height: 1.2~1.4`（紧凑有力）
- 所有文字禁止压紧

---

## 四、阴影与层次

### 卡片阴影（必须使用，不只是换背景色）

```css
/* 轻量阴影 - 用于小卡片 */
shadow: {
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 2},
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 3,
}

/* 标准阴影 - 用于主要卡片 */
shadow: {
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 4},
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
}

/* 强阴影 - 用于弹窗/浮层 */
shadow: {
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 8},
  shadowOpacity: 0.5,
  shadowRadius: 24,
  elevation: 16,
}
```

### 气泡阴影

```css
/* 接收气泡 */
msgInShadow: {
  shadowColor: '#000',
  shadowOffset: {width: 0, height: 3},
  shadowOpacity: 0.28,
  shadowRadius: 10,
  elevation: 6,
}

/* 发送气泡 - 带蓝色微光 */
msgOutShadow: {
  shadowColor: '#38bdf8',
  shadowOffset: {width: 0, height: 2},
  shadowOpacity: 0.18,
  shadowRadius: 8,
  elevation: 4,
}
```

### 聚焦态光晕

```css
focusGlow: {
  borderColor: '#38bdf8',        /* 边框变蓝 */
  shadowColor: '#38bdf8',        /* 光晕颜色 */
  shadowOffset: {width: 0, height: 0},  /* 不偏移 */
  shadowOpacity: 0.4,             /* 中心最强 */
  shadowRadius: 10,
  elevation: 0,
}
```

---

## 五、圆角体系

| 元素 | 圆角 |
|------|------|
| 页面容器 | 0（贴边） |
| 主卡片 | 20px |
| 小卡片 | 16px |
| 输入框 | 16px |
| Chip/Tag | 999（药丸形） |
| 消息气泡 | 20px（收发各有一个尖角方向） |
| 按钮 | 14px |
| 图标按钮 | 12px |

---

## 六、间距体系（8pt 基准）

| 级别 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 紧凑元素内部 |
| sm | 8px | 元素间微距 |
| md | 16px | 标准间距 |
| lg | 24px | 区块间间距 |
| xl | 32px | 大区块分隔 |
| 2xl | 48px | 页面级上下间距 |

---

## 七、组件规范

### 7.1 消息气泡

**接收气泡（左侧）**
```
背景：rgba(14,24,42,0.88)
边框：1px rgba(255,255,255,0.08)
圆角：20px（左上、右上），6px（左下）
阴影：标准卡片阴影
最大宽度：82%
内边距：14px
```
```
┌─────────────────────┐
│ 助理                 │  ← 名字 11px primary 色
│                     │
│ 这是 AI 的回复文字…   │  ← 正文 15px textSecondary
└─────────────────────┘
```

**发送气泡（右侧）**
```
背景：rgba(2,132,199,0.3)
边框：1px rgba(56,189,248,0.25)
圆角：20px（右上、右下），6px（左下）
阴影：带蓝色微光的阴影
最大宽度：82%
```
```
                    ┌─────────────────────┐
                    │  这是用户发送的文字… │  ← textPrimary
                    └─────────────────────┘
```

### 7.2 输入框

**默认态**
```
背景：rgba(5,13,26,0.9)
边框：1px rgba(255,255,255,0.08)
圆角：16px
高度：min 44px, max 96px（自适应）
内边距：12px 14px
```

**聚焦态（关键动效）**
```
边框：1px #38bdf8（变蓝）
阴影：0 0 10px rgba(56,189,248,0.35)（蓝色光晕从边框向外扩散）
过渡：borderColor 200ms ease, box-shadow 200ms ease
```

### 7.3 导航 Chip（替代 emoji entryRow）

```
背景：rgba(56,189,248,0.08)
边框：1px rgba(56,189,248,0.2)
圆角：999px
内边距：6px 12px
文字：12px primary 色，fontWeight 700
图标：[ ] 内用系统加粗字符
```
```
[📖 记忆库] [📚 知识库] [📎 附件库] [⛓ 调度链]
```
（实际用加粗 Unicode 符号替代 emoji，更精致）

### 7.4 毛玻璃卡片 GlassCard

```tsx
// Props
interface GlassCardProps {
  children: ReactNode
  style?: ViewStyle
  elevated?: boolean  // elevated=true 加阴影
  padding?: number
  borderRadius?: number
}

// 实现逻辑
backgroundColor: 'rgba(14,24,42,0.72)'
borderWidth: 1
borderColor: elevated ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'
borderRadius: 20
// elevated=true 时加 shadowStyle
```

### 7.5 打字指示器动画

```
三个圆点，水平排列，间距 4px
大小：8px 直径
颜色：primary 色
动画：依次 opacity 0.3→1，间隔 300ms，无限循环
```
```
● ○ ○  →  ○ ● ○  →  ○ ○ ●  →  ● ○ ○
 |      |      |
t=0    t=0.3  t=0.6  t=1.0
```

### 7.6 Dispatch Mini Indicator（替代大状态卡）

```
高度：紧凑一行
背景：毛玻璃
内含：状态 dot + 简短文字 + 可选"查看链路"链接
```
```
● 执行中 · dispatchId=dpxxx-xxx  [查看链路 →]
```

### 7.7 Context Indicator（替代 context banner）

```
一行：消息数 · 模式 · 在线状态 dot
背景：极淡蓝色 rgba(56,189,248,0.06)
圆角：999px
```
```
3 条消息 · direct · ● 在线
```

---

## 八、页面级规范

### 8.1 ChatScreen（对话页）

**顶部区（Header）**
- 标题 "AI 对话" + 副标题
- 右侧：清空按钮（红色小 Chip）
- 导航 Chip Row（4个，用简化图标）
- Context Indicator（一行）
- 运行时 Banner（仅 fallback 时显示）

**消息流**
- 消息列表，padding 16px
- 消息泡最大宽度 82%，自适应对齐
- 每条消息间距 10-12px
- 打字指示器嵌入消息流

**底部输入区**
- 输入框毛玻璃背景，聚焦态有光晕
- 发送按钮（主蓝色，44px 高）
- 附件按钮（单独一个图标按钮在左边）

### 8.2 DashboardScreen（总览页）

**整体节奏**
- 顶部留白 24px
- 每个区块之间间距 20-24px（不是 12px）
- 区块内 padding 16-18px
- MetricCard：数字大（28px weight 900）+ 单位小 + 趋势标签

**Card 设计**
- 全部加阴影
- 边框 1px subtle
- 内部信息分层：标题→数值→辅助说明

### 8.3 GatewaySettingsScreen

**Hero 区域**
- 毛玻璃背景 + 阴影
- 标题 24px + 副标题描述

**表单卡片**
- 毛玻璃背景
- 字段之间间距 md（16px）
- 底部 actions 区留足够 padding

---

## 九、图标规范

### 图标来源策略
**不引入重型库**，使用加粗 Unicode 符号组合替代 emoji。

### 图标对照表

| 功能 | Unicode 符号 | 说明 |
|------|-------------|------|
| 消息 | `[ ]` 或 `⊞` | 方框内符号 |
| 记忆 | `◈` | 菱形 |
| 知识 | `◉` | 实心圆 |
| 附件 | `⊕` | 加圈 |
| 调度 | `⬡` | 六边形 |
| 设置 | `⊞` | 方形 |
| 发送 | `↑` | 向上箭头 |
| 添加 | `＋` | 加号 |
| 关闭 | `✕` | X |
| 完成 | `✓` | 对勾 |
| 警告 | `⚠` | 警告 |
| 等待 | `◌` | 虚线圆 |
| 智能体 | `◉` | 实心圆 |
| 任务 | `◎` | 双圆 |
| 执行中 | `⬡` | 六边形 |

### 图标使用规则
```typescript
// 在代码中统一用 Icon 组件
import { Icon } from '../components/Icons'

// 使用时
<View style={{flexDirection: 'row', gap: 6, alignItems: 'center'}}>
  <Icon name="message" size={14} color={C.primary} />
  <Text style={{color: C.textSecondary, fontSize: 13}}>对话</Text>
</View>
```

---

## 十、动效规范

### 输入框聚焦动画
```typescript
// React Native Animated API
const borderAnim = useRef(new Animated.Value(0)).current

const onFocus = () => {
  Animated.timing(borderAnim, {
    toValue: 1,
    duration: 200,
    useNativeDriver: false, // shadowOpacity 不支持 native driver
  }).start()
}

const borderColor = borderAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['rgba(255,255,255,0.08)', '#38bdf8'],
})
```

### 打字指示器
```typescript
// 三点动画，用 Animated.loop + Animated.sequence
// 每个点依次亮起，opacity 0.3→1，300ms 间隔
```

### 页面过渡
```typescript
// 使用 React Navigation 默认过渡即可
// 不需要额外自定义动画，保持简洁
```

---

## 十一、禁止事项

| 禁止 | 原因 |
|------|------|
| 禁止在 Card 上只用背景色不加阴影 | 卡片没有悬浮感 |
| 禁止 emoji 出现在正式 UI | 质感粗糙 |
| 禁止行高低于 1.4 | 文字太挤 |
| 禁止文字色用纯白 `#fff` | 刺眼 |
| 禁止输入框无聚焦态 | 交互不明确 |
| 禁止所有区块间距一样 | 没有节奏感 |
| 禁止消息气泡无圆角方向区分 | 无法区分收发 |

---

## 十二、验证清单

开发完成后逐项核验：

- [ ] 气泡有明显的收发方向区分
- [ ] 气泡有阴影，不是平的
- [ ] 输入框聚焦有蓝色光晕扩散
- [ ] 打字指示器有真正的动画
- [ ] Dispatch 状态卡不再抢占大量垂直空间
- [ ] Entry Row 不用 emoji，改用图标符号
- [ ] 所有卡片有阴影和层次
- [ ] Typography 行高 ≥ 1.5
- [ ] 全局颜色不超过 7 种主色
- [ ] tsc --noEmit 通过
- [ ] iOS build 成功

---

## 附录：完整色值变量（可直接粘贴进代码）

```typescript
export const C = {
  bgRoot:          '#030810',
  bgSurface:       '#080e1a',
  bgCard:          'rgba(14,24,42,0.72)',
  bgElevated:      '#0d1830',
  bgOverlay:        'rgba(8,14,28,0.88)',
  bgGlass:          'rgba(14,24,42,0.65)',

  borderSubtle:     'rgba(255,255,255,0.06)',
  borderDefault:    'rgba(255,255,255,0.10)',
  borderActive:    'rgba(56,189,248,0.50)',

  primary:          '#38bdf8',
  primaryDark:      '#0284c7',
  primaryGlow:     'rgba(56,189,248,0.25)',
  accent:           '#22d3ee',

  textPrimary:      '#f1f5f9',
  textSecondary:    '#94a3b8',
  textMuted:        '#475569',
  textDisabled:     '#1e293b',

  success:          '#34d399',
  warning:          '#fbbf24',
  error:            '#f87171',
  info:             '#60a5fa',

  zhuli:            '#22d3ee',
  renzhi:           '#a78bfa',
  xunlong:          '#fbbf24',
  wuyin:            '#34d399',
  tansuo:           '#fb7185',
  zhilian:          '#38bdf8',
  heijin:           '#f97316',
  kaifa:            '#4ade80',
} as const
```
