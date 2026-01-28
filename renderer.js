// renderer.js - 渲染进程中的DOM操作和事件处理

// Toast 通知函数
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// 定义各分类的格式列表
const formatMap = {
    'images': ['PNG', 'JPG', 'JPEG', 'GIF', 'BMP', 'WEBP', 'SVG', 'ICO'],
    'videos': ['MP4', 'AVI', 'MKV', 'MOV', 'FLV', 'WebM', 'WMV'],
    'audio': ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A', 'WMA'],
    'documents': ['PDF', 'DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT', 'TXT']
};

// 获取分类的中文名称
const categoryNameMap = {
    'images': '图片',
    'videos': '视频',
    'audio': '音频',
    'documents': '文档'
};

// 构建文件扩展名到分类的反向映射
const extensionToCategoryMap = {};
Object.entries(formatMap).forEach(([category, formats]) => {
    formats.forEach(format => {
        extensionToCategoryMap[format.toLowerCase()] = category;
    });
});

// 检测文件所属的分类
function detectFileCategory(fileName) {
    if (!fileName) return null;
    const extension = fileName.split('.').pop().toLowerCase();
    return extensionToCategoryMap[extension] || null;
}

// 处理文件选择并自动切换分类
function handleFileSelection(result, currentCategory, sidebarButtons) {
    if (!result.filePath) return false;
    
    const detectedCategory = detectFileCategory(result.fileName);
    
    // 如果检测到的分类与当前分类不同，则自动切换
    if (detectedCategory && detectedCategory !== currentCategory) {
        // 触发对应分类按钮的点击事件
        const targetButton = Array.from(sidebarButtons).find(
            btn => btn.getAttribute('data-category') === detectedCategory
        );
        if (targetButton) {
            showToast(`📁 已自动切换到${categoryNameMap[detectedCategory]}分类`, 'info', 3000);
            setTimeout(() => {
                targetButton.click();
                // 在新分类加载后，重新获取dropZone并设置文件
                setTimeout(() => {
                    const dropZone = document.getElementById('dropZone');
                    const selectedFileName = document.getElementById('selectedFileName');
                    if (dropZone && selectedFileName) {
                        selectedFileName.textContent = `✓ 已选择: ${result.fileName}`;
                        dropZone.classList.remove('dragover');
                    }
                }, 100);
            }, 200);
            return true; // 返回true表示已切换分类
        }
    }
    return false; // 返回false表示没有切换分类
}

document.addEventListener('DOMContentLoaded', () => {
    // 选择器和事件监听器
    const sidebarButtons = document.querySelectorAll('.sidebar-button');
    const mainContent = document.querySelector('.main-content');
    let selectedFilePath = null;
    let currentCategory = null;

    // 侧边栏按钮点击事件
    sidebarButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const category = event.target.getAttribute('data-category');
            currentCategory = category;
            
            // 移除所有按钮的active类
            sidebarButtons.forEach(btn => btn.classList.remove('active'));
            // 给选中的按钮添加active类
            event.target.classList.add('active');
            
            loadContent(category);
        });
    });

    // 加载内容到主容器
    function loadContent(category) {
        selectedFilePath = null; // 重置文件选择
        const categoryName = categoryNameMap[category] || category;
        const formats = formatMap[category] || [];
        
        let formatOptions = formats.map(format => `<option value="${format}">${format}</option>`).join('');
        
        mainContent.innerHTML = `
            <h1>${categoryName} 转换</h1>
            <div class="operation-container">
                <div class="form-group">
                    <label>📂 选择或拖拽文件:</label>
                    <div id="dropZone" class="drop-zone">
                        <div class="drop-zone-content">
                            <div class="drop-zone-icon">📥</div>
                            <div class="drop-zone-text">点击选择或拖拽文件到此</div>
                            <span id="selectedFileName" class="selected-file-name"></span>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="targetFormat">🎯 目标格式:</label>
                    <select id="targetFormat">
                        <option value="">-- 请选择目标格式 --</option>
                        ${formatOptions}
                    </select>
                </div>
                <div class="form-group" id="icoOptions" style="display:none;">
                    <label>📏 ICO 分辨率（单选）:</label>
                    <div>
                        <label><input type="radio" name="icoSize" value="multi" checked> 多尺寸（16,32,48,64,128,256）</label>
                        <label><input type="radio" name="icoSize" value="16"> 16×16</label>
                        <label><input type="radio" name="icoSize" value="32"> 32×32</label>
                        <label><input type="radio" name="icoSize" value="48"> 48×48</label>
                        <label><input type="radio" name="icoSize" value="64"> 64×64</label>
                        <label><input type="radio" name="icoSize" value="128"> 128×128</label>
                        <label><input type="radio" name="icoSize" value="256"> 256×256</label>
                    </div>
                    <div style="margin-top:6px;color:#666;font-size:13px;">💡 选择"多尺寸"生成常用尺寸集合，或选择单一尺寸。</div>
                </div>
                <button id="startConversion">✨ 开始转换</button>
            </div>
        `;
        
        // 重新获取新添加的元素并添加事件监听器
        const dropZone = document.getElementById('dropZone');
        const selectedFileName = document.getElementById('selectedFileName');
        const newStartButton = document.getElementById('startConversion');
        const targetFormatSelect = document.getElementById('targetFormat');
        const icoOptions = document.getElementById('icoOptions');
        
        // 点击选择文件
        dropZone.addEventListener('click', async () => {
            const result = await window.electronAPI.selectFile(category);
            if (result.filePath) {
                // 检查是否需要自动切换分类
                const switched = handleFileSelection(result, category, sidebarButtons);
                if (!switched) {
                    // 如果没有切换分类，直接设置文件
                    selectedFilePath = result.filePath;
                    selectedFileName.textContent = `✓ 已选择: ${result.fileName}`;
                    dropZone.classList.remove('dragover');
                } else {
                    // 如果切换了分类，在事件处理中已设置文件
                    selectedFilePath = result.filePath;
                }
            } else {
                showToast('文件选择已取消', 'info');
            }
        });

        // 拖拽事件处理
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const filePath = file.path || file.name;
                if (!filePath) {
                    showToast('无法获取文件路径，请使用点击选择', 'error');
                    return;
                }
                
                // 检查是否需要自动切换分类
                const result = { filePath: filePath, fileName: file.name };
                const switched = handleFileSelection(result, category, sidebarButtons);
                if (!switched) {
                    // 如果没有切换分类，直接设置文件
                    selectedFilePath = filePath;
                    selectedFileName.textContent = `✓ 已选择: ${file.name}`;
                } else {
                    // 如果切换了分类，在事件处理中已设置文件
                    selectedFilePath = filePath;
                }
            }
        });
        
        // 点击开始转换按钮
        newStartButton.addEventListener('click', () => {
            if (!selectedFilePath) {
                showToast('请先选择一个文件', 'error');
                return;
            }
            if (!targetFormatSelect.value) {
                showToast('请先选择目标格式', 'error');
                return;
            }
            const targetFormat = targetFormatSelect.value;

            // 收集 ICO 选项（单选）
            let options = {};
            if (category === 'images' && targetFormat.toLowerCase() === 'ico') {
                const selected = icoOptions.querySelector('input[name="icoSize"]:checked');
                if (selected) {
                    if (selected.value === 'multi') {
                        // 不设置 options.icoSizes 表示使用默认多尺寸集合
                    } else {
                        options.icoSizes = [parseInt(selected.value, 10)];
                    }
                }
            }

            showToast('正在转换文件，请稍候...', 'info', 999999);
            convertFile(selectedFilePath, category, targetFormat, options);
        });

        // 显示/隐藏 ICO 分辨率选项
        targetFormatSelect.addEventListener('change', (e) => {
            if (category === 'images' && e.target.value.toLowerCase() === 'ico') {
                icoOptions.style.display = 'block';
            } else {
                icoOptions.style.display = 'none';
            }
        });
    }

    // 文件转换功能
    function convertFile(filePath, category, targetFormat, options = {}) {
        console.log(`开始进行 ${categoryNameMap[category]} 转换: ${filePath} -> ${targetFormat}`, options);
        
        // 调用主进程的转换函数
        window.electronAPI.convertFile(filePath, targetFormat, category, options)
            .then(result => {
                // 移除正在转换的 toast
                const toasts = document.querySelectorAll('.toast.info');
                toasts.forEach(t => t.remove());

                if (result.success) {
                    let msg = '✓ 转换成功！';
                    if (result.extra && result.extra.icoSizes) {
                        const sizes = result.extra.icoSizes.map(s => `${s.width}×${s.height}`).join(', ');
                        msg += `\n📦 包含尺寸: ${sizes}`;
                    }
                    showToast(msg, 'success', 5000);
                } else {
                    showToast(`✗ 转换失败: ${result.message}`, 'error', 5000);
                }
            })
            .catch(error => {
                // 移除正在转换的 toast
                const toasts = document.querySelectorAll('.toast.info');
                toasts.forEach(t => t.remove());
                
                showToast(`✗ 错误: ${error.message}`, 'error', 5000);
            });
    }
});
