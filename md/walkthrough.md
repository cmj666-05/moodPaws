# 🔧 MoodPaws 开发进度总结

## 最新改动（跨平台适配 + 首页优化）

### CollarView.vue 首页优化

| 改动 | 说明 |
|------|------|
| 移除 X/Y/Z 原始显示 | 不再直接展示三轴加速度计的 X、Y、Z 原始值 |
| 新增步数估算 | 基于加速度计向量幅度变化（`√(x²+y²+z²)`）检测步数 |
| 缩小顶部摘要卡 | 头像 64px→48px，移除 Android 提示文字，缩减 padding 和间距 |
| 移除 Android 平台限制 | `isAndroidRuntime` 替换为 `isNative/isWeb`，地图和 MQTT 不再检测平台 |

### 跨平台兼容

| 运行环境 | 高德地图 | MQTT 连接 | 说明 |
|:---|:---|:---|:---|
| Web 浏览器 | ✅ 正常加载 | ⚠️ 受阿里云 CORS 限制 | 地图可用，MQTT 可能连不上 |
| Android WebView | ✅ 正常加载 | ✅ 正常连接 | 两者均可用 |

### 文件改动清单

| 文件 | 类型 | 说明 |
|------|------|------|
| [CollarView.vue](file:///d:/desktop/moodPaws/src/views/collar/CollarView.vue) | MODIFY | 移除 X/Y/Z、新增步数、缩小摘要卡、移除 Android 限制 |
| [开发步骤文档.md](file:///d:/desktop/moodPaws/md/开发步骤文档.md) | MODIFY | 更新为双平台支持，新增 MQTT Web 兼容说明章节 |
| [Android打包与高德配置说明.md](file:///d:/desktop/moodPaws/md/Android打包与高德配置说明.md) | MODIFY | 更新地图兼容说明，新增 Web 开发章节 |
| [task.md](file:///d:/desktop/moodPaws/md/task.md) | MODIFY | 更新文件路径和任务状态 |

---

## 历史改动

### Step 2: 基础设施建设

| 文件 | 类型 | 说明 |
|------|------|------|
| [src/services/mqtt/config.js](file:///d:/desktop/moodPaws/src/services/mqtt/config.js) | NEW | MQTT 连接配置（Broker URL、petInfo 三元组、Topic） |
| [src/services/mqtt/client.js](file:///d:/desktop/moodPaws/src/services/mqtt/client.js) | NEW | MQTT 客户端工厂（WSS 连接、事件代理） |
| [src/composables/useMqtt.js](file:///d:/desktop/moodPaws/src/composables/useMqtt.js) | NEW | Vue Composable（连接状态、订阅、消息解析） |
| [src/utils/pet-house-parser.js](file:///d:/desktop/moodPaws/src/utils/pet-house-parser.js) | NEW | 消息解析层（PetHouse 平铺 + Collar 嵌套字段兼容） |

### Step 3: 页面结构

| 文件 | 说明 |
|------|------|
| [src/App.vue](file:///d:/desktop/moodPaws/src/App.vue) | 主壳页面，底部 Tab 导航（项圈/寄养屋/情感/社交） |
| [src/views/collar/CollarView.vue](file:///d:/desktop/moodPaws/src/views/collar/CollarView.vue) | 项圈首页（心率、血氧、步数、GPS 地图、实时轨迹） |

### Step 4: 高德地图集成

| 文件 | 说明 |
|------|------|
| [src/config/amap.js](file:///d:/desktop/moodPaws/src/config/amap.js) | Web JS Key + 安全密钥 + Android Key |
| [src/services/amap/loader.js](file:///d:/desktop/moodPaws/src/services/amap/loader.js) | 标准 `<script>` 注入加载，Web/Android 通用 |

## 最终项目结构

```
moodPaws/
├── src/
│   ├── App.vue               # 主壳 + Tab 导航
│   ├── main.js               # 入口
│   ├── style.css              # 全局样式
│   ├── composables/
│   │   └── useMqtt.js         # MQTT Vue Composable
│   ├── config/
│   │   └── amap.js            # 高德地图配置
│   ├── services/
│   │   ├── mqtt/
│   │   │   ├── client.js      # MQTT 客户端
│   │   │   └── config.js      # MQTT 连接参数
│   │   └── amap/
│   │       └── loader.js      # 高德地图加载器
│   ├── utils/
│   │   └── pet-house-parser.js # 双设备消息解析
│   └── views/
│       └── collar/
│           └── CollarView.vue  # 项圈首页
├── android/                    # Capacitor Android 工程
├── md/                         # 项目文档
├── scripts/                    # 测试脚本
├── vite.config.js
└── package.json
```

> [!IMPORTANT]
> MQTT 连接方式为 WSS，Web 端和 Android 端使用完全相同的代码。Web 端可能因阿里云 CORS 限制无法直连 Broker。
