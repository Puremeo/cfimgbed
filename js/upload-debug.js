/**
 * 上传调试工具
 * 用于诊断文件上传问题
 */

(function() {
    'use strict';
    
    // 监听所有上传请求
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        const options = args[1] || {};
        
        // 如果是上传请求，记录详细信息
        if (typeof url === 'string' && url.includes('/upload')) {
            console.group('🔍 [上传调试] 上传请求详情');
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
                console.group('📤 [上传调试] 响应详情');
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
        });
    };
    
    console.log('✅ 上传调试工具已加载');
})();

