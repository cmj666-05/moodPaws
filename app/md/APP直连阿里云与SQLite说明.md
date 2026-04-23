# App 直连阿里云与 SQLite 说明

## 当前链路

```text
设备 -> 阿里云 IoT -> App OpenAPI 拉取 -> 本地 SQLite -> 页面展示
```

- 当前状态：App 调用 `QueryDevicePropertyStatus` 或 `QueryDeviceOriginalPropertyStatus`。
- 历史回补：App 调用 `QueryDevicePropertyData` 或 `QueryDeviceOriginalPropertyData`，按本地同步时间增量回补。
- 本地存储：Android 真机使用 `@capacitor-community/sqlite`，浏览器开发环境会退回到 localStorage 缓存。
- 视频：仍使用独立视频地址配置，不经过阿里云 IoT。

## 配置方式

复制 `.env.example` 为 `.env.local`，填写：

```env
VITE_ALIYUN_ACCESS_KEY_ID=your-access-key-id
VITE_ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
VITE_ALIYUN_PRODUCT_KEY=k1wxaEnEO8L
VITE_ALIYUN_DEVICES=Collar,DogHouse
```

如果设备属性已经按物模型正常上报，保持：

```env
VITE_ALIYUN_PROPERTY_QUERY_MODE=standard
```

如果想读取原始属性记录，可改为：

```env
VITE_ALIYUN_PROPERTY_QUERY_MODE=original
```

## 注意

AccessKey 放进 App 包内有泄露风险，正式发布前建议改成 STS 临时凭证或极薄签名服务。当前实现适合开发验证“去后端化 + SQLite 本地缓存”的链路。
