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

        // 监听拖拽事件
        uploadArea.addEventListener('dragover', handleDragOver, false);
        uploadArea.addEventListener('dragleave', handleDragLeave, false);
        uploadArea.addEventListener('drop', handleDrop, false);
        
        // 也监听整个文档的拖拽事件作为备用
        document.addEventListener('dragover', handleDragOver, false);
        document.addEventListener('drop', handleDrop, false);
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
        e.preventDefault();
        e.stopPropagation();
        
        // 添加拖拽样式提示
        if (e.currentTarget) {
            e.currentTarget.classList.add('drag-over');
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
        e.preventDefault();
        e.stopPropagation();
        
        // 移除拖拽样式
        if (e.currentTarget) {
            e.currentTarget.classList.remove('drag-over');
        }

        const items = e.dataTransfer.items;
        if (!items || items.length === 0) {
            return;
        }

        // 检查浏览器是否支持文件夹拖拽
        if (!items[0].webkitGetAsEntry) {
            console.warn('浏览器不支持文件夹拖拽功能，请使用 Chrome、Edge 或 Firefox 最新版本');
            // 让原有的文件上传逻辑处理
            return;
        }

        // 检查是否包含文件夹
        let hasDirectory = false;
        let hasFiles = false;
        
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) {
                if (entry.isDirectory) {
                    hasDirectory = true;
                } else if (entry.isFile) {
                    hasFiles = true;
                }
            }
        }

        if (hasDirectory) {
            // 处理文件夹上传（包括混合的文件和文件夹）
            await handleFolderUpload(items);
        } else if (hasFiles) {
            // 只有文件，让原有的文件上传逻辑处理
            return;
        }
    }

    async function handleFolderUpload(items) {
        try {
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

            // 等待所有文件处理完成
            await Promise.all(filePromises);

            if (files.length === 0) {
                console.warn('未找到可上传的文件');
                showMessage('未找到可上传的文件', 'warning');
                return;
            }

            // 显示上传进度提示
            showUploadProgress(files.length);

            // 上传所有文件
            await uploadFiles(files);
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

    function showUploadProgress(totalFiles) {
        // 尝试显示上传进度
        // 这里可以创建一个进度提示元素
        const progressDiv = document.createElement('div');
        progressDiv.id = 'folder-upload-progress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        progressDiv.textContent = `准备上传 ${totalFiles} 个文件...`;
        document.body.appendChild(progressDiv);
    }

    function updateUploadProgress(current, total) {
        const progressDiv = document.getElementById('folder-upload-progress');
        if (progressDiv) {
            progressDiv.textContent = `正在上传: ${current}/${total}`;
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

    async function uploadFiles(files) {
        const total = files.length;
        let successCount = 0;
        let failCount = 0;

        // 获取上传配置（从现有代码中获取）
        const uploadConfig = getUploadConfig();

        for (let i = 0; i < files.length; i++) {
            const { file, path } = files[i];
            updateUploadProgress(i + 1, total);

            try {
                await uploadSingleFile(file, path, uploadConfig);
                successCount++;
            } catch (error) {
                console.error(`上传文件失败 ${path}:`, error);
                failCount++;
            }

            // 添加小延迟，避免请求过快
            if (i < files.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // 显示完成提示
        const progressDiv = document.getElementById('folder-upload-progress');
        if (progressDiv) {
            progressDiv.textContent = `上传完成: 成功 ${successCount}, 失败 ${failCount}`;
            progressDiv.style.background = failCount > 0 ? 'rgba(255, 152, 0, 0.9)' : 'rgba(76, 175, 80, 0.9)';
        }

        hideUploadProgress();

        // 触发页面刷新（如果应用支持）
        triggerRefresh();
    }

    async function uploadSingleFile(file, relativePath, config) {
        const formData = new FormData();
        
        // 创建包含路径的文件名
        // 使用 File 构造函数创建新文件，文件名包含完整路径
        const fileWithPath = new File([file], relativePath, {
            type: file.type,
            lastModified: file.lastModified
        });
        
        formData.append('file', fileWithPath);

        // 构建上传 URL
        const uploadUrl = buildUploadUrl(relativePath, config);

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

    function buildUploadUrl(relativePath, config) {
        // 从当前页面 URL 获取基础路径
        const baseUrl = window.location.origin;
        const uploadPath = '/upload';
        
        const url = new URL(uploadPath, baseUrl);
        
        // 设置上传文件夹路径（去掉文件名，只保留目录路径）
        // 后端会从文件名中提取路径，但我们也通过参数传递以确保兼容性
        const pathParts = relativePath.split('/');
        if (pathParts.length > 1) {
            const folderPath = pathParts.slice(0, -1).join('/');
            url.searchParams.set('uploadFolder', folderPath);
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
        // 这里返回空对象，实际使用时可能需要添加认证 token
        const headers = {};
        
        // 尝试从 localStorage 或 cookie 获取 token
        // 这需要根据实际应用的认证方式调整
        const token = localStorage.getItem('token') || getCookie('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
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

