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
| **属性上报** | `/sys/${productKey}/${deviceName}/thing/event/property/post` | 设备端 (DHT11) 发布数据 |
| **属性设置** | `/sys/${productKey}/${deviceName}/thing/service/property/set` | 云端/App 下发指令 |
| **数据拉取** | `/sys/${productKey}/${deviceName}/thing/property/get` | App 主动查询当前状态 |

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
