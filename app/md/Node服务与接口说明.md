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

服务启动后可访问（后端监听 `0.0.0.0`）：

- 本机调试：`http://127.0.0.1:3001/api/health`
- 局域网调试：以服务启动日志打印出的 IPv4 地址为准，例如 `http://192.168.1.23:3001/api/health`

服务启动时还会额外输出：

- 当前可访问的本机 / 局域网地址列表
- `serviceId`
- mDNS 服务名（默认 `moodpaws-server._http._tcp.local`）

> mDNS 发现用于减少换 Wi‑Fi / 热点后的重新配置成本，但不同手机热点、路由器和系统对 `.local`/局域网广播的支持存在差异；若自动发现失败，仍建议回退到服务日志里打印的 LAN 地址。
---

## 4. 环境变量

参考文件：`moodpaws-server/.env.example`

```env
PORT=3001
DB_PATH=./data/moodpaws.db
MDNS_ENABLED=true
MDNS_SERVICE_NAME=moodpaws-server
SERVICE_ID=
MQTT_BROKER_URL=wss://iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com:443/mqtt
MQTT_TOPICS=/k1wxaEnEO8L/petInfo/user/get
MQTT_CLIENT_ID=k1wxaEnEO8L.petInfo|securemode=2,signmethod=hmacsha256|
MQTT_USERNAME=petInfo&k1wxaEnEO8L
MQTT_PASSWORD=replace-with-real-password
CORS_ORIGIN=*
```

说明：

- `MDNS_ENABLED=true` 时，服务启动后会发布 `_http._tcp` 的 mDNS 服务，默认服务名是 `moodpaws-server`
- `SERVICE_ID` 为空时，服务端会基于主机名/端口/数据模式生成稳定的 `serviceId`
- `serviceId`、discovery 状态和 MQTT 状态都会出现在 `/api/health`
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

- `EmotionState`
- `PetHouse:Temp`
- `PetHouse:Humi`
- `PetHouse:MQ135`
- `PetHouse:CO2`
- `PetHouse:CH2O`
- `PetHouse:VOC`
- `PetHouse:Weight`
- `PetHouse:Mood`
- `Collar:temp`
- `Collar:GPS.Longitude`
- `Collar:GPS.Latitude`
- `Collar:BNO085.X`
- `Collar:BNO085.Y`
- `Collar:BNO085.Z`
- `Collar:MAX30102.HeartRate`
- `Collar:MAX30102.SPO2`

其中 `EmotionState` 的枚举含义为：

- `1` -> `angry` -> `生气`
- `2` -> `anxious` -> `焦虑`
- `3` -> `happy` -> `开心`
- `4` -> `lonely` -> `孤独`
- `5` -> `sad` -> `难过`

> 当前解析规则以真实设备字段为准。已收到的真实 `PetHouse:*` 字段用于宠舍环境、体重与宠舍情绪展示；`Collar:*` 字段用于宠物温度、定位、姿态、心率与血氧展示。旧的 `Collar:XYZ`、`Collar:XKXY` 指标名不再作为主流程字段。

### 5.3 emotion_snapshots

保存情绪分析结果快照。

字段：

- `id`
- `source`
- `mood_label`
- `score`
- `summary_json`
- `created_at`

当前情绪接口应优先返回真实 telemetry 或真实情绪快照；没有数据时返回空状态。

---

## 6. MQTT 数据解析规则

解析逻辑文件：

- `moodpaws-server/src/mqtt/parser.js`

当前后端按历史可工作方案，只订阅：

- `/k1wxaEnEO8L/petInfo/user/get`

### 6.1 DogHouse 字段

从 `payload.items` 中直接读取：

- `EmotionState`

其中 `EmotionState` 当前按以下规则映射并复用于 `/api/emotion/latest`：

- `1` -> `angry` -> `生气`
- `2` -> `anxious` -> `焦虑`
- `3` -> `happy` -> `开心`
- `4` -> `lonely` -> `孤独`
- `5` -> `sad` -> `难过`

### 6.2 PetHouse 字段

从 `payload.items` 中直接读取：

- `PetHouse:Temp`：宠舍环境温度，单位 `°C`
- `PetHouse:Humi`：宠舍湿度，单位 `%`
- `PetHouse:MQ135`：空气质量传感器值
- `PetHouse:CO2`：CO2 浓度，单位 `ppm`
- `PetHouse:CH2O`：甲醛传感器值
- `PetHouse:VOC`：VOC 传感器值
- `PetHouse:Weight`：体重，单位 `kg`
- `PetHouse:Mood`：宠舍情绪枚举值，映射规则与 `EmotionState` 一致

> 注意：`PetHouse:Temp` 是宠舍环境温度；`Collar:temp` 是宠物贴身温度，两个字段不要混用。

### 6.3 Collar 字段

如果 `petInfo` 聚合消息中包含项圈数据，则继续拆分。当前后端只解析真实设备字段名：

- `Collar:BNO085` -> `Collar:BNO085.X` / `Collar:BNO085.Y` / `Collar:BNO085.Z`
- `Collar:GPS` -> `Collar:GPS.Longitude` / `Collar:GPS.Latitude`
- `Collar:MAX30102` -> `Collar:MAX30102.HeartRate` / `Collar:MAX30102.SPO2`
- `Collar:temp` -> `Collar:temp`（宠物贴身温度）

其中 `Collar:MAX30102.HeartRate` 与 `Collar:MAX30102.SPO2` 只应展示正数有效值；如果收到 `-1` 这类设备无效哨兵值，原始消息仍保存到 `mqtt_messages`，但展示指标与历史曲线应忽略该点并回退到最近一次有效值。

### 6.4 真实上报样例

当前解析和入库以以下真实设备 payload 字段为准。

#### DogHouse 情绪上报

```json
{
  "deviceType": "CustomCategory",
  "iotId": "9ptO6My0fuTjW4Q7qiJSk1wxa0",
  "requestId": "1776790843011",
  "checkFailedData": {},
  "productKey": "k1wxaEnEO8L",
  "gmtCreate": 1776790843407,
  "deviceName": "DogHouse",
  "items": {
    "EmotionState": {
      "time": 1776790843378,
      "value": 1
    }
  }
}
```

入库指标：

- `EmotionState`：情绪枚举值，`1` 会映射为 `生气`

#### PetHouse 环境与体重上报

```json
{
  "deviceType": "CustomCategory",
  "iotId": "R5uUcVnhywxOohTc1TtVk1wxa0",
  "requestId": "1776993293172",
  "checkFailedData": {},
  "productKey": "k1wxaEnEO8L",
  "gmtCreate": 1776993291770,
  "deviceName": "Collar",
  "items": {
    "PetHouse:Mood": {
      "time": 1776993291737,
      "value": 3
    },
    "PetHouse:Humi": {
      "time": 1776993291737,
      "value": 88
    },
    "PetHouse:Weight": {
      "time": 1776993291737,
      "value": 24
    },
    "PetHouse:CO2": {
      "time": 1776993291737,
      "value": 411
    },
    "PetHouse:CH2O": {
      "time": 1776993291737,
      "value": 2
    },
    "PetHouse:Temp": {
      "time": 1776993291737,
      "value": 36
    },
    "PetHouse:VOC": {
      "time": 1776993291737,
      "value": 1
    },
    "PetHouse:MQ135": {
      "time": 1776993291737,
      "value": 51
    }
  }
}
```

入库指标：

- `PetHouse:Temp`：宠舍环境温度
- `PetHouse:Humi`：宠舍湿度
- `PetHouse:MQ135`：空气质量传感器值
- `PetHouse:CO2`：CO2 浓度
- `PetHouse:CH2O`：甲醛传感器值
- `PetHouse:VOC`：VOC 传感器值
- `PetHouse:Weight`：体重
- `PetHouse:Mood`：宠舍情绪枚举值

#### Collar 项圈上报

```json
{
  "deviceType": "CustomCategory",
  "iotId": "R5uUcVnhywxOohTc1TtVk1wxa0",
  "requestId": "1776821035980",
  "checkFailedData": {},
  "productKey": "k1wxaEnEO8L",
  "gmtCreate": 1776821035744,
  "deviceName": "Collar",
  "items": {
    "Collar:GPS": {
      "value": {
        "Latitude": 29.402408,
        "Longitude": 106.540257
      },
      "time": 1776821035700
    },
    "Collar:BNO085": {
      "value": {
        "X": 32,
        "Y": 21,
        "Z": 1
      },
      "time": 1776821035700
    },
    "Collar:MAX30102": {
      "value": {
        "HeartRate": 152,
        "SPO2": 98
      },
      "time": 1776821035700
    },
    "Collar:temp": {
      "value": 37,
      "time": 1776821035700
    }
  }
}
```

入库指标：

- `Collar:GPS.Longitude`：经度
- `Collar:GPS.Latitude`：纬度
- `Collar:BNO085.X`：三轴 X
- `Collar:BNO085.Y`：三轴 Y
- `Collar:BNO085.Z`：三轴 Z
- `Collar:MAX30102.HeartRate`：心率
- `Collar:MAX30102.SPO2`：血氧
- `Collar:temp`：宠物贴身温度

#### Collar 心率/血氧无效值样例

实际联调中可能收到以下 payload：

```json
{
  "deviceType": "CustomCategory",
  "iotId": "R5uUcVnhywxOohTc1TtVk1wxa0",
  "requestId": "27241",
  "checkFailedData": {},
  "productKey": "k1wxaEnEO8L",
  "gmtCreate": 1777015387553,
  "deviceName": "Collar",
  "items": {
    "Collar:BNO085": {
      "time": 1777015387546,
      "value": {
        "X": 10.47,
        "Y": 71.74,
        "Z": -12.25
      }
    },
    "Collar:MAX30102": {
      "time": 1777015387546,
      "value": {
        "HeartRate": -1,
        "SPO2": -1
      }
    },
    "Collar:temp": {
      "time": 1777015387546,
      "value": 26.9375
    }
  }
}
```

处理规则：

- `mqtt_messages` 保存完整原始消息，方便追踪设备/平台返回内容。
- `metric_points` 不应把 `HeartRate = -1`、`SPO2 = -1` 当作有效展示指标。
- `/api/telemetry/latest` 和历史曲线应使用最近一次正数有效心率/血氧值。

### 6.5 来源设备识别

优先使用 payload 中的 `deviceName` 识别真实来源设备，例如：

- `Collar`
- `DogHouse`

### 6.6 输出结果

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

- 页面展示用的 `sections` 会先合并最近一条 `device_name = Collar` 与 `device_name = DogHouse` 的消息。
- 如果某个指标在这两条最新消息里缺失，服务端会再用 `metric_points` 中该指标最近一次有效值回填，避免首页因为不同设备上报时间错开而出现心率、血氧、体重、环境数据互相掉值。
- `Collar:MAX30102.HeartRate`、`Collar:MAX30102.SPO2` 遇到 `-1` 等非正数时视为无效采样，不覆盖最近一次有效展示值。
- `receivedAt` 与 `topic` 反映最近一条总体 telemetry 消息时间，可用于判断链路是否持续有新消息。
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

- 给情绪页与项圈页提供统一情绪接口

当前接口采用“DogHouse 实时 `EmotionState` 优先、emotion snapshot 兜底其余字段”的聚合方式。

补充说明：

- 当最新 telemetry 中存在 `EmotionState` 时，`currentMood` 会优先使用实时设备值映射后的中文文案
- `score`、`voice`、`fluctuation`、`history` 仍沿用 `emotion_snapshots` 中的快照数据
- 当 telemetry 暂无 `EmotionState` 时，接口会回退到已有真实 snapshot；仍无数据时返回空状态

---

## 8. 当前验证结果

本地已验证：

1. 服务可正常启动
2. SQLite 数据库可自动创建
3. `/api/health` 可正常返回
4. `/api/emotion/latest` 可在存在 `EmotionState` telemetry 时优先返回实时情绪，同时保留 snapshot 的分数与摘要字段
5. `/api/telemetry/latest`、`/api/telemetry/messages` 在无真实 MQTT 消息时可正常返回空结果
6. 前端 `src/App.vue` 已将 `house` tab 挂接到 `DashboardView`，`social` tab 挂接到 `SocialView`
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

- `http://10.255.115.243:3001/api`

推荐在项目根目录创建 `.env.local`（或 `.env`）覆盖：

```env
VITE_API_BASE_URL=http://10.255.115.243:3001/api
VITE_API_POLL_INTERVAL=5000
```

已提交模板文件：

- `.env.example`

本机联调或同一局域网设备访问时可改为：

- `VITE_API_BASE_URL=http://10.255.115.243:3001/api`

Android 安装包如果直接访问当前服务器 HTTP 接口，已在原生层放行：

- 当前采用 Android 全局明文 HTTP 放行配置（`usesCleartextTraffic=true` + `network_security_config`），可直接访问局域网 HTTP 接口
- 当前服务器地址：`http://10.255.115.243:3001/api`

页面接入情况：

- `DashboardView`：当前作为宠舍照护页，聚合环境、看护、生命体征与情绪状态展示
- `CollarView`：读取 `/api/telemetry/latest`、`/api/telemetry/metrics/Collar%3AMAX30102.HeartRate/history`、`/api/telemetry/location/track`、`/api/emotion/latest`
- `EmotionView`：读取 `/api/emotion/latest`
- `SocialView`：当前作为社交开发中过渡页

旧前端 MQTT 代码（如 `src/composables/useMqtt.js`、`src/services/mqtt/*`）与前端解析文件 `src/utils/pet-house-parser.js` 已从仓库删除；页面主流程当前完全通过 `usePetApi -> moodpaws-server` 获取数据。

### 9.2 下一步优先做的事

1. 启动 `moodpaws-server`
2. 访问 `/api/health` 确认 MQTT 已连接并已订阅
3. 访问 telemetry 相关接口确认真实消息已入库
4. 启动前端，联调 Collar / Emotion / 宠舍页
5. 后续按需要继续推进社交功能开发

### 9.3 前端可优先对接的接口

优先级建议：

1. `GET /api/telemetry/latest`
2. `GET /api/telemetry/metrics/Collar%3AMAX30102.HeartRate/history`
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
- 真实 NFC 社交流程
- 宠舍页真实 API 全量接入

当前版本定位就是后端 MVP + 前端 API 化首版。
