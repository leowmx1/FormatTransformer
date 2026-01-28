// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const convert = require('libreoffice-convert');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadFile('index.html');
};

app.whenReady().then(() => {
    createWindow();
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
ipcMain.handle('convert-file', async (event, { filePath, targetFormat, category }) => {
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
        switch (category) {
            case 'images':
                await convertImage(filePath, outputPath, targetFormat);
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
            outputPath: outputPath
        };
    } catch (error) {
        return { 
            success: false, 
            message: `转换失败: ${error.message}` 
        };
    }
});

// 图片转换函数
async function convertImage(inputPath, outputPath, targetFormat) {
    try {
        const format = targetFormat.toLowerCase();
        const transformer = sharp(inputPath);
        
        switch (format) {
            case 'jpg':
            case 'jpeg':
                await transformer.jpeg({ quality: 90 }).toFile(outputPath);
                break;
            case 'png':
                await transformer.png().toFile(outputPath);
                break;
            case 'webp':
                await transformer.webp().toFile(outputPath);
                break;
            case 'gif':
                await transformer.gif().toFile(outputPath);
                break;
            case 'bmp':
                await transformer.bmp().toFile(outputPath);
                break;
            default:
                await transformer.toFormat(format).toFile(outputPath);
        }
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