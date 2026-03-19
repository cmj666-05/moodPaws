# 🔧 Steps 2 & 3 完成总结

## 改动概览

### Step 2: 基础设施建设

| 文件 | 类型 | 说明 |
|------|------|------|
| [utils/mqtt-config.js](file:///d:/desktop/pet/utils/mqtt-config.js) | NEW | MQTT 连接配置（接入点、三元组、Topic 模板） |
| [utils/mqtt-service.js](file:///d:/desktop/pet/utils/mqtt-service.js) | NEW | MQTT 服务类（WSS连接、HMAC-SHA256鉴权、订阅/发布、自动重连） |
| [main.js](file:///d:/desktop/pet/main.js) | MODIFY | 挂载 `$mqtt` 全局属性 |
| [App.vue](file:///d:/desktop/pet/App.vue) | MODIFY | [onLaunch](file:///d:/desktop/pet/App.vue#5-10) 自动连接 MQTT |

### Step 3: 清理与重排

| 操作 | 文件 |
|------|------|
| ❌ 删除 | `pages/sub/mood-record/` (2文件) |
| ❌ 删除 | `pages/sub/health/` (2文件) |
| ❌ 删除 | `pages/sub/diet/` (2文件) |
| ❌ 删除 | `pages/sub/walk/` (2文件) |
| ✅ 新建 | [pages/sub/collar/collar.vue](file:///d:/desktop/pet/pages/sub/collar/collar.vue) — 宠物项圈 |
| ✅ 新建 | [pages/sub/foster/foster.vue](file:///d:/desktop/pet/pages/sub/foster/foster.vue) — 寄养屋 |
| ✅ 新建 | [pages/sub/emotion/emotion.vue](file:///d:/desktop/pet/pages/sub/emotion/emotion.vue) — 情感分析 |
| ✅ 新建 | [pages/sub/social/social.vue](file:///d:/desktop/pet/pages/sub/social/social.vue) — NFC 社交 |
| ✅ 更新 | [pages.json](file:///d:/desktop/pet/pages.json) — 新路由 + TabBar "数据" |

### 额外完成: Tab 页更新
| 文件 | 改动 |
|------|------|
| [index.vue](file:///d:/desktop/pet/pages/index/index.vue) | 4 个 IoT 功能入口 + MQTT 状态面板 |
| [mood.vue](file:///d:/desktop/pet/pages/mood/mood.vue) | 改为数据总览页（实时概览 + 数据流） |

## 最终项目结构
```
pet/
├── common/styles/         # 全局样式（蓝色主题）
├── pages/
│   ├── index/             # Tab: 首页
│   ├── mood/              # Tab: 数据总览
│   ├── mine/              # Tab: 我的
│   └── sub/
│       ├── collar/        # 宠物项圈（MQTT Sub）
│       ├── foster/        # 寄养屋（MQTT Sub + Pub）
│       ├── emotion/       # 情感分析（MQTT Sub）
│       └── social/        # NFC 社交（MQTT Sub）
├── utils/
│   ├── mqtt-config.js     # 连接配置
│   └── mqtt-service.js    # MQTT 服务单例
├── App.vue, main.js, pages.json ...
```

> [!IMPORTANT]
> 使用前请在 [utils/mqtt-config.js](file:///d:/desktop/pet/utils/mqtt-config.js) 中替换 `ProductKey`, `DeviceName`, `DeviceSecret` 为真实设备三元组。
