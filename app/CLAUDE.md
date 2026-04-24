# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

- 安装依赖：`pnpm install`
- 启动开发环境：`pnpm dev`
- 构建 Web 资源：`pnpm build`
- 本地预览构建产物：`pnpm preview`
- 运行 MQTT 连通性脚本：`pnpm test:aliyun`
- 运行指定 MQTT 测试模式：`node moodpaws-server/scripts/test-aliyun-mqtt.mjs web-wss`
- 运行另一个 MQTT 测试模式：`node moodpaws-server/scripts/test-aliyun-mqtt.mjs legacy-device-tcp`

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

- MQTT 相关代码主要保留在 `moodpaws-server/` 与 `moodpaws-server/scripts/test-aliyun-mqtt.mjs`，**前端已不再保留 MQTT 直连代码，也不再作为当前页面主流程**。
- 当前社交过渡页会复用 `usePetApi()` 的状态、指标分组与原始 payload 调试信息。
- 当前宠舍页通过 `usePetApi()` 消费真实后端 API，没有真实数据时展示空态。

### 3. 设备数据主要由后端归一化后再渲染

当前页面消费的是 `moodpaws-server` 返回的 telemetry/emotion API 数据：

- 后端负责订阅 MQTT、解析 `payload.items` 并产出统一的 `sections`
- 前端通过 `src/composables/usePetApi.js` 拉取并渲染
- 如需新增传感器字段或修改指标展示，通常应优先调整 `moodpaws-server/src/mqtt/parser.js` 与对应接口，再改页面

### 4. 地图与图表是页面内局部能力

- 高德地图配置在 `src/config/amap.js`
- 动态加载逻辑在 `src/services/amap/loader.js`
- `CollarView.vue` 负责消费经纬度并维护 marker/polyline 轨迹
- `EmotionView.vue` 和 `CollarView.vue` 都直接在组件内初始化 ECharts 实例并在卸载时销毁

这里没有额外的图表抽象层；图表 option、生命周期、DOM ref 基本都写在页面组件内部。

## 开发时需要注意的事实

- 当前没有配置单元测试框架、lint 或格式化脚本；主要验证方式是运行页面和执行 `pnpm build`。
- README 仍是 Vite 模板默认内容，项目真实行为应以 `src/`、`md/`、`moodpaws-server/` 和 Capacitor 配置为准。
- 页面应优先展示真实设备数据；没有真实数据时展示空态，不再补本地演示内容。
- 如果继续推进社交能力，应在 `DashboardView.vue` 基础上演进，而不是再把宠舍内容写回社交入口。
- 如果继续推进宠舍能力，应在当前真实 API 链路基础上补齐详情页、异常态与控制流。
