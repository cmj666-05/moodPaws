# MQTT 与 OneNet 数据接口技术文档

本文档总结了项目中所有与 MQTT 通讯及 OneNet 云平台数据获取相关的实现细节。

## 1. MQTT 核心配置 (MQTT/mqtt.js)

项目使用标准 MQTT 协议连接 OneNet 平台（中移物联）。

- **服务器地址**: `183.230.40.39`
- **端口**: `6002` (非加密端口)
- **鉴权信息**:
    - **产品ID (Product ID)**: `632518`
    - **设备ID (Device ID)**: `1211991070`
    - **鉴权信息 (Auth Info/Password)**: `s2`
- **Topic 订阅**: 代码中展示了订阅逻辑 `client.subscribe('your_topic')`。
- **依赖库**: `mqtt` ^5.5.3

## 2. 数据获取接口 (OneNet HTTP API)

项目不仅使用 MQTT 实时通讯，还通过 OneNet 的 REST API 获取设备数据。

### 核心函数逻辑 (MQTT/server.js & MQTT/request.js)
- **API URL**: `https://api.heclouds.com/devices/${deviceId}/datapoints`
- **请求方法**: GET
- **Header**: 必须携带 `api-key` (`drthqklaGJLbWUb7ABYEBh=P8Q0=`)
- **常见数据流 ID (dataStreamId)**:
    - `V_val1`, `Weight1`, `In1`, `Temp1`, `Out1`, `Humi1`
    - `altitude`, `light`, `rainLastHour`, `winddir`, `temp`, `eCO2`, `windspeed`

## 3. 后端代理服务器 (MQTT/server.js)

为了解决前端跨域问题，项目实现了一个简略的 Express 中转服务器。

- **运行端口**: `3000` (或环境变量 PORT)
- **路由**: `GET/POST /getData`
- **功能**:
    - 接收客户端传来的 `dataStreamIdList`, `apiKey`, `deviceId`。
    - 循环请求 OneNet API。
    - 格式化返回数据，将多个数据流合并为一个 JSON 对象，例如 `{ [deviceId]: { Temp1: {...}, Weight1: {...} } }`。

## 4. 前端集成 (myapp/src/...)

### 数据存储 (myapp/src/store/bee1Data.js)
- 使用 Pinia 管理状态。
- `refreshData` 动作负责定时请求 `http://localhost:3000/getData`。

### 视图组件调用
- **detailLeft.vue**: 定时（每7秒）获取 `V_val1` (电压/电量?), `Weight1` (重量), `Temp1` (温度), `Humi1` (湿度) 等。
- **itemOne.vue**: 获取环境参数如 `altitude` (海拔), `light` (光照), `temp` (温度), `eCO2` (二氧化碳) 等。

---

## 5. 关于设备历史信息获取 (重点关注)

> [!IMPORTANT]
> **经过代码审计，关于“获取设备历史信息”的结论如下：**

1. **现有能力**:
    - 当前使用的 API 接口 `https://api.heclouds.com/devices/${deviceId}/datapoints` 是 OneNet 获取数据点的主要接口，**理论上支持历史查询**。
    - 但是，目前的实现代码中**仅提取了返回结果的第一条数据** (`item.datapoints[0]`)，这通常是该数据流的最新的一个点。

2. **缺失功能**:
    - 代码中**没有**传递 `start` (开始时间), `end` (结束时间) 或 `limit` (限制数量) 等查询参数。
    - 因此，当前的程序**只能获取实时数据**，无法主动按时间范围回溯历史数据。

3.  **UI 中的“伪”历史数据**:
    - 在 `detailCenterPage.vue` (蜜蜂出入量统计) 和 `detailFive.vue` (声音采集波形) 等组件中，数据是**硬编码的模拟数据** (Mock Data) 或通过 `Math.random()` 随机生成的，并非从后台接口获取的真实历史记录。
    - `detailCenterPage.vue` 中定义了 20 条模拟的时间点数据用于图表展示。

4. **建议改进方向**:
    - 若需实现真实历史记录查询，需要修改 `server.js` 中的 `getData` 函数，支持在 URL 后追加 `&start=YYYY-MM-DDTHH:MM:SS&end=...`。
