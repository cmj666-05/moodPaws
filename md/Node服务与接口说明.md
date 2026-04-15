# MoodPaws Node 服务说明

## 1. 服务概述

该服务位于 `moodpaws-server/`，使用：

- Node.js
- Express
- SQLite（基于 Node 22 内置 `node:sqlite`）
- MQTT

当前目标是作为前端 MQTT 直连的后端承接层，负责：

1. 连接 MQTT
2. 解析设备上报数据
3. 将原始消息和指标历史写入 SQLite
4. 提供 REST API 给前端查询

---

## 2. 目录结构

```text
moodpaws-server/
├─ .env.example
├─ package.json
├─ data/
│  └─ moodpaws.db
└─ src/
   ├─ app.js
   ├─ server.js
   ├─ config/
   │  ├─ env.js
   │  └─ mqtt.js
   ├─ db/
   │  ├─ sqlite.js
   │  ├─ schema.js
   │  └─ repositories/
   │     ├─ emotion-repo.js
   │     └─ telemetry-repo.js
   ├─ mqtt/
   │  ├─ client.js
   │  ├─ consumer.js
   │  └─ parser.js
   ├─ routes/
   │  ├─ emotion.routes.js
   │  ├─ health.routes.js
   │  └─ telemetry.routes.js
   └─ services/
      ├─ emotion-service.js
      └─ telemetry-service.js
```

---

## 3. 启动方式

进入目录：

```bash
cd moodpaws-server
```

安装依赖：

```bash
pnpm install
```

启动开发服务：

```bash
pnpm dev
```

启动正式服务：

```bash
pnpm start
```

当前默认端口：

- `3001`

服务启动后可访问：

- 本机调试：`http://localhost:3001/api/health`
- 已部署服务器：`http://47.109.193.139:3001/api/health`

---

## 4. 环境变量

参考文件：`moodpaws-server/.env.example`

```env
PORT=3001
DB_PATH=./data/moodpaws.db
MQTT_BROKER_URL=wss://iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com:443/mqtt
MQTT_TOPICS=/k1wxaEnEO8L/petInfo/user/get
MQTT_CLIENT_ID=k1wxaEnEO8L.petInfo|securemode=2,signmethod=hmacsha256|
MQTT_USERNAME=petInfo&k1wxaEnEO8L
MQTT_PASSWORD=replace-with-real-password
CORS_ORIGIN=*
```

说明：

- 当前后端通过 `MQTT_TOPICS` 订阅历史上已验证可工作的聚合 Topic `/k1wxaEnEO8L/petInfo/user/get`
- 当前订阅身份使用 `petInfo`，三元组为 `ProductKey=k1wxaEnEO8L`、`DeviceName=petInfo`
- `petInfo` 的 HMAC-SHA256 鉴权密码计算结果为 `4f106f7ea256495207f2235389a9e792744eab503918fcf632e633a72ac6bed7`
- 当前服务启动日志与 `/api/health` 会返回最近 `connack/suback` 状态，便于区分“握手失败 / 订阅失败 / 已连接未上报”
- 真正接 MQTT 时，需要在 `moodpaws-server/.env` 中填写真实密码
- 如果未配置 MQTT 环境变量，服务仍可启动，但 MQTT 状态会显示未启用

---

## 5. 数据库设计

数据库文件默认位置：

- `moodpaws-server/data/moodpaws.db`

### 5.1 mqtt_messages

保存原始 MQTT 消息。

字段：

- `id`
- `topic`
- `device_name`
- `request_id`
- `gmt_create`
- `payload_json`
- `received_at`

用途：

- 排查原始上报数据
- 回放或补充解析规则

### 5.2 metric_points

保存解析后的扁平指标点。

字段：

- `id`
- `message_id`
- `metric_key`
- `value_num`
- `value_text`
- `ts`

当前主要指标包括：

- `PetHouse:Temp`
- `PetHouse:Humi`
- `PetHouse:CO2`
- `PetHouse:CH2O`
- `PetHouse:VOC`
- `PetHouse:MQ135`
- `PetHouse:Weight`

> 当前标准物模型接入只保证以上 `PetHouse:*` 指标。旧的 `X/Y/Z`、`HeartRate`、`SPO2`、`Longitude`、`Latitude` 不在本次标准 Topic 接入范围内。

### 5.3 emotion_snapshots

保存情绪分析结果快照。

字段：

- `id`
- `source`
- `mood_label`
- `score`
- `summary_json`
- `created_at`

当前启动时会自动插入一条默认 mock 数据，供情绪接口返回。

---

## 6. MQTT 数据解析规则

解析逻辑文件：

- `moodpaws-server/src/mqtt/parser.js`

当前后端按历史可工作方案，只订阅：

- `/k1wxaEnEO8L/petInfo/user/get`

### 6.1 直接平铺字段

从 `payload.items` 中直接读取：

- `PetHouse:Temp`
- `PetHouse:Humi`
- `PetHouse:CO2`
- `PetHouse:CH2O`
- `PetHouse:VOC`
- `PetHouse:MQ135`
- `PetHouse:Weight`

### 6.2 项圈扩展字段

如果 `petInfo` 聚合消息中包含项圈数据，则继续拆分：

- `Collar:XYZ` -> `X` / `Y` / `Z`
- `Collar:GPS` -> `Longitude` / `Latitude`
- `Collar:XKXY` -> `HeartRate` / `SPO2`

### 6.3 来源设备识别

优先使用 payload 中的 `deviceName` 识别真实来源设备，例如：

- `Collar`
- `DogHouse`

### 6.4 输出结果

解析后会生成两类数据：

1. `metricPoints`
   - 用于入库保存历史
2. `source + sections`
   - 用于接口直接返回前端展示结构

---

## 7. 已实现接口

接口前缀统一为：

- `/api`

### 7.1 健康检查

#### `GET /api/health`

用途：

- 查看服务是否启动
- 查看数据库路径
- `/api/health` 可同时查看更细的 MQTT 状态字段，包括 `lastEvent`、`lastConnackCode`、`lastDisconnectPacket`、`lastSubscribeGranted`，用于区分“握手失败 / 订阅失败 / 已连接未上报”等场景

### 7.2 获取最新总览数据

#### `GET /api/telemetry/latest`

用途：

- 给 Dashboard / Collar 提供当前最新状态
- 当前返回中已补充 `stepCount`，用于首页“今日步数”展示

补充说明：

- 页面展示用的 `sections` 当前优先取最近一条 `device_name = Collar` 的消息，以保证首页心率、定位、运动指标稳定显示。
- `receivedAt` 与 `topic` 仍反映最近一条总体 telemetry 消息时间，可用于判断链路是否持续有新消息。
- `stepCount` 由服务端根据最近一段 `X/Y/Z` 历史样本按首页原有口径计算：先计算三轴模长，再在相邻样本模长差值大于阈值 `1.2` 时计一步。

### 7.3 获取最近原始消息

#### `GET /api/telemetry/messages?limit=50`

用途：

- 调试 MQTT 入库情况
- 查看最近消息摘要

### 7.4 获取单个指标历史

#### `GET /api/telemetry/metrics/:metricKey/history?limit=100`

用途：

- 查询心率、血氧、温度、体重等历史数据

### 7.5 获取定位轨迹

#### `GET /api/telemetry/location/track?limit=200`

用途：

- 给项圈页面地图轨迹使用

### 7.6 获取最新情绪结果

#### `GET /api/emotion/latest`

用途：

- 给情绪页提供统一接口

当前返回 mock 情绪数据。

---

## 8. 当前验证结果

本地已验证：

1. 服务可正常启动
2. SQLite 数据库可自动创建
3. `/api/health` 可正常返回
4. `/api/emotion/latest` 可正常返回 mock 数据
5. `/api/telemetry/latest`、`/api/telemetry/messages` 在无真实 MQTT 消息时可正常返回空结果
6. 前端 `src/App.vue` 已将 `house` tab 挂接到 `SocialView`，`social` tab 挂接到 `DashboardView`
7. 前端 `src/views/dashboard/DashboardView.vue`、`src/views/collar/CollarView.vue`、`src/views/emotion/EmotionView.vue` 已改为通过 `src/composables/usePetApi.js` 请求后端 API
8. 前端已执行 `pnpm build` 并构建成功
9. 使用当前 `.env` 启动后，`/api/health` 已稳定返回 `mqtt.enabled = true`、`mqtt.connected = true`、`mqtt.subscribed = true`
10. 当前 `/api/health` 已可返回更细的 MQTT 状态字段，包括 `lastEvent`、`lastConnackCode`、`lastDisconnectPacket`、`lastSubscribeGranted`
11. 本地复验中已确认 broker 握手成功（`lastConnackCode = 0`）、订阅成功（`lastSubscribeGranted` 含目标 topic 且 qos=1）
12. 持续观察约 2 分钟期间，`lastError` 为空，未复现固定的 `offline / close / reconnect` 异常
13. 持续观察期间 `lastMessageAt` 已更新，说明服务在保持连接的同时已实际收到 MQTT 消息

当前真实 MQTT 链路已验证到“连接成功、订阅成功、并已收到真实消息”阶段，现阶段没有证据表明存在固定的“同设备名互踢”“旧连接占用”或“broker 握手失败”问题；若后续再次出现异常，应以当时的 `/api/health` 返回和服务日志为准继续排查。

---

## 9. 后续建议

### 9.1 当前接入方式

当前数据链路已调整为：

`MQTT -> moodpaws-server -> SQLite -> REST API -> 前端页面`

前端通过 `src/config/api.js` 读取 API 地址，默认值为：

- `http://47.109.193.139:3001/api`

推荐在项目根目录创建 `.env.local`（或 `.env`）覆盖：

```env
VITE_API_BASE_URL=http://47.109.193.139:3001/api
VITE_API_POLL_INTERVAL=5000
```

已提交模板文件：

- `.env.example`

本机联调时可改为：

- `VITE_API_BASE_URL=http://localhost:3001/api`

Android 安装包如果直接访问当前服务器 HTTP 接口，已在原生层放行：

- 当前采用 Android 全局明文 HTTP 放行配置（`usesCleartextTraffic=true` + `network_security_config`）
- 当前服务器地址：`http://47.109.193.139:3001/api`

页面接入情况：

- `DashboardView`：当前作为社交过渡页，复用 `/api/telemetry/latest` 的调试信息与状态展示
- `CollarView`：读取 `/api/telemetry/latest`、`/api/telemetry/metrics/HeartRate/history`、`/api/telemetry/location/track`、`/api/emotion/latest`
- `EmotionView`：读取 `/api/emotion/latest`
- `SocialView`：当前为宠舍照护页首版，仍以本地假数据为主，尚未全面接入 API

旧前端 MQTT 代码（如 `src/composables/useMqtt.js`、`src/services/mqtt/*`）当前按“保留一版、先不启用”的策略处理，页面主流程已不再直接依赖它们。

### 9.2 下一步优先做的事

1. 启动 `moodpaws-server`
2. 访问 `/api/health` 确认 MQTT 已连接并已订阅
3. 访问 telemetry 相关接口确认真实消息已入库
4. 启动前端，联调 Collar / Emotion / 社交过渡页
5. 逐步把宠舍页从本地假数据替换为真实 API 数据

### 9.3 前端可优先对接的接口

优先级建议：

1. `GET /api/telemetry/latest`
2. `GET /api/telemetry/metrics/HeartRate/history`
3. `GET /api/telemetry/location/track`
4. `GET /api/emotion/latest`

---

## 10. 补充说明

### 为什么没有继续用 sqlite3 包

最初使用了 `sqlite3` 包，但在当前 Windows + Node 22 环境下出现了原生绑定缺失问题，无法启动。  
因此已经切换为 Node 22 内置的 `node:sqlite`，这样可以避免原生模块安装失败，当前项目更稳。

### 当前还没做的内容

目前还没有实现：

- 用户/宠物/设备多表关系
- 鉴权
- 分页查询
- 删除/清理历史数据
- WebSocket / SSE 实时推送
- 旧前端 MQTT 文件与 `mqtt` 依赖的物理删除（当前仍保留一版）
- 真实 NFC 社交流程
- 宠舍页真实 API 全量接入

当前版本定位就是后端 MVP + 前端 API 化首版。
