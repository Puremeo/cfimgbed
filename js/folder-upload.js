/**
 * 文件夹拖拽上传支持
 * 支持拖拽文件夹，保持文件夹结构上传
 */

(function() {
    'use strict';

    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // 等待 Vue 应用加载完成
        setTimeout(() => {
            setupFolderUpload();
        }, 1000);
    }

    function setupFolderUpload() {
        // 查找上传区域（通常是拖拽区域）
        const uploadArea = findUploadArea();
        if (!uploadArea) {
            console.warn('未找到上传区域，文件夹拖拽功能可能无法使用');
            return;
        }

        // 使用捕获模式（true）确保我们的监听器先执行
        // 这样可以优先处理文件夹和大文件上传
        uploadArea.addEventListener('dragover', handleDragOver, true);
        uploadArea.addEventListener('dragleave', handleDragLeave, true);
        uploadArea.addEventListener('drop', handleDrop, true);
        
        // 也监听整个文档的拖拽事件作为备用（使用捕获模式）
        document.addEventListener('dragover', handleDragOver, true);
        document.addEventListener('drop', handleDrop, true);
        
        console.log('[文件夹上传] 事件监听器已设置（捕获模式，优先级最高）');
    }

    function findUploadArea() {
        // 尝试多种方式找到上传区域
        // 1. 查找常见的上传组件类名
        const selectors = [
            '.el-upload',
            '.el-upload-dragger',
            '[class*="upload"]',
            '#app'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }

        return document.body;
    }

    function handleDragOver(e) {
        // 检查是否包含文件夹
        const items = e.dataTransfer?.items;
        if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            try {
                // 快速检查是否有文件夹
                let hasDirectory = false;
                for (let i = 0; i < Math.min(items.length, 5); i++) { // 只检查前5个，避免性能问题
                    const entry = items[i].webkitGetAsEntry();
                    if (entry && entry.isDirectory) {
                        hasDirectory = true;
                        break;
                    }
                }
                
                // 只有检测到文件夹时才拦截
                if (hasDirectory) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 添加拖拽样式提示
                    if (e.currentTarget) {
                        e.currentTarget.classList.add('drag-over');
                    }
                }
            } catch (error) {
                // 出错时不拦截，让原有代码处理
            }
        }
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 移除拖拽样式
        if (e.currentTarget) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async function handleDrop(e) {
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            console.log('[文件夹上传] 没有检测到文件');
            return; // 让原有代码处理
        }

        // 检查浏览器是否支持文件夹拖拽
        if (!items[0].webkitGetAsEntry) {
            console.log('[文件夹上传] 浏览器不支持文件夹拖拽，使用原有上传方式');
            return; // 让原有代码处理
        }

        // 检查是否包含文件夹或大文件
        let hasDirectory = false;
        let hasFiles = false;
        const files = [];
        const filePromises = [];
        
        try {
            // 先快速检查是否有文件夹
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) {
                    if (entry.isDirectory) {
                        hasDirectory = true;
                        console.log(`[文件夹上传] 检测到文件夹: ${entry.name}`);
                        break; // 找到文件夹就停止
                    } else if (entry.isFile) {
                        hasFiles = true;
                        // 异步读取文件信息
                        filePromises.push(
                            new Promise((resolve) => {
                                entry.file((file) => {
                                    files.push({ file, path: file.name });
                                    resolve();
                                }, (error) => {
                                    console.warn('[文件夹上传] 读取文件失败:', error);
                                    resolve();
                                });
                            })
                        );
                    }
                }
            }
        } catch (error) {
            console.warn('[文件夹上传] 检查文件类型时出错:', error);
            return; // 出错时让原有代码处理
        }

        // 如果检测到文件夹，立即拦截并处理
        if (hasDirectory) {
            console.log('[文件夹上传] 开始处理文件夹上传');
            
            // 阻止事件传播
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // 移除拖拽样式
            if (e.currentTarget) {
                e.currentTarget.classList.remove('drag-over');
            }
            
            // 处理文件夹上传
            try {
                await handleFolderUpload(items);
            } catch (error) {
                console.error('[文件夹上传] 上传失败:', error);
                showMessage('文件夹上传失败: ' + error.message, 'error');
            }
            return;
        }

        // 如果只有文件，等待文件信息读取完成后再决定
        if (hasFiles && filePromises.length > 0) {
            // 等待所有文件读取完成
            await Promise.all(filePromises);
            
            // 检查是否有大文件（> 20MB）
            const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
            const hasLargeFile = files.some(f => f.file.size > CHUNK_SIZE);
            
            if (hasLargeFile && files.length > 0) {
                console.log(`[文件夹上传] 检测到大文件 (${files.length}个，最大 ${(Math.max(...files.map(f => f.file.size)) / 1024 / 1024).toFixed(2)}MB)，使用分块上传`);
                
                // 阻止事件传播
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // 移除拖拽样式
                if (e.currentTarget) {
                    e.currentTarget.classList.remove('drag-over');
                }
                
                // 使用我们的上传逻辑处理大文件
                try {
                    showUploadProgress(files.length);
                    await uploadFilesSequentially(files);
                } catch (error) {
                    console.error('[文件夹上传] 大文件上传失败:', error);
                    showMessage('大文件上传失败: ' + error.message, 'error');
                }
                return;
            } else {
                // 小文件，让原有的文件上传逻辑处理
                console.log(`[文件夹上传] 检测到小文件 (${files.length}个，最大 ${files.length > 0 ? (Math.max(...files.map(f => f.file.size)) / 1024 / 1024).toFixed(2) : 0}MB)，使用原有上传方式`);
                // 不阻止事件，让原有代码处理
                return;
            }
        }
        
        // 如果既没有文件夹也没有文件，让原有代码处理
        console.log('[文件夹上传] 未检测到可处理的文件');
    }

    async function handleFolderUpload(items) {
        try {
            // 第一步：完整扫描文件夹结构，获取所有文件列表
            updateUploadProgress(0, 0, '正在扫描文件夹结构...');
            
            const files = [];
            const filePromises = [];

            // 遍历所有拖拽项
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (!entry) continue;

                if (entry.isDirectory) {
                    // 递归处理文件夹
                    filePromises.push(processDirectoryEntry(entry, '', files));
                } else if (entry.isFile) {
                    // 处理单个文件（直接拖拽的文件，没有文件夹结构）
                    filePromises.push(processFileEntry(entry, '', files));
                }
            }

            // 等待所有文件扫描完成
            await Promise.all(filePromises);

            if (files.length === 0) {
                console.warn('未找到可上传的文件');
                showMessage('未找到可上传的文件', 'warning');
                hideUploadProgress();
                return;
            }

            // 第二步：按文件大小排序，先上传小文件，再上传大文件
            // 这样可以更快看到进度，大文件在后台慢慢上传
            files.sort((a, b) => a.file.size - b.file.size);

            // 显示扫描结果
            const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
            const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`扫描完成: 找到 ${files.length} 个文件，总大小 ${totalSizeMB}MB`);

            // 显示上传进度提示
            showUploadProgress(files.length, totalSizeMB);

            // 第三步：按顺序逐个上传文件（不并行，避免卡顿）
            await uploadFilesSequentially(files);
        } catch (error) {
            console.error('处理文件夹上传时出错:', error);
            showMessage('处理文件夹时出错: ' + error.message, 'error');
            hideUploadProgress();
        }
    }

    async function processDirectoryEntry(entry, basePath, files) {
        const dirReader = entry.createReader();
        const entries = [];

        // 读取目录内容
        return new Promise((resolve) => {
            const readEntries = () => {
                dirReader.readEntries((results) => {
                    if (results.length === 0) {
                        // 所有条目已读取完成
                        // 处理所有条目
                        const promises = entries.map(entry => {
                            const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
                            if (entry.isDirectory) {
                                return processDirectoryEntry(entry, fullPath, files);
                            } else {
                                return processFileEntry(entry, basePath, files);
                            }
                        });
                        Promise.all(promises).then(() => resolve());
                    } else {
                        entries.push(...results);
                        readEntries(); // 继续读取
                    }
                });
            };
            readEntries();
        });
    }

    async function processFileEntry(entry, basePath, files) {
        return new Promise((resolve) => {
            entry.file((file) => {
                // 创建带有路径信息的文件对象
                const relativePath = basePath ? `${basePath}/${file.name}` : file.name;
                files.push({
                    file: file,
                    path: relativePath
                });
                resolve();
            }, (error) => {
                console.error('读取文件失败:', error);
                resolve();
            });
        });
    }

    function showUploadProgress(totalFiles, totalSizeMB = '') {
        // 移除已存在的进度条
        const existing = document.getElementById('folder-upload-progress');
        if (existing) {
            existing.remove();
        }

        // 创建新的进度提示元素
        const progressDiv = document.createElement('div');
        progressDiv.id = 'folder-upload-progress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            line-height: 1.5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const sizeText = totalSizeMB ? ` (${totalSizeMB}MB)` : '';
        progressDiv.textContent = `准备上传 ${totalFiles} 个文件${sizeText}...`;
        document.body.appendChild(progressDiv);
    }

    function updateUploadProgress(current, total, detail = '') {
        const progressDiv = document.getElementById('folder-upload-progress');
        if (progressDiv) {
            const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0;
            const detailText = detail ? `\n${detail}` : '';
            progressDiv.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">
                    正在上传: ${current}/${total} (${progressPercent}%)
                </div>
                <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8); word-break: break-all;">
                    ${detailText || '准备中...'}
                </div>
            `;
        }
    }

    function hideUploadProgress() {
        const progressDiv = document.getElementById('folder-upload-progress');
        if (progressDiv) {
            setTimeout(() => {
                progressDiv.remove();
            }, 2000);
        }
    }

    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'rgba(244, 67, 54, 0.9)' : type === 'warning' ? 'rgba(255, 152, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 400px;
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    async function uploadFilesSequentially(files) {
        const total = files.length;
        let successCount = 0;
        let failCount = 0;
        const failedFiles = [];
        let uploadedSize = 0;
        const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

        // 获取上传配置
        const uploadConfig = getUploadConfig();

        // 逐个上传文件，确保顺序执行
        for (let i = 0; i < files.length; i++) {
            const { file, path } = files[i];
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            const uploadedMB = (uploadedSize / 1024 / 1024).toFixed(2);
            const totalMB = (totalSize / 1024 / 1024).toFixed(2);
            
            // 更新进度：显示当前文件、进度百分比、已上传大小
            const progressPercent = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
            updateUploadProgress(
                i + 1, 
                total, 
                `${path} (${fileSizeMB}MB) - 总进度: ${progressPercent}% (${uploadedMB}MB/${totalMB}MB)`
            );

            try {
                // 上传单个文件，传入进度回调
                await uploadSingleFile(file, path, uploadConfig, (chunkProgress) => {
                    // 分块上传进度回调
                    if (chunkProgress) {
                        if (chunkProgress.merging) {
                            updateUploadProgress(
                                i + 1, 
                                total, 
                                `${path} - 正在合并分块...`
                            );
                        } else if (chunkProgress.waiting) {
                            updateUploadProgress(
                                i + 1, 
                                total, 
                                `${path} - 等待合并完成...`
                            );
                        } else {
                            const chunkPercent = Math.round((chunkProgress.current / chunkProgress.total) * 100);
                            updateUploadProgress(
                                i + 1, 
                                total, 
                                `${path} - 分块 ${chunkProgress.current}/${chunkProgress.total} (${chunkPercent}%)`
                            );
                        }
                    }
                });
                
                successCount++;
                uploadedSize += file.size;
                
                // 更新总进度
                const finalProgressPercent = totalSize > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
                updateUploadProgress(
                    i + 1, 
                    total, 
                    `✓ ${path} - 总进度: ${finalProgressPercent}%`
                );
            } catch (error) {
                console.error(`上传文件失败 ${path}:`, error);
                failCount++;
                failedFiles.push({ path, error: error.message, size: fileSizeMB });
                
                // 即使失败，也更新已上传大小（用于进度计算）
                uploadedSize += file.size;
            }

            // 小文件之间添加短暂延迟，大文件之间添加稍长延迟
            if (i < files.length - 1) {
                const delay = file.size > 20 * 1024 * 1024 ? 500 : 200;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 显示完成提示
        const progressDiv = document.getElementById('folder-upload-progress');
        if (progressDiv) {
            if (failCount > 0) {
                progressDiv.textContent = `上传完成: 成功 ${successCount}, 失败 ${failCount}`;
                progressDiv.style.background = 'rgba(255, 152, 0, 0.9)';
                console.warn('失败的文件:', failedFiles);
                
                // 显示失败文件详情
                if (failedFiles.length > 0) {
                    const failedList = failedFiles.map(f => `  - ${f.path}: ${f.error}`).join('\n');
                    console.error('失败文件详情:\n' + failedList);
                }
            } else {
                progressDiv.textContent = `上传完成: 成功 ${successCount} 个文件`;
                progressDiv.style.background = 'rgba(76, 175, 80, 0.9)';
            }
        }

        hideUploadProgress();

        // 触发页面刷新（如果应用支持）
        triggerRefresh();
    }

    async function uploadSingleFile(file, relativePath, config, progressCallback) {
        // 检查文件大小，超过 20MB 使用分块上传
        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
        const useChunked = file.size > CHUNK_SIZE;

        if (useChunked) {
            return await uploadFileChunked(file, relativePath, config, progressCallback);
        } else {
            return await uploadFileDirect(file, relativePath, config);
        }
    }

    async function uploadFileDirect(file, relativePath, config) {
        const formData = new FormData();
        
        // 提取文件名和文件夹路径
        const pathParts = relativePath.split('/');
        const fileName = pathParts[pathParts.length - 1]; // 只取文件名
        const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
        
        // 文件名包含完整路径（后端会从文件名中提取路径作为备用）
        const fileWithPath = new File([file], relativePath, {
            type: file.type,
            lastModified: file.lastModified
        });
        
        formData.append('file', fileWithPath);

        // 构建上传 URL，确保传递文件夹路径
        const uploadUrl = buildUploadUrl(relativePath, folderPath, config);

        // 发送上传请求
        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            headers: getUploadHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传失败: ${errorText}`);
        }

        return await response.json();
    }

    async function uploadFileChunked(file, relativePath, config, progressCallback) {
        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        const baseUrl = window.location.origin;
        
        // 调试信息：检查文件大小和分块数量
        console.log(`[文件夹上传] 文件: ${relativePath}, 大小: ${fileSizeMB}MB, 分块数: ${totalChunks}`);
        
        // 前端检查：如果分块数超过200，提前提示
        if (totalChunks > 200) {
            const maxSizeGB = (200 * 20 / 1024).toFixed(1);
            throw new Error(`文件过大: ${fileSizeMB}MB (${totalChunks}个分块)，超过最大限制 ${maxSizeGB}GB (200个分块)`);
        }
        
        try {
            // 1. 初始化分块上传
            const initFormData = new FormData();
            initFormData.append('originalFileName', relativePath);
            initFormData.append('originalFileType', file.type || 'application/octet-stream');
            initFormData.append('totalChunks', totalChunks.toString());

            const initUrl = new URL('/upload', baseUrl);
            initUrl.searchParams.set('initChunked', 'true');
            if (config && config.uploadChannel) {
                initUrl.searchParams.set('uploadChannel', config.uploadChannel);
            }

            const initResponse = await fetch(initUrl.toString(), {
                method: 'POST',
                body: initFormData,
                headers: getUploadHeaders()
            });

            if (!initResponse.ok) {
                const errorText = await initResponse.text();
                throw new Error(`初始化分块上传失败: ${errorText}`);
            }

            const initResult = await initResponse.json();
            const uploadId = initResult.uploadId;

            if (!uploadId) {
                throw new Error('初始化分块上传失败: 未返回 uploadId');
            }

            // 2. 上传所有分块
            const uploadPromises = [];
            let completedChunks = 0;
            
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const chunkFormData = new FormData();
                chunkFormData.append('file', chunk);
                chunkFormData.append('chunkIndex', i.toString());
                chunkFormData.append('totalChunks', totalChunks.toString());
                chunkFormData.append('uploadId', uploadId);
                chunkFormData.append('originalFileName', relativePath);
                chunkFormData.append('originalFileType', file.type || 'application/octet-stream');

                const chunkUrl = new URL('/upload', baseUrl);
                chunkUrl.searchParams.set('chunked', 'true');
                if (config && config.uploadChannel) {
                    chunkUrl.searchParams.set('uploadChannel', config.uploadChannel);
                }

                // 控制并发，每次最多同时上传 3 个分块
                const uploadPromise = fetch(chunkUrl.toString(), {
                    method: 'POST',
                    body: chunkFormData,
                    headers: getUploadHeaders()
                }).then(async (response) => {
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`分块 ${i + 1}/${totalChunks} 上传失败: ${errorText}`);
                    }
                    completedChunks++;
                    // 更新进度
                    if (progressCallback) {
                        progressCallback({ current: completedChunks, total: totalChunks });
                    }
                    return await response.json();
                }).catch((error) => {
                    throw new Error(`分块 ${i + 1}/${totalChunks} 上传失败: ${error.message}`);
                });

                uploadPromises.push(uploadPromise);

                // 每 3 个分块等待一次，避免过多并发
                if ((i + 1) % 3 === 0) {
                    await Promise.all(uploadPromises.slice(-3));
                }
            }

            // 等待所有分块上传完成
            await Promise.all(uploadPromises);

            // 3. 合并分块
            if (progressCallback) {
                progressCallback({ current: totalChunks, total: totalChunks, merging: true });
            }

            // 提取文件夹路径
            const pathParts = relativePath.split('/');
            const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

            const mergeFormData = new FormData();
            mergeFormData.append('uploadId', uploadId);
            mergeFormData.append('totalChunks', totalChunks.toString());
            mergeFormData.append('originalFileName', relativePath); // 完整路径，后端会提取
            mergeFormData.append('originalFileType', file.type || 'application/octet-stream');

            // 设置上传文件夹路径（通过URL参数和FormData双重传递，确保兼容性）
            if (folderPath) {
                mergeFormData.append('uploadFolder', folderPath);
            }

            const mergeUrl = new URL('/upload', baseUrl);
            mergeUrl.searchParams.set('chunked', 'true');
            mergeUrl.searchParams.set('merge', 'true');
            if (folderPath) {
                mergeUrl.searchParams.set('uploadFolder', folderPath);
            }
            if (config && config.uploadChannel) {
                mergeUrl.searchParams.set('uploadChannel', config.uploadChannel);
            }

            const mergeResponse = await fetch(mergeUrl.toString(), {
                method: 'POST',
                body: mergeFormData,
                headers: getUploadHeaders()
            });

            if (!mergeResponse.ok) {
                const errorText = await mergeResponse.text();
                throw new Error(`合并分块失败: ${errorText}`);
            }

            const mergeResult = await mergeResponse.json();

            // 如果返回的是异步处理状态，需要轮询检查状态
            if (mergeResult.status === 'processing' || mergeResult.status === 'merging') {
                if (progressCallback) {
                    progressCallback({ current: totalChunks, total: totalChunks, merging: true, waiting: true });
                }
                return await waitForMergeCompletion(uploadId, baseUrl);
            }

            return mergeResult;
        } catch (error) {
            console.error('分块上传失败:', error);
            throw error;
        }
    }

    async function waitForMergeCompletion(uploadId, baseUrl, maxWaitTime = 300000) {
        const startTime = Date.now();
        const checkInterval = 2000; // 每 2 秒检查一次

        while (Date.now() - startTime < maxWaitTime) {
            const statusUrl = new URL('/upload', baseUrl);
            statusUrl.searchParams.set('statusCheck', 'true');
            statusUrl.searchParams.set('uploadId', uploadId);

            const statusResponse = await fetch(statusUrl.toString(), {
                method: 'GET',
                headers: getUploadHeaders()
            });

            if (statusResponse.ok) {
                const status = await statusResponse.json();
                
                if (status.status === 'success') {
                    return { src: status.result?.[0]?.src || status.result?.src };
                } else if (status.status === 'error' || status.status === 'timeout') {
                    throw new Error(`合并失败: ${status.message || status.error}`);
                }
                // 继续等待 processing 或 merging 状态
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        throw new Error('合并超时: 等待时间超过 5 分钟');
    }

    function buildUploadUrl(relativePath, folderPath, config) {
        // 从当前页面 URL 获取基础路径
        const baseUrl = window.location.origin;
        const uploadPath = '/upload';
        
        const url = new URL(uploadPath, baseUrl);
        
        // 从当前页面 URL 获取 authCode 和其他参数（保持与原有上传逻辑一致）
        const currentUrl = new URL(window.location.href);
        const authCode = currentUrl.searchParams.get('authCode');
        const serverCompress = currentUrl.searchParams.get('serverCompress');
        const uploadNameType = currentUrl.searchParams.get('uploadNameType');
        const autoRetry = currentUrl.searchParams.get('autoRetry');
        
        // 传递认证码（如果存在）
        if (authCode) {
            url.searchParams.set('authCode', authCode);
        }
        
        // 传递其他上传参数（保持与原有逻辑一致）
        if (serverCompress !== null) {
            url.searchParams.set('serverCompress', serverCompress);
        }
        if (uploadNameType) {
            url.searchParams.set('uploadNameType', uploadNameType);
        }
        if (autoRetry !== null) {
            url.searchParams.set('autoRetry', autoRetry);
        }
        
        // 设置上传文件夹路径
        // 如果folderPath已提供，直接使用；否则从relativePath中提取
        let finalFolderPath = folderPath;
        if (!finalFolderPath && relativePath) {
            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) {
                finalFolderPath = pathParts.slice(0, -1).join('/');
            }
        }
        
        // 通过URL参数传递文件夹路径（后端会优先使用此参数）
        if (finalFolderPath) {
            url.searchParams.set('uploadFolder', finalFolderPath);
        }

        // 如果有上传渠道配置，添加到 URL
        if (config && config.uploadChannel) {
            url.searchParams.set('uploadChannel', config.uploadChannel);
        }

        return url.toString();
    }

    function getUploadConfig() {
        // 尝试从 Vue 应用实例中获取配置
        // 这里返回默认配置，实际使用时可能需要根据应用调整
        return {
            uploadChannel: 'telegram' // 默认使用 telegram 渠道
        };
    }

    function getUploadHeaders() {
        // 获取认证头（如果需要）
        const headers = {};
        
        // 1. 尝试从当前页面 URL 获取 authCode
        const currentUrl = new URL(window.location.href);
        const authCode = currentUrl.searchParams.get('authCode');
        
        // 2. 尝试从 localStorage 或 cookie 获取 token
        const token = localStorage.getItem('token') || getCookie('token');
        
        // 3. 设置 Authorization 头（如果存在 token）
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // 4. 设置 authCode 头（如果存在）
        if (authCode) {
            headers['authCode'] = authCode;
        }

        return headers;
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function triggerRefresh() {
        // 尝试触发 Vue 应用的刷新
        // 查找可能的刷新方法或事件
        const event = new CustomEvent('folderUploadComplete');
        window.dispatchEvent(event);
        
        // 如果应用有全局刷新方法，可以调用
        if (window.refreshFileList) {
            window.refreshFileList();
        }
    }

    // 添加 CSS 样式
    const style = document.createElement('style');
    style.textContent = `
        .drag-over {
            background-color: rgba(64, 158, 255, 0.1) !important;
            border-color: #409eff !important;
        }
    `;
    document.head.appendChild(style);

    console.log('文件夹拖拽上传功能已加载');
})();

