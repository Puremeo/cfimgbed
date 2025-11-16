/**
 * 上传调试工具
 * 用于诊断文件上传问题
 * 拦截 fetch 和 XMLHttpRequest（Axios 使用）
 */

(function() {
    'use strict';
    
    // 监听所有上传请求 - fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        const options = args[1] || {};
        
        // 如果是上传请求，记录详细信息
        if (typeof url === 'string' && url.includes('/upload')) {
            console.group('🔍 [上传调试] Fetch 请求');
            console.log('URL:', url);
            console.log('Method:', options.method || 'GET');
            console.log('Headers:', options.headers);
            
            if (options.body instanceof FormData) {
                console.log('Body: FormData');
                // 尝试获取文件信息
                const file = options.body.get('file');
                if (file) {
                    console.log('文件信息:', {
                        name: file.name,
                        size: file.size,
                        sizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
                        type: file.type
                    });
                }
                
                // 获取其他参数
                const totalChunks = options.body.get('totalChunks');
                const chunkIndex = options.body.get('chunkIndex');
                const uploadId = options.body.get('uploadId');
                if (totalChunks) {
                    console.log('分块信息:', {
                        totalChunks: totalChunks,
                        chunkIndex: chunkIndex,
                        uploadId: uploadId
                    });
                }
            }
            console.groupEnd();
        }
        
        // 调用原始 fetch
        return originalFetch.apply(this, args).then(response => {
            if (typeof url === 'string' && url.includes('/upload')) {
                console.group('📤 [上传调试] Fetch 响应');
                console.log('Status:', response.status, response.statusText);
                console.log('Headers:', Object.fromEntries(response.headers.entries()));
                
                // 克隆响应以便读取内容
                const clonedResponse = response.clone();
                clonedResponse.text().then(text => {
                    try {
                        const json = JSON.parse(text);
                        console.log('Response Body:', json);
                    } catch {
                        console.log('Response Body (text):', text.substring(0, 200));
                    }
                }).catch(() => {});
                
                console.groupEnd();
            }
            return response;
        }).catch(error => {
            if (typeof url === 'string' && url.includes('/upload')) {
                console.error('❌ [上传调试] Fetch 错误:', error);
            }
            throw error;
        });
    };
    
    // 监听所有上传请求 - XMLHttpRequest (Axios 使用)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._debugUrl = url;
        this._debugMethod = method;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const url = this._debugUrl;
        const method = this._debugMethod;
        
        // 如果是上传请求，记录详细信息
        if (typeof url === 'string' && url.includes('/upload')) {
            console.group('🔍 [上传调试] XHR 请求 (Axios)');
            console.log('URL:', url);
            console.log('Method:', method);
            console.log('Headers:', this.getAllResponseHeaders ? this.getAllResponseHeaders() : 'N/A');
            
            if (data instanceof FormData) {
                console.log('Body: FormData');
                // 尝试获取文件信息
                const file = data.get('file');
                if (file) {
                    console.log('文件信息:', {
                        name: file.name,
                        size: file.size,
                        sizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
                        type: file.type
                    });
                }
                
                // 获取其他参数
                const totalChunks = data.get('totalChunks');
                const chunkIndex = data.get('chunkIndex');
                const uploadId = data.get('uploadId');
                if (totalChunks) {
                    console.log('分块信息:', {
                        totalChunks: totalChunks,
                        chunkIndex: chunkIndex,
                        uploadId: uploadId
                    });
                }
            }
            console.groupEnd();
            
            // 监听响应
            this.addEventListener('load', function() {
                if (typeof url === 'string' && url.includes('/upload')) {
                    console.group('📤 [上传调试] XHR 响应');
                    console.log('Status:', this.status, this.statusText);
                    console.log('Response:', this.responseText?.substring(0, 500));
                    console.groupEnd();
                }
            });
            
            // 监听错误
            this.addEventListener('error', function() {
                if (typeof url === 'string' && url.includes('/upload')) {
                    console.error('❌ [上传调试] XHR 错误:', {
                        status: this.status,
                        statusText: this.statusText,
                        response: this.responseText?.substring(0, 500)
                    });
                }
            });
        }
        
        return originalXHRSend.apply(this, [data]);
    };
    
    console.log('✅ 上传调试工具已加载（支持 Fetch 和 XHR/Axios）');
})();

