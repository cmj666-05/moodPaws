# MoodPaws IoT 重构任务清单

## 1. 规划与设计
- [x] 创建详细实施计划并获取用户确认
- [x] 确定 UI 配色方案（浅蓝色系：#E0F2FE, #0EA5E9）

## 2. 基础设施建设
- [x] 高德地图配置与加载器 [src/config/amap.js](file:///d:/desktop/moodPaws/src/config/amap.js) / [src/services/amap/loader.js](file:///d:/desktop/moodPaws/src/services/amap/loader.js)
- [x] 前端页面数据入口切换为 `src/composables/usePetApi.js -> moodpaws-server`
- [x] 删除旧前端 MQTT 直连残留文件（`src/composables/useMqtt.js`、`src/services/mqtt/*`、`src/utils/pet-house-parser.js`）

## 3. 清理与重排
- [x] 更新 4 个核心功能 Tab 导航（项圈、寄养屋、情感、社交）
- [x] 创建 App.vue 主壳页面与底部 Tab 导航

## 4. 核心功能页开发 (MQTT 数据驱动)
- [x] **宠物项圈数据页** [CollarView.vue](file:///d:/desktop/moodPaws/src/views/collar/CollarView.vue): 心率/血氧/步数/GPS + 高德地图
- [ ] **寄养屋数据页**: 环境监控 + 智能调节（功能开发中）
- [ ] **情感分析页**: AI 状态 + 多维度分析 + 历史（功能开发中）
- [ ] **NFC 社交页**: NFC 扫描 + 好友 + 社交记录（功能开发中）

## 5. 跨平台适配
- [x] 高德地图 Web 端 + Android 端双平台加载
- [x] 移除 `isAndroidRuntime` 平台限制
- [x] MQTT 连接代码统一（WSS 协议，Web/Android 无差异）
- [x] 运动数据从 X/Y/Z 原始值改为步数估算
- [x] 缩减顶部摘要卡高度，移除 Android 专属提示文字

## 6. 验证
- [x] Web 端页面预览正常（`pnpm run dev`）
- [x] 高德地图 Web 端加载正常
- [x] `pnpm run build` 构建通过
- [ ] Android APK 联调阿里云 IoT 实时数据流
- [ ] 验证安卓打包基座运行情况
