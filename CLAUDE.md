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

应用入口很轻：`src/main.js` 只负责挂载 `App.vue`。当前没有使用 Vue Router，`src/App.vue` 直接维护底部 tab，并在项圈 / 情绪 / 占位页面之间切换。

## 核心架构

### 1. 页面层以功能模块划分

主要页面都在 `src/views/`：

- `collar/CollarView.vue`：项圈主界面，聚合健康数据、GPS 轨迹、步数估算、在线状态
- `emotion/EmotionView.vue`：情绪分析展示，主要是静态/假数据驱动的 ECharts 可视化
- `dashboard/DashboardView.vue`：更偏调试/总览的 MQTT 数据面板，用于查看原始消息和分段指标

当前产品入口实际挂载的是 `CollarView` 和 `EmotionView`；`DashboardView` 更像调试页面，不在默认 tab 流程里。

### 2. MQTT 是实时数据主链路

MQTT 相关逻辑按“配置 → 客户端封装 → 组合式状态 → 页面消费”分层：

- `src/services/mqtt/config.js`：MQTT broker、topic、认证参数，以及 `getMqttConnectionOptions()`
- `src/services/mqtt/client.js`：对 `mqtt.connect()` 的轻量封装，只负责把底层事件转成 handlers
- `src/composables/useMqtt.js`：核心状态管理层，负责连接、订阅、断开、错误状态、最新 payload、解析后的指标数据
- 页面组件直接调用 `useMqtt()` 获取响应式状态

如果要改实时链路，优先从 `useMqtt.js` 看整体生命周期，再看 `client.js` 和 `config.js`。

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

- 当前没有配置单元测试框架、lint 或格式化脚本；仓库里唯一现成的“测试”入口是 MQTT 连通性脚本 `scripts/test-aliyun-mqtt.mjs`。
- README 仍是 Vite 模板默认内容，项目真实行为应以 `src/`、`scripts/` 和 Capacitor/MQTT 配置为准。
- 一些页面使用假数据和模拟状态（尤其情绪页，以及项圈页的部分心率回退逻辑）；不要默认所有展示都来自真实设备。
