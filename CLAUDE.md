# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`pnpm install`
- 启动开发环境：`pnpm dev`
- 构建 Web 资源：`pnpm build`
- 本地预览构建产物：`pnpm preview`
- 运行 MQTT 连通性脚本：`pnpm test:aliyun`
- 运行指定 MQTT 测试模式：`node scripts/test-aliyun-mqtt.mjs web-wss`
- 运行另一个 MQTT 测试模式：`node scripts/test-aliyun-mqtt.mjs legacy-device-tcp`

## 项目结构

这是一个基于 Vue 3 + Vite 的前端项目，同时通过 Capacitor 输出到 Android 容器。`capacitor.config.json` 指向 `dist` 作为 `webDir`，说明 Web 构建产物会被原生壳复用。

应用入口很轻：`src/main.js` 只负责挂载 `App.vue`。当前没有使用 Vue Router，`src/App.vue` 直接维护底部 4 个 tab，并进行视图切换。

当前 tab 映射关系：

- `项圈` -> `src/views/collar/CollarView.vue`
- `宠舍` -> `src/views/social/SocialView.vue`
- `情绪` -> `src/views/emotion/EmotionView.vue`
- `社交` -> `src/views/dashboard/DashboardView.vue`

## 核心架构

### 1. 页面层以功能模块划分

主要页面都在 `src/views/`：

- `collar/CollarView.vue`：项圈主界面，聚合健康数据、GPS 轨迹、步数估算、在线状态
- `social/SocialView.vue`：当前宠舍照护总览页首版，包含环境、看护、体征、饮食、情绪等模块
- `emotion/EmotionView.vue`：情绪分析展示，主要是 ECharts 可视化
- `dashboard/DashboardView.vue`：当前社交过渡页 / 建设中页，同时保留后端 telemetry 调试信息

### 2. API 是当前页面主链路

当前主页面的数据链路是：

`moodpaws-server API -> src/composables/usePetApi.js -> 页面响应式状态 -> 页面渲染`

`usePetApi()` 当前负责拉取：

- `/telemetry/latest`
- `/telemetry/metrics/HeartRate/history?limit=30`
- `/telemetry/location/track?limit=200`
- `/emotion/latest`

注意：

- MQTT 相关代码仍保留在仓库中，但**不再是当前页面主流程**。
- 当前社交过渡页会复用 `usePetApi()` 的状态、指标分组与原始 payload 调试信息。
- 当前宠舍页仍以本地假数据首版为主，尚未全面接入真实 API。

### 3. 设备 payload 会先被归一化再渲染

`src/utils/pet-house-parser.js` 是数据模型转换的关键文件。它把阿里云 MQTT 消息中的 `items` 字段映射成前端稳定的数据结构：

- 按 section 组织为 `pet-house`、`collar-motion`、`collar-health`、`collar-location`
- 把嵌套字段如 `Collar:XYZ`、`Collar:GPS`、`Collar:XKXY` 拆成页面可直接消费的指标
- 保留上一帧值，避免某次 payload 缺字段时界面直接掉成空值

新增传感器字段或修改展示卡片时，通常应先改这里的归一化逻辑，再改页面。

### 4. 地图与图表是页面内局部能力

- 高德地图配置在 `src/config/amap.js`
- 动态加载逻辑在 `src/services/amap/loader.js`
- `CollarView.vue` 负责消费经纬度并维护 marker/polyline 轨迹
- `EmotionView.vue` 和 `CollarView.vue` 都直接在组件内初始化 ECharts 实例并在卸载时销毁

这里没有额外的图表抽象层；图表 option、生命周期、DOM ref 基本都写在页面组件内部。

## 开发时需要注意的事实

- 当前没有配置单元测试框架、lint 或格式化脚本；主要验证方式是运行页面和执行 `pnpm build`。
- README 仍是 Vite 模板默认内容，项目真实行为应以 `src/`、`md/`、`moodpaws-server/` 和 Capacitor 配置为准。
- 一些页面使用假数据和模拟状态，尤其宠舍页与情绪页；不要默认所有展示都来自真实设备。
- 如果继续推进社交能力，应在 `DashboardView.vue` 基础上演进，而不是再把宠舍内容写回社交入口。
- 如果继续推进宠舍能力，应在 `SocialView.vue` 基础上演进，并逐步把本地假数据替换成 API 数据。
