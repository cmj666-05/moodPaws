# MoodPaws IoT 重构任务清单

## 1. 规划与设计
- [x] 创建详细实施计划并获取用户确认
- [x] 确定 UI 配色方案（浅蓝色系：#E0F2FE, #0EA5E9）

## 2. 基础设施建设
- [x] 更新 [variables.scss](file:///d:/desktop/pet/common/styles/variables.scss) 全局变量（粉色改蓝色）
- [x] 引入 `mqtt.js` 及其兼容性处理
- [x] 编写阿里云 IoT MQTT 连接工具类 [utils/mqtt-service.js](file:///d:/desktop/pet/utils/mqtt-service.js)
- [x] 配置 MQTT 连接参数 [utils/mqtt-config.js](file:///d:/desktop/pet/utils/mqtt-config.js)

## 3. 清理与重排
- [x] 删除现有的 4 个子页面（mood-record, health, diet, walk）
- [x] 更新 [pages.json](file:///d:/desktop/pet/pages.json) 注册新的 4 个核心功能页
- [x] 更新底部 TabBar 配置（心情→数据）

## 4. 核心功能页开发 (MQTT 数据驱动)
- [x] **宠物项圈数据页** [collar.vue](file:///d:/desktop/pet/pages/sub/collar/collar.vue): 心率/血氧/体重/GPS + 健康预警
- [x] **寄养屋数据页** [foster.vue](file:///d:/desktop/pet/pages/sub/foster/foster.vue): 环境监控 + slider 智能调节
- [x] **情感分析页** [emotion.vue](file:///d:/desktop/pet/pages/sub/emotion/emotion.vue): AI 状态 + 多维度分析 + 历史
- [x] **NFC 社交页** [social.vue](file:///d:/desktop/pet/pages/sub/social/social.vue): NFC 扫描 + 好友 + 社交记录

## 5. 首页与入口改造
- [x] 重构首页 [index.vue](file:///d:/desktop/pet/pages/index/index.vue) — 4 个 IoT 功能入口 + MQTT 状态
- [x] 重写数据总览页 [mood.vue](file:///d:/desktop/pet/pages/mood/mood.vue) — 实时数据概览 + 数据流
- [x] 全局样式适配（所有 SCSS 文件）

## 6. 验证
- [ ] 联调阿里云 IoT 实时数据流
- [ ] 验证安卓打包基座运行情况
