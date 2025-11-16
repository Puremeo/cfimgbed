# 文件上传限制检查清单

## 已修改的位置

### ✅ 后端限制（已修改为 200 个分块 = 4GB）

1. **`functions/upload/chunkUpload.js` 第 24-28 行**
   - `initializeChunkedUpload` 函数
   - 检查：`if (totalChunks > 200)`
   - ✅ 已修改

2. **`functions/upload/chunkUpload.js` 第 1029 行**
   - `uploadLargeFileToTelegram` 函数
   - 检查：`if (totalChunks > 200)`
   - ✅ 已修改

### ✅ 前端限制（已添加 200 个分块检查）

1. **`js/folder-upload.js` 第 498-501 行**
   - `uploadFileChunked` 函数
   - 检查：`if (totalChunks > 200)`
   - ✅ 已添加

## 验证步骤

### 1. 检查代码是否正确部署

```bash
# 检查后端文件
grep -n "totalChunks > 200" functions/upload/chunkUpload.js
# 应该显示两处：第 25 行和第 1029 行

# 检查前端文件
grep -n "totalChunks > 200" js/folder-upload.js
# 应该显示：第 498 行
```

### 2. 清除浏览器缓存

- 按 `Ctrl + Shift + Delete` 清除缓存
- 或使用无痕模式测试

### 3. 查看控制台日志

上传文件时，控制台应该显示：
- `[文件夹上传] 检测到文件夹: xxx`
- `[文件夹上传] 文件: xxx, 大小: xxxMB, 分块数: xxx`
- `🔍 [上传调试] 上传请求详情`（如果加载了调试工具）

### 4. 检查错误信息

- **前端错误**：`文件过大: xxxMB (xxx个分块)，超过最大限制 xxxGB (200个分块)`
- **后端错误**：`Error: File too large (exceeds xxxGB limit, current: xxx chunks)`

## 可能的问题

1. **代码未部署**：修改只在本地的 `functions/upload/chunkUpload.js`，需要部署到 Cloudflare
2. **浏览器缓存**：浏览器可能缓存了旧的 JavaScript 代码
3. **原有上传组件限制**：如果使用原有的上传组件（不是文件夹上传），可能有其他限制

## 调试工具

已添加 `js/upload-debug.js` 调试工具，会在控制台显示：
- 所有上传请求的详细信息
- 文件大小和分块数量
- 响应状态和错误信息

## 文件大小计算

- 1GB = 1024MB
- 1GB 文件 = 1024MB / 20MB = 51.2 个分块 ✅ 可以通过
- 4GB = 4096MB
- 4GB 文件 = 4096MB / 20MB = 204.8 个分块 ❌ 超过限制

## 当前限制

- **最大分块数**：200
- **最大文件大小**：200 × 20MB = 4000MB = 3.9GB
- **实际可用**：约 3.9GB（略小于 4GB）

