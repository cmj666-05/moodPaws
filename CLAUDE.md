# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库概览

这个仓库实际包含 3 个相对独立的项目：

- `app/`：主应用，Vue 3 + Vite + Capacitor Android 壳，是当前核心产品代码。
- `moodpaws-server/`：本地 Node.js/Express 服务，负责订阅 MQTT、落库、聚合 telemetry，并向 `app/` 提供 `/api/*` 接口。
- `web/`：独立的 React + TypeScript Vite 项目，更像单独的监控/实验前端，不是当前主 App 主链路的一部分。

优先把 `app/` + `moodpaws-server/` 视为同一套产品链路来理解；`web/` 只有在用户明确提到时再深入。

## 开源组件与脚手架现状

仓库明显建立在多个开源生态之上，不像是直接 fork 某个完整业务开源项目：

- `app/README.md` 仍是默认 `Vue 3 + Vite` 模板文案。
- `app/` 使用 Vue 3、Vite、Capacitor、ECharts 等开源组件组合实现业务。
- `web/` 是独立的 React 18 + TypeScript + Vite 项目，并带有 ESLint、React Router 等常见开源栈。
- `web/` 当前更像独立初始化后的演示/监控端，维护自己的路由、状态和模拟数据，不属于主 App 的实时数据主链路。
- `moodpaws-server/` 使用 Express、mqtt、cors、dotenv 等开源 Node 组件，自行承接设备数据聚合。

## 常用命令

### `app/`（主前端）

- 安装依赖：`cd app && pnpm install`
- 启动开发服务器：`cd app && pnpm dev`
- 构建前端：`cd app && pnpm build`
- 预览构建结果：`cd app && pnpm preview`
- 测试阿里云 MQTT 连通性：`cd app && pnpm test:aliyun`
- 指定 MQTT 测试模式：`cd app && node ../moodpaws-server/scripts/test-aliyun-mqtt.mjs web-wss`

### `moodpaws-server/`（本地后端）

- 安装依赖：`cd moodpaws-server && npm install`
- 启动服务：`cd moodpaws-server && npm run start`
- 开发模式启动：`cd moodpaws-server && npm run dev`
- 生成原库风格数据：`cd moodpaws-server && npm run seed:original-style`
- 测试阿里云 MQTT：`cd moodpaws-server && npm run test:aliyun`

### `web/`（独立 React 项目）

- 安装依赖：`cd web && npm install`
- 启动开发服务器：`cd web && npm run dev`
- 构建：`cd web && npm run build`
- Lint：`cd web && npm run lint`
- 预览：`cd web && npm run preview`

## 架构总览

### 1. 主产品是“设备数据 -> 本地服务 -> App 页面”的链路

关键数据流：

`阿里云/设备 MQTT 消息 -> moodpaws-server/src/mqtt/consumer.js -> SQLite/内存存储 -> Express API -> app/src/composables/usePetApi.js -> Vue 页面`

如果用户说“页面数据显示不对”，通常不要只改前端。先判断问题是在：

- MQTT 订阅与连接：`moodpaws-server/src/mqtt/client.js`
- payload 解析：`moodpaws-server/src/mqtt/parser.js`
- telemetry 聚合：`moodpaws-server/src/services/telemetry-service.js`
- 前端轮询与状态映射：`app/src/composables/usePetApi.js`

### 2. `app/` 没有使用 Vue Router，而是单壳切 Tab

`app/src/main.js` 只挂载 `App.vue`。

`app/src/App.vue` 直接维护底部 tab、异步加载页面组件，并用 `KeepAlive` 缓存视图。当前主页面映射是：

- `collar` -> `app/src/views/collar/CollarView.vue`
- `house` -> `app/src/views/dashboard/DashboardView.vue`
- `emotion` -> `app/src/views/emotion/EmotionView.vue`

因此很多“路由级”行为实际都写在 `App.vue` 和页面组件内部，而不是 router 配置里。

### 3. `app/` 的服务发现与地址切换是运行时核心能力

前端不是只依赖固定环境变量地址。

`app/src/config/api.js` 负责：

- 读取 `VITE_API_BASE_URL`
- 在原生平台通过 `LanDiscovery` 做 mDNS 局域网发现
- 健康检查 `/api/health`
- 缓存/手动覆盖 API 地址
- 推导视频流地址

`app/src/components/ApiEndpointSheet.vue` 是给用户手动切换后端和视频流地址的入口。涉及“连不上本地服务”“局域网自动发现失败”“切换电脑 IP”时，优先看这两处。

### 4. `moodpaws-server/` 是聚合层，不只是简单转发 MQTT

服务入口是 `moodpaws-server/src/server.js`，它会：

- 初始化 schema
- 启动 Express
- 启动 MQTT subscriber
- 发布 mDNS 服务发现信息
- 在内存中维护 MQTT 连接状态与服务发现状态

HTTP 装配在 `moodpaws-server/src/app.js`，主要公开：

- `/api/health`
- `/api/telemetry/latest`
- `/api/telemetry/messages`
- `/api/telemetry/metrics/:metricKey/history`
- `/api/telemetry/location/track`
- `/api/emotion/latest`

其中 `/api/health` 不只是存活探针，还会返回 discovery、MQTT 和 video 配置，前端发现逻辑依赖它。

### 5. telemetry 的“真实结构”由后端 parser 定义

`moodpaws-server/src/mqtt/parser.js` 是设备 payload 到前端指标结构的标准化入口。

这里定义了：

- 指标分组 `metricSections`
- 各类 `items` 字段如何映射成 `metricKey`
- GPS、BNO085、MAX30102 等嵌套字段如何拆平
- `EmotionState` 如何转成情绪标签

新增传感器、改指标名称、改页面分组时，通常应先改 parser，再看前端展示是否要跟进。

### 6. telemetry service 会把多设备消息合并成一个前端可消费快照

`moodpaws-server/src/services/telemetry-service.js` 会：

- 分别读取 `Collar` 和 `DogHouse` 最新消息
- 合并 section
- 用最新 metric point 补齐缺失值
- 计算在线状态
- 依据 BNO085 样本粗略计算步数
- 提供轨迹点和历史曲线数据

所以前端拿到的不是“某一条原始 MQTT 消息”，而是已经跨消息、跨设备聚合后的视图模型。

### 7. 数据持久化默认围绕 SQLite schema 设计

`moodpaws-server/src/db/schema.js` 负责初始化与迁移：

- `mqtt_messages`
- `metric_points`

它还会做历史数据回填、重建 metric points、删除旧演示数据。只要改了 payload 解析规则、metric key 或落库结构，就要同步检查这里的兼容与回填逻辑。

### 8. `web/` 是独立模拟监控端，不要误认成主业务前端

`web/src/main.tsx` 与 `web/src/App.tsx` 表明它是标准 React SPA，自己维护路由、页面组件和大量前端内存态。

当前 `web/` 主要使用本地模拟数据与交互逻辑，不消费 `moodpaws-server` 这条主 telemetry 链路。除非用户明确要求，否则不要把 `web/` 里的实现当成 `app/` 的真实业务来源。

### 9. Capacitor 说明这是“Web 前端 + Android 壳”模式

`app/capacitor.config.json` 指向 `dist` 作为 `webDir`，说明 Android 容器直接复用前端构建产物。

如果任务涉及原生访问、局域网连接、混合内容或真机调试，除了 `app/src/` 代码，还要一起检查 Capacitor 配置和原生插件能力是否匹配。

## 现状与注意点

- `app/README.md` 目前仍接近模板性质，不足以代表项目真实结构，应优先以源码和本文件为准。
- `app/` 当前没有配置 lint 或测试脚本，前端改动的最低验证通常是 `cd app && pnpm build`。
- `moodpaws-server/` 也没有正式测试框架，修改后通常通过直接启动服务和调用 API 验证。
- `web/` 有自己的 `lint` 与 TypeScript 构建流程，但它不是主 App 数据链路的一部分。
- 根目录没有统一 workspace 脚本；命令应分别在 `app/`、`moodpaws-server/`、`web/` 下执行。
- 仓库里同时存在 `package-lock.json` 与 `app/pnpm-lock.yaml`，说明不同子项目使用的包管理器并不统一，改动依赖时不要想当然地在根目录执行统一安装命令。
