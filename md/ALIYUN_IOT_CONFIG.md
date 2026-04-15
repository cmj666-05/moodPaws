# 阿里云 IoT 平台连接配置备份

> [!IMPORTANT]
> 这是当前项目的阿里云 IoT 凭证备份。在切换到新框架（如 Capacitor/Vite）时，请务必参考此配置进行初始化。

## 1. 核心接入信息

| 参数项 | 配置值 | 说明 |
| :--- | :--- | :--- |
| **Broker Host** | `iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com` | 阿里云 MQTT 公网接入点 |
| **WSS Port** | `443` | WebSocket (Secure) 端口 |
| **TCP Port** | `1883` | 原生 MQTT 协议端口 |
| **Region** | `cn-shanghai` | (根据 Host 自动识别) |

## 2. 设备三元组 (Web 客户端)

该凭证用于网页端或手机 App (webapp) 作为客户端登录阿里云并监听数据。

注意：`webapp` 是前端专用虚拟身份，不是物理传感器设备。`DHT11` 负责上报数据，前端负责以 `webapp` 身份连接。

*   **ProductKey**: `k1wxakcs6OI`
*   **DeviceName**: `webapp`
*   **DeviceSecret**: `03a0edc6d46dd71a4eecd81ec95f5bd0`

## 3. 关联硬件设备信息

*   **设备名称**: `DHT11` (温湿度传感器)
*   **所属产品**: `k1wxakcs6OI`
*   **主要功能**: 上报实时温度、湿度、属性监控。

## 4. 关键 Topic 设计 (物模型)

| 功能 | Topic 模板 | 说明 |
| :--- | :--- | :--- |
| **属性上报** | `/sys/${productKey}/${deviceName}/thing/event/property/post` | 设备端发布标准物模型属性数据 |
| **属性设置** | `/sys/${productKey}/${deviceName}/thing/service/property/set` | 云端/App 下发指令 |
| **数据拉取** | `/sys/${productKey}/${deviceName}/thing/property/get` | App 主动查询当前状态 |

### 当前项目确认过的真实设备三元组

#### 设备 1：Collar
- **ProductKey**: `k1wxaEnEO8L`
- **DeviceName**: `Collar`
- **DeviceSecret**: `d0f539f63f5f2435bbb7e03eb0c242a6`

#### 设备 2：DogHouse
- **ProductKey**: `k1wxaEnEO8L`
- **DeviceName**: `DogHouse`
- **DeviceSecret**: `34a4637e16f6063de2b0c84d32bb92b8`

#### 设备 3：petInfo（转发接收端）
- **ProductKey**: `k1wxaEnEO8L`
- **DeviceName**: `petInfo`
- **DeviceSecret**: `53e62471edfbf70c7b225dd260ca7d4e`

### 当前项目已确认的真实 Topic

#### 1. 历史上已验证可工作的聚合接收 Topic（petInfo）
```text
/k1wxaEnEO8L/petInfo/user/get
```

说明：
- `petInfo` 是历史上已验证可工作的虚拟接收设备。
- 前端/后端使用 `petInfo` 身份连接 MQTT，并只订阅这一个聚合 Topic。
- 真实来源设备通过消息体中的 `deviceName` 区分，例如 `Collar`、`DogHouse`。

#### 2. 标准物模型属性上报 Topic（Collar）
```text
/sys/k1wxaEnEO8L/Collar/thing/event/property/post
```

示例消息：
```json
{"id":1775312215911,"params":{"PetHouse:Temp":34,"PetHouse:Humi":43,"PetHouse:MQ135":43,"PetHouse:CO2":433,"PetHouse:CH2O":3,"PetHouse:VOC":4,"PetHouse:Weight":43},"version":"1.0","method":"thing.event.property.post"}
```

#### 3. 标准物模型属性上报 Topic（DogHouse）
```text
/sys/k1wxaEnEO8L/DogHouse/thing/event/property/post
```

示例消息：
```json
{"id":1775312787332,"params":{"PetHouse:Temp":43,"PetHouse:Humi":34,"PetHouse:MQ135":43,"PetHouse:CO2":433,"PetHouse:CH2O":4,"PetHouse:VOC":4,"PetHouse:Weight":43},"version":"1.0","method":"thing.event.property.post"}
```

### 当前统一字段解析
当前按历史可工作方案，统一从 `payload.items` 解析字段。

环境字段：
- `PetHouse:Temp`：温度
- `PetHouse:Humi`：湿度
- `PetHouse:MQ135`：MQ135 传感器值
- `PetHouse:CO2`：CO2
- `PetHouse:CH2O`：甲醛
- `PetHouse:VOC`：VOC
- `PetHouse:Weight`：重量

项圈扩展字段（如果 petInfo 聚合消息里携带）：
- `Collar:XYZ` -> `X/Y/Z`
- `Collar:GPS` -> `Longitude/Latitude`
- `Collar:XKXY` -> `HeartRate/SPO2`

当前本地联调用 mock 数据时，也应尽量保持与原库一致的聚合入库风格：
- Topic 使用 `/k1wxaEnEO8L/petInfo/user/get`
- `payload.deviceName` 使用真实来源设备名，如 `Collar`、`DogHouse`
- 指标继续放在 `payload.items` 下
- 如需模拟更丰富的九轴原始数据，可在 `payload.items` 中附带额外运动字段，但当前正式解析链路稳定消费的仍是 `Collar:XYZ` / `Collar:GPS` / `Collar:XKXY` / `PetHouse:*`

### 当前排查结论

- 当前前端正式链路恢复为历史上已验证可工作的 `petInfo` 单 Topic 方案。
- 当前后端 MQTT 订阅目标应为：`/k1wxaEnEO8L/petInfo/user/get`。
- 当前后端解析应按 `payload.items` 处理，并通过消息体中的 `deviceName` 区分真实来源设备。
- 直接订阅两个标准物模型 Topic（`/sys/.../thing/event/property/post`）的方案在当前后端订阅身份下未打通，暂不作为正式接入方案。
- 直接订阅两个转发后的设备 Topic（`/k1wxaEnEO8L/Collar/...`、`/k1wxaEnEO8L/DogHouse/...`）在当前后端订阅身份下也未验证打通，因此不作为当前正式方案。
- `.../thing/event/property/post_reply` 是上报成功回执，只能用于链路确认，不能作为页面业务数据源。
- 当前项目正式页面数据链路走 `src/composables/usePetApi.js -> moodpaws-server`，后端订阅与解析应与历史可工作链路保持一致。
- 当前后端已多次复验：`connack` 成功、`suback` 成功，`/api/health` 返回 `connected=true`、`subscribed=true`。
- 持续观察约 2 分钟期间已收到真实 MQTT 消息，说明当前链路不仅能连上，而且能稳定接收数据。
- 现阶段没有证据表明存在固定的“同设备名互踢”“旧连接占用”或“broker 握手失败”问题；若后续再次出现异常，应优先查看当时的 `/api/health` 与服务日志。
- 如果后续 Topic 选择或字段含义发生变化，需要继续同步更新本文档。

## 5. 连接逻辑参考 (HMAC-SHA256)

在新的开发环境中，连接签名生成内容应遵循以下格式：

```javascript
// 签名内容
const signContent = `clientId${productKey}.${deviceName}deviceName${deviceName}productKey${productKey}`;
// 签名结果
const password = HMAC_SHA256(signContent, deviceSecret);
// Username
const username = `${deviceName}&${productKey}`;
// ClientID (securemode=2 表示使用 TLS)
const clientId = `${productKey}.${deviceName}|securemode=2,signmethod=hmacsha256|`;
```

---
*备份时间: 2026-03-17*
