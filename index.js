// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const os = require('os');
const convert = require('libreoffice-convert');
const { nativeImage } = require('electron');

async function ensurePngIcon() {
    try {
        const svgPath = path.join(__dirname, 'assets', 'app-icon.svg');
        const pngPath = path.join(__dirname, 'assets', 'app-icon.png');
        if (!fs.existsSync(svgPath)) return;

        let need = true;
        if (fs.existsSync(pngPath)) {
            try {
                const sStat = fs.statSync(svgPath);
                const pStat = fs.statSync(pngPath);
                if (pStat.mtimeMs >= sStat.mtimeMs) need = false;
            } catch (e) {
                need = true;
            }
        }

        if (!need) return;

        const svg = fs.readFileSync(svgPath, 'utf8');
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        const image = nativeImage.createFromDataURL(dataUrl);
        const resized = image.resize({ width: 256, height: 256 });
        const pngBuffer = resized.toPNG();
        fs.writeFileSync(pngPath, pngBuffer);
        console.log('生成 PNG 图标：', pngPath);
    } catch (e) {
        console.log('生成 PNG 图标失败：', e.message);
    }
}

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadFile('index.html');
    // win.webContents.on('did-finish-load', () => {
    //     // 再次检查 win 对象是否仍然有效
    //     if (!win || win.isDestroyed()) {
    //         console.error('尝试打开DevTools时，窗口对象已失效或销毁。');
    //         return;
    //     }
    //     try {
    //         win.webContents.openDevTools();
    //         console.log('DevTools 已成功打开。');
    //     } catch (err) {
    //         console.error('打开 DevTools 失败:', err.message);
    //     }
    // });
};
// 设置应用图标（如果存在 assets/app-icon.png 或 .svg）
try {
    const iconPath = path.join(__dirname, 'assets', 'app-icon.png');
    if (fs.existsSync(iconPath)) {
        // 重新创建窗口时可使用此图标（Windows/ Linux）
        app.whenReady().then(() => {
            BrowserWindow.getAllWindows().forEach(w => w.setIcon(iconPath));
        });
    } else {
        // 尝试 svg
        const svgPath = path.join(__dirname, 'assets', 'app-icon.svg');
        if (fs.existsSync(svgPath)) {
            app.whenReady().then(() => {
                BrowserWindow.getAllWindows().forEach(w => w.setIcon(svgPath));
            });
        }
    }
} catch (e) {
    console.log('设置应用图标失败:', e.message);
}

app.whenReady().then(() => {
    // 在创建窗口前确保 PNG 图标存在
    ensurePngIcon().then(() => createWindow());
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 处理文件选择请求
ipcMain.handle('select-file', async (event, { category }) => {
    try {
        const result = await dialog.showOpenDialog({
            title: '选择要转换的文件',
            properties: ['openFile']
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false };
        }
        
        const filePath = result.filePaths[0];
        const fileName = path.basename(filePath);
        
        return { 
            success: true,
            filePath: filePath,
            fileName: fileName
        };
    } catch (error) {
        return { 
            success: false,
            message: `选择文件失败: ${error.message}` 
        };
    }
});

// 处理文件转换请求
ipcMain.handle('convert-file', async (event, { filePath, targetFormat, category, options }) => {
    try {
        const fileName = path.basename(filePath, path.extname(filePath));
        const newFileName = `${fileName}.${targetFormat.toLowerCase()}`;
        
        // 显示保存文件对话框
        const result = await dialog.showSaveDialog({
            title: '保存转换后的文件',
            defaultPath: path.join(path.dirname(filePath), newFileName),
            filters: [
                { name: targetFormat, extensions: [targetFormat.toLowerCase()] },
                { name: '所有文件', extensions: ['*'] }
            ]
        });
        
        if (result.canceled) {
            return { success: false, message: '操作已取消' };
        }
        
        const outputPath = result.filePath;
        
        // 根据分类调用相应的转换函数
        let extraInfo = null;
        switch (category) {
            case 'images':
                extraInfo = await convertImage(filePath, outputPath, targetFormat, options);
                break;
            case 'documents':
                await convertDocument(filePath, outputPath, targetFormat);
                break;
            case 'videos':
            case 'audio':
                // 暂时使用复制作为示例
                fs.copyFileSync(filePath, outputPath);
                break;
            default:
                fs.copyFileSync(filePath, outputPath);
        }
        
        return { 
            success: true, 
            message: `文件已成功转换并保存至: ${outputPath}`,
            outputPath: outputPath,
            extra: extraInfo
        };
    } catch (error) {
        return { 
            success: false, 
            message: `转换失败: ${error.message}` 
        };
    }
});

// 图片转换函数（使用 ImageMagick CLI，适配 Node.js 22）
async function convertImage(inputPath, outputPath, targetFormat, options) {
    try {
        const format = targetFormat.toLowerCase();
        const { execFileSync } = require('child_process');
        const os = require('os');

        // 检查 magick 是否可用
        try {
            execFileSync('magick', ['-version'], { stdio: 'ignore' });
        } catch (e) {
            throw new Error('未找到 ImageMagick (magick)。请安装 ImageMagick 并确保 magick 在 PATH 中。');
        }

        // ICO 特殊处理：使用 ImageMagick 的 auto-resize 或者按 sizes 生成
        if (format === 'ico') {
            if (options && Array.isArray(options.icoSizes) && options.icoSizes.length > 0) {
                const tmpDir = os.tmpdir();
                const tmpFiles = [];
                for (const sRaw of options.icoSizes) {
                    const s = parseInt(sRaw, 10);
                    if (!s) continue;
                    const tmpPng = path.join(tmpDir, `ft_tmp_${Date.now()}_${s}.png`);
                    execFileSync('magick', [inputPath, '-resize', `${s}x${s}`, '-background', 'none', '-gravity', 'center', '-extent', `${s}x${s}`, tmpPng]);
                    tmpFiles.push(tmpPng);
                }
                if (tmpFiles.length === 0) throw new Error('无效的 ICO 尺寸参数');
                execFileSync('magick', [...tmpFiles, outputPath]);
                // 清理临时文件
                tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
                return { icoSizes: options.icoSizes.map(s => ({ width: s, height: s })) };
            } else {
                execFileSync('magick', [inputPath, '-define', 'icon:auto-resize', outputPath]);
                return { icoSizes: null };
            }
        }

        // 其他格式使用 magick CLI 转换并设置合理参数
        const args = [inputPath];
        if (format === 'jpg' || format === 'jpeg') {
            args.push('-quality', '90', outputPath);
        } else if (format === 'png') {
            args.push('-background', 'none', '-flatten', outputPath);
        } else if (format === 'webp') {
            args.push('-quality', '90', outputPath);
        } else if (format === 'gif') {
            args.push(outputPath);
        } else {
            args.push(outputPath);
        }

        execFileSync('magick', args, { stdio: 'ignore' });
        return null;
    } catch (error) {
        throw new Error(`图片转换失败: ${error.message}`);
    }
}

// 文档转换函数 (使用 LibreOffice)
async function convertDocument(inputPath, outputPath, targetFormat) {
    const format = targetFormat.toLowerCase();
    const ext = '.' + format.replace(/^\./, '');

    // 优先使用 LibreOffice CLI（soffice），更稳定且不依赖 tmp 清理库
    try {
        const { execSync } = require('child_process');
        execSync(`soffice --headless --convert-to ${format} --outdir "${path.dirname(outputPath)}" "${inputPath}"`, { stdio: 'ignore' });

        const generatedName = path.basename(inputPath, path.extname(inputPath)) + '.' + format;
        const tempOutputPath = path.join(path.dirname(outputPath), generatedName);
        if (fs.existsSync(tempOutputPath)) {
            if (tempOutputPath !== outputPath) fs.renameSync(tempOutputPath, outputPath);
            return;
        } else {
            // CLI 没有生成文件，回退到库方法
            throw new Error('LibreOffice CLI 未生成输出文件，回退到库方法');
        }
    } catch (cliErr) {
        // 回退到 libreoffice-convert（使用回调风格以避免 promisify 问题）
        try {
            const fileBuffer = fs.readFileSync(inputPath);
            const convertedBuffer = await new Promise((resolve, reject) => {
                convert.convert(fileBuffer, ext, (err, done) => {
                    if (err) return reject(err);
                    resolve(done);
                });
            });
            fs.writeFileSync(outputPath, convertedBuffer);
            return;
        } catch (libErr) {
            // 返回详细错误，便于排查
            throw new Error(`文档转换失败: CLI 错误: ${cliErr.message}; libreoffice-convert 错误: ${libErr.message}`);
        }
    }
}
// 处理拖拽文件请求
ipcMain.handle('handle-dropped-file', async (event, arrayBuffer, fileName) => {
  // 注意：这里假设你已经正确引入了 fs, path, os 模块
  // const fs = require('fs').promises;
  // const path = require('path');
  // const os = require('os');

  const tempDir = path.join(os.tmpdir(), 'FormatTransformerTemp');
  const tempFilePath = path.join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`);

  try {
    // 1. 确保临时目录存在（使用 Promise 风格的 mkdir）
    await fsp.mkdir(tempDir, { recursive: true });
    
    // 2. 将 ArrayBuffer 写入文件（使用 Promise 风格的 writeFile）
    await fsp.writeFile(tempFilePath, Buffer.from(arrayBuffer));
    
    // 3. 返回结果
    return {
      filePath: tempFilePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('处理拖拽文件失败，详情:', error);
    // 重新抛出错误，让渲染进程能捕获到
    throw new Error(`保存拖拽文件失败: ${error.message}`);
  }
});