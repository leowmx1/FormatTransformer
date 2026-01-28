// renderer.js - 渲染进程中的DOM操作和事件处理

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

document.addEventListener('DOMContentLoaded', () => {
    // 选择器和事件监听器
    const sidebarButtons = document.querySelectorAll('.sidebar-button');
    const mainContent = document.querySelector('.main-content');
    let selectedFilePath = null;

    // 侧边栏按钮点击事件
    sidebarButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const category = event.target.getAttribute('data-category');
            loadContent(category);
        });
    });

    // 加载内容到主容器
    function loadContent(category) {
        const categoryName = categoryNameMap[category] || category;
        const formats = formatMap[category] || [];
        
        let formatOptions = formats.map(format => `<option value="${format}">${format}</option>`).join('');
        
        mainContent.innerHTML = `
            <h1>${categoryName} 转换</h1>
            <div class="operation-container">
                <div class="form-group">
                    <label for="selectFileBtn">选择文件:</label>
                    <button id="selectFileBtn" class="select-file-btn">选择文件</button>
                    <span id="selectedFileName" class="selected-file-name"></span>
                </div>
                <div class="form-group">
                    <label for="targetFormat">目标格式:</label>
                    <select id="targetFormat">
                        <option value="">-- 请选择目标格式 --</option>
                        ${formatOptions}
                    </select>
                </div>
                <div class="form-group" id="icoOptions" style="display:none;">
                    <label>ICO 分辨率:</label>
                    <div>
                        <label><input type="checkbox" value="16"> 16</label>
                        <label><input type="checkbox" value="32"> 32</label>
                        <label><input type="checkbox" value="48"> 48</label>
                        <label><input type="checkbox" value="64"> 64</label>
                        <label><input type="checkbox" value="128"> 128</label>
                        <label><input type="checkbox" value="256"> 256</label>
                    </div>
                    <div style="margin-top:6px;color:#666;font-size:13px;">如果没有选择，将使用常用分辨率集合。</div>
                </div>
                <button id="startConversion">开始转换</button>
            </div>
        `;
        
        // 重新获取新添加的元素并添加事件监听器
        const selectFileBtn = document.getElementById('selectFileBtn');
        const selectedFileName = document.getElementById('selectedFileName');
        const newStartButton = document.getElementById('startConversion');
        const targetFormatSelect = document.getElementById('targetFormat');
        const icoOptions = document.getElementById('icoOptions');
        
        // 点击选择文件按钮
        selectFileBtn.addEventListener('click', async () => {
            const result = await window.electronAPI.selectFile(category);
            if (result.filePath) {
                selectedFilePath = result.filePath;
                selectedFileName.textContent = `已选择: ${result.fileName}`;
            }
        });
        
        // 点击开始转换按钮
        newStartButton.addEventListener('click', () => {
            if (!selectedFilePath) {
                alert('请先选择一个文件');
                return;
            }
            if (!targetFormatSelect.value) {
                alert('请先选择目标格式');
                return;
            }
            const targetFormat = targetFormatSelect.value;

            // 收集 ICO 选项
            let options = {};
            if (category === 'images' && targetFormat.toLowerCase() === 'ico') {
                const checked = Array.from(icoOptions.querySelectorAll('input[type=checkbox]:checked')).map(n => parseInt(n.value, 10));
                if (checked.length > 0) options.icoSizes = checked;
            }

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
                if (result.success) {
                    let msg = result.message;
                    if (result.extra && result.extra.icoSizes) {
                        const sizes = result.extra.icoSizes.map(s => `${s.width}x${s.height}`).join(', ');
                        msg += `\n包含尺寸: ${sizes}`;
                    }
                    alert(msg);
                } else {
                    alert(result.message);
                }
            })
            .catch(error => {
                alert(`转换失败: ${error.message}`);
            });
    }
});
