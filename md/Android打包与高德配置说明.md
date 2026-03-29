# MoodPaws Android 打包与高德配置说明

## 1. 当前定位

本项目当前以 `Android App` 为唯一交付目标。

虽然技术栈仍然是 `Vite + Vue 3 + Capacitor`，但页面只围绕 Android WebView 运行场景开发，不再把独立 Web 端作为产品目标。

## 2. 当前高德配置

### 2.1 Key 信息

- Web JS API Key：`593fb07396bf923efa210c56ed8847c3`
- 安全密钥：`b745740303ff49863110a1fcd9243927`
- Android Key：`38df705c5863e34c8345b45520092c5b`

### 2.2 当前代码位置

- 高德配置文件：[src/config/amap.js](/D:/desktop/moodPaws/src/config/amap.js)
- 高德加载器：[src/services/amap/loader.js](/D:/desktop/moodPaws/src/services/amap/loader.js)
- 首页地图区域：[src/views/collar/CollarView.vue](/D:/desktop/moodPaws/src/views/collar/CollarView.vue)
- Android Key 清单配置：[android/app/src/main/AndroidManifest.xml](/D:/desktop/moodPaws/android/app/src/main/AndroidManifest.xml)

### 2.3 当前地图行为

- 地图区域位于首页项圈页的 GPS 卡片
- 当前仅在 `Android` 运行时尝试加载高德地图
- 未收到 GPS 经纬度时显示等待状态
- 高德脚本加载失败时显示错误提示
- 收到 `Longitude` 和 `Latitude` 后，地图会自动落点并居中

## 3. 当前签名配置

### 3.1 keystore 文件

- 文件路径：[android/app/moodpaws-release.jks](/D:/desktop/moodPaws/android/app/moodpaws-release.jks)
- alias：`moodPaws`

### 3.2 Gradle 配置

- 签名配置文件：[android/app/build.gradle](/D:/desktop/moodPaws/android/app/build.gradle)
- 当前 `debug` 和 `release` 都绑定到同一套 `release signingConfig`

说明：

- 这样做的目的是让安卓联调阶段保持同一套签名身份
- 高德 Android Key、SHA1 和 APK 安装验证不会因为 debug/release 切换而频繁变化

## 4. 当前正式签名信息

- 包名：`com.pet.iot`
- SHA1：`02:5F:06:41:C6:1F:36:FB:E8:06:31:60:A8:EE:1C:36:46:CE:BB:F5`

规则：

- 只要后续继续使用同一个 keystore，正式签名 `SHA1` 就不会变
- 只有更换 keystore 或更换证书时，`SHA1` 才会变

## 5. 当前打包结果

已成功生成签名后的正式 APK：

- [android/app/build/outputs/apk/release/app-release.apk](/D:/desktop/moodPaws/android/app/build/outputs/apk/release/app-release.apk)

## 6. 当前打包流程

### 6.1 前端构建

```bash
npm run build
```

### 6.2 同步到 Android 工程

```bash
npx cap sync android
```

### 6.3 生成正式 APK

```bash
cd android
./gradlew assembleRelease
```

## 7. 后续维护要求

1. 不要随意替换 [android/app/moodpaws-release.jks](/D:/desktop/moodPaws/android/app/moodpaws-release.jks)。
2. 若修改包名，必须同时检查高德 Android Key 是否仍然匹配。
3. 若更换 keystore，必须重新确认新的 SHA1，并同步到高德平台。
4. 后续若改为接入高德 Android 原生 SDK，需要单独补充原生依赖、权限与桥接设计，不能直接沿用当前 JS 地图方案的文档描述。
