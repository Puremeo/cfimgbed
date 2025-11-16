/**
 * 上传功能增强
 * 自动将大文件（>20MB）转换为分块上传，解决原有上传逻辑的文件大小限制问题
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
        // 立即设置基础拦截（不等待 Vue 加载）
        setupUploadEnhancement();
        
        // 等待 Vue 应用加载完成后再次设置（确保拦截到 Vue 组件）
        setTimeout(() => {
            setupVueInterception();
        }, 2000);
    }

    function setupVueInterception() {
        // 再次尝试拦截 Vue 组件的错误提示（Vue 应用可能延迟加载）
        if (window.ElMessage && !window.ElMessage._enhanced) {
            const originalError = window.ElMessage.error;
            window.ElMessage.error = function(message) {
                if (typeof message === 'string' && (message.includes('文件过大') || message.includes('无法上传'))) {
                    console.log('[上传增强] 拦截到文件大小错误提示，已自动处理');
                    return;
                }
                return originalError.apply(this, arguments);
            };
            window.ElMessage._enhanced = true;
        }

        // 使用 MutationObserver 监听 DOM 变化，拦截错误消息的显示
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // 检查是否是错误消息元素
                        const text = node.textContent || node.innerText || '';
                        if (text.includes('文件过大') || text.includes('无法上传')) {
                            console.log('[上传增强] 检测到错误消息 DOM，已自动移除');
                            // 延迟移除，确保消息不会显示
                            setTimeout(() => {
                                if (node.parentNode) {
                                    node.parentNode.removeChild(node);
                                }
                            }, 0);
                        }
                    }
                });
            });
        });

        // 开始观察 body 的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function setupUploadEnhancement() {
        // 拦截文件输入和验证（最早拦截）
        interceptFileValidation();
        
        // 拦截 XMLHttpRequest（Axios 使用）
        interceptXHR();
        
        // 拦截 fetch（如果原有逻辑使用 fetch）
        interceptFetch();
        
        console.log('[上传增强] 大文件自动分块上传功能已启用');
    }

    // 拦截文件验证逻辑
    function interceptFileValidation() {
        // 拦截文件输入元素的 change 事件
        document.addEventListener('change', function(e) {
            if (e.target.type === 'file' && e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                if (file && file.size > 20 * 1024 * 1024) {
                    console.log(`[上传增强] 检测到大文件选择: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                    // 不阻止，让文件正常选择，但会在上传时自动转换为分块上传
                }
            }
        }, true);

        // 拦截 Element Plus 的 ElMessage 错误提示
        if (window.ElMessage) {
            const originalError = window.ElMessage.error;
            window.ElMessage.error = function(message) {
                if (typeof message === 'string' && (message.includes('文件过大') || message.includes('无法上传'))) {
                    console.log('[上传增强] 拦截到文件大小错误提示，已自动处理');
                    // 不显示错误，因为会在上传时自动转换为分块上传
                    return;
                }
                return originalError.apply(this, arguments);
            };
        }

        // 拦截可能的全局错误消息函数
        if (window.Message && window.Message.error) {
            const originalError = window.Message.error;
            window.Message.error = function(message) {
                if (typeof message === 'string' && (message.includes('文件过大') || message.includes('无法上传'))) {
                    console.log('[上传增强] 拦截到文件大小错误提示，已自动处理');
                    return;
                }
                return originalError.apply(this, arguments);
            };
        }

        // 拦截 console.error 中的错误消息（某些组件可能使用）
        const originalConsoleError = console.error;
        console.error = function(...args) {
            const message = args.join(' ');
            if (message.includes('文件过大') || message.includes('无法上传')) {
                console.log('[上传增强] 拦截到文件大小错误日志，已自动处理');
                // 不输出错误日志
                return;
            }
            return originalConsoleError.apply(console, args);
        };
    }

    // 拦截 XMLHttpRequest
    function interceptXHR() {
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._enhancementUrl = url;
            this._enhancementMethod = method;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };

        XMLHttpRequest.prototype.send = function(data) {
            const url = this._enhancementUrl;
            const method = this._enhancementMethod;
            const xhr = this;

            // 检查是否是上传请求
            if (method === 'POST' && typeof url === 'string' && url.includes('/upload') && !url.includes('chunked=true') && !url.includes('initChunked=true')) {
                // 检查是否是 FormData
                if (data instanceof FormData) {
                    const file = data.get('file');
                    if (file && file.size > 20 * 1024 * 1024) {
                        // 文件大于 20MB，使用分块上传
                        console.log(`[上传增强] 检测到大文件: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，自动转换为分块上传`);
                        
                        // 异步处理分块上传
                        (async () => {
                            try {
                                const result = await handleChunkedUpload(file, url, data, xhr);
                                
                                // 模拟 XHR 响应
                                xhr.status = 200;
                                xhr.statusText = 'OK';
                                xhr.responseText = typeof result === 'string' ? result : JSON.stringify(result);
                                xhr.response = xhr.responseText;
                                
                                // 触发 load 事件
                                if (xhr.onload) {
                                    xhr.onload(new Event('load'));
                                }
                                if (xhr.addEventListener) {
                                    xhr.dispatchEvent(new Event('load'));
                                }
                                
                                // 触发 loadend 事件
                                if (xhr.onloadend) {
                                    xhr.onloadend(new Event('loadend'));
                                }
                                if (xhr.addEventListener) {
                                    xhr.dispatchEvent(new Event('loadend'));
                                }
                            } catch (error) {
                                console.error('[上传增强] 分块上传失败:', error);
                                
                                // 模拟错误响应
                                xhr.status = 500;
                                xhr.statusText = 'Internal Server Error';
                                xhr.responseText = error.message;
                                xhr.response = xhr.responseText;
                                
                                // 触发错误事件
                                if (xhr.onerror) {
                                    xhr.onerror(new ErrorEvent('error', { message: error.message }));
                                }
                                if (xhr.addEventListener) {
                                    xhr.dispatchEvent(new ErrorEvent('error', { message: error.message }));
                                }
                            }
                        })();
                        
                        return;
                    }
                }
            }

            // 正常请求，使用原有逻辑
            return originalXHRSend.apply(this, [data]);
        };
    }

    // 拦截 fetch
    function interceptFetch() {
        const originalFetch = window.fetch;
        
        window.fetch = async function(url, options = {}) {
            // 检查是否是上传请求
            if (options.method === 'POST' && typeof url === 'string' && url.includes('/upload') && !url.includes('chunked=true') && !url.includes('initChunked=true')) {
                // 检查是否是 FormData
                if (options.body instanceof FormData) {
                    const file = options.body.get('file');
                    if (file && file.size > 20 * 1024 * 1024) {
                        // 文件大于 20MB，使用分块上传
                        console.log(`[上传增强] 检测到大文件: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，自动转换为分块上传`);
                        
                        // 使用分块上传
                        return await handleChunkedUpload(file, url, options.body, null, options);
                    }
                }
            }

            // 正常请求，使用原有逻辑
            return originalFetch.apply(this, arguments);
        };
    }

    // 处理分块上传
    async function handleChunkedUpload(file, originalUrl, originalFormData, xhr, fetchOptions = {}) {
        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        const baseUrl = window.location.origin;

        // 检查文件大小限制
        if (totalChunks > 200) {
            const maxSizeGB = (200 * 20 / 1024).toFixed(1);
            const errorMsg = `文件过大: ${fileSizeMB}MB (${totalChunks}个分块)，超过最大限制 ${maxSizeGB}GB (200个分块)`;
            throw new Error(errorMsg);
        }

        try {
            // 1. 初始化分块上传
            const initFormData = new FormData();
            initFormData.append('originalFileName', file.name);
            initFormData.append('originalFileType', file.type || 'application/octet-stream');
            initFormData.append('totalChunks', totalChunks.toString());

            // 从原始 URL 中提取参数
            const originalUrlObj = new URL(originalUrl, baseUrl);
            const uploadChannel = originalUrlObj.searchParams.get('uploadChannel') || 'telegram';
            const authCode = originalUrlObj.searchParams.get('authCode');
            const uploadFolder = originalUrlObj.searchParams.get('uploadFolder');

            const initUrl = new URL('/upload', baseUrl);
            initUrl.searchParams.set('initChunked', 'true');
            initUrl.searchParams.set('uploadChannel', uploadChannel);
            if (authCode) {
                initUrl.searchParams.set('authCode', authCode);
            }
            if (uploadFolder) {
                initUrl.searchParams.set('uploadFolder', uploadFolder);
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
                chunkFormData.append('originalFileName', file.name);
                chunkFormData.append('originalFileType', file.type || 'application/octet-stream');

                const chunkUrl = new URL('/upload', baseUrl);
                chunkUrl.searchParams.set('chunked', 'true');
                chunkUrl.searchParams.set('uploadChannel', uploadChannel);
                if (authCode) {
                    chunkUrl.searchParams.set('authCode', authCode);
                }

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
                    return await response.json();
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
            const mergeFormData = new FormData();
            mergeFormData.append('uploadId', uploadId);
            mergeFormData.append('totalChunks', totalChunks.toString());
            mergeFormData.append('originalFileName', file.name);
            mergeFormData.append('originalFileType', file.type || 'application/octet-stream');
            if (uploadFolder) {
                mergeFormData.append('uploadFolder', uploadFolder);
            }

            const mergeUrl = new URL('/upload', baseUrl);
            mergeUrl.searchParams.set('chunked', 'true');
            mergeUrl.searchParams.set('merge', 'true');
            mergeUrl.searchParams.set('uploadChannel', uploadChannel);
            if (uploadFolder) {
                mergeUrl.searchParams.set('uploadFolder', uploadFolder);
            }
            if (authCode) {
                mergeUrl.searchParams.set('authCode', authCode);
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
                return await waitForMergeCompletion(uploadId, baseUrl);
            }

            // 返回与原有上传格式一致的响应
            // 如果 mergeResult 是数组格式（原有上传返回格式），直接返回
            // 否则包装成数组格式
            const responseData = Array.isArray(mergeResult) ? mergeResult : (mergeResult.src ? [mergeResult] : mergeResult);
            
            if (xhr) {
                // 如果是 XHR，返回 JSON 字符串，由 XHR 拦截器处理
                return JSON.stringify(responseData);
            } else {
                // 如果是 fetch，返回 Response 对象
                return new Response(JSON.stringify(responseData), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (error) {
            console.error('[上传增强] 分块上传失败:', error);
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
                const statusResult = await statusResponse.json();
                if (statusResult.status === 'completed') {
                    return statusResult;
                } else if (statusResult.status === 'failed') {
                    throw new Error(statusResult.error || '合并失败');
                }
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        throw new Error('等待合并超时');
    }

    function getUploadHeaders() {
        const headers = {};
        const currentUrl = new URL(window.location.href);
        const authCode = currentUrl.searchParams.get('authCode');
        const token = localStorage.getItem('token') || getCookie('token');

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
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
})();

