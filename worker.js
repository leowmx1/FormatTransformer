const { parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');
const convert = require('libreoffice-convert');
const os = require('os');

parentPort.on('message', async (task) => {
    const { filePath, outputPath, targetFormat, category, options, ffmpegPath } = task;

    try {
        let extraInfo = null;
        // Report start
        parentPort.postMessage({ type: 'progress', value: 5 });

        switch (category) {
            case 'images':
                extraInfo = await convertImage(filePath, outputPath, targetFormat, options);
                break;
            case 'videos':
                await convertVideo(filePath, outputPath, targetFormat, options, ffmpegPath);
                break;
            case 'audio':
                await convertAudio(filePath, outputPath, targetFormat, options, ffmpegPath);
                break;
            case 'documents':
                await convertDocument(filePath, outputPath, targetFormat);
                break;
            default:
                fs.copyFileSync(filePath, outputPath);
        }

        parentPort.postMessage({ type: 'progress', value: 100 });
        parentPort.postMessage({ 
            type: 'success', 
            outputPath: outputPath,
            extra: extraInfo
        });
    } catch (error) {
        parentPort.postMessage({ 
            type: 'error', 
            message: error.message 
        });
    }
});

async function convertImage(inputPath, outputPath, targetFormat, options) {
    try {
        const format = targetFormat.toLowerCase();

        // Check magick
        try {
            execFileSync('magick', ['-version'], { stdio: 'ignore' });
        } catch (e) {
            throw new Error('未找到 ImageMagick (magick)。请安装 ImageMagick 并确保 magick 在 PATH 中。');
        }

        parentPort.postMessage({ type: 'progress', value: 20 });

        // ICO Special Handling
        if (format === 'ico') {
            if (options && Array.isArray(options.icoSizes) && options.icoSizes.length > 0) {
                const tmpDir = os.tmpdir();
                const tmpFiles = [];
                // 排序尺寸，从小到大排列是 ICO 的标准做法
                const sortedSizes = [...options.icoSizes].sort((a, b) => a - b);
                const totalSizes = sortedSizes.length;
                
                for (let i = 0; i < totalSizes; i++) {
                    const s = parseInt(sortedSizes[i], 10);
                    if (!s) continue;
                    
                    // 为每个尺寸生成一个唯一的临时文件名
                    const tmpPng = path.join(tmpDir, `ft_tmp_${Date.now()}_${s}_${i}.png`);
                    
                    // 使用 magick 将原图调整为指定尺寸的 PNG
                    // -background none -gravity center -extent ${s}x${s} 确保即使原图比例不对也能生成正方形
                    execFileSync('magick', [
                        inputPath, 
                        '-resize', `${s}x${s}`, 
                        '-background', 'none', 
                        '-gravity', 'center', 
                        '-extent', `${s}x${s}`, 
                        tmpPng
                    ]);
                    tmpFiles.push(tmpPng);
                    
                    const progress = 20 + Math.round(((i + 1) / totalSizes) * 60);
                    parentPort.postMessage({ type: 'progress', value: progress });
                }
                
                if (tmpFiles.length === 0) throw new Error('无效的 ICO 尺寸参数');
                
                parentPort.postMessage({ type: 'progress', value: 85 });
                
                // 将所有临时 PNG 合并为一个多图层的 ICO
                execFileSync('magick', [...tmpFiles, outputPath]);
                
                // 清理临时文件
                tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
                
                return { icoSizes: sortedSizes.map(s => ({ width: s, height: s })) };
            } else {
                // ... 默认处理逻辑 ...
            }
        }

        // Other formats
        const args = [inputPath];
        
        // Apply resize if provided
        if (options && (options.width || options.height)) {
            const w = options.width || '';
            const h = options.height || '';
            args.push('-resize', `${w}x${h}`);
        }

        const quality = options && options.quality !== undefined ? options.quality : 90;

        if (format === 'jpg' || format === 'jpeg') {
            args.push('-quality', quality.toString());
            args.push(outputPath);
        } else if (format === 'png') {
            args.push('-background', 'none', '-flatten', outputPath);
        } else if (format === 'webp') {
            // WebP 默认处理，不再传递可能失效的 quality 参数
            args.push(outputPath);
        } else if (format === 'gif') {
            args.push(outputPath);
        } else {
            args.push(outputPath);
        }

        parentPort.postMessage({ type: 'progress', value: 50 });
        execFileSync('magick', args, { stdio: 'ignore' });
        
        return null;
    } catch (error) {
        throw new Error(`图片转换失败: ${error.message}`);
    }
}

async function convertVideo(inputPath, outputPath, targetFormat, options, ffmpegPath) {
    return new Promise((resolve, reject) => {
        const args = ['-i', inputPath, '-y'];

        // 视频分辨率
        if (options.videoRes) {
            args.push('-vf', `scale=${options.videoRes}`);
        }

        // 视频预设
        if (options.videoPreset) {
            args.push('-preset', options.videoPreset);
        }

        // 目标格式特定的编码建议
        const format = targetFormat.toLowerCase();
        if (format === 'mp4') {
            args.push('-c:v', 'libx264', '-c:a', 'aac');
        } else if (format === 'webm') {
            args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
        }

        args.push(outputPath);

        runFFmpeg(ffmpegPath, args, resolve, reject);
    });
}

async function convertAudio(inputPath, outputPath, targetFormat, options, ffmpegPath) {
    return new Promise((resolve, reject) => {
        const args = ['-i', inputPath, '-y'];

        // 音频码率
        if (options.audioBitrate) {
            args.push('-b:a', options.audioBitrate);
        }

        args.push(outputPath);

        runFFmpeg(ffmpegPath, args, resolve, reject);
    });
}

function runFFmpeg(ffmpegPath, args, resolve, reject) {
    try {
        const { spawn } = require('child_process');
        if (!ffmpegPath) {
            throw new Error('未找到 FFmpeg 执行文件。请手动下载 ffmpeg.exe 并放入项目根目录的 bin 文件夹中。');
        }
        // 使用传递进来的绝对路径启动 FFmpeg
        const ffmpeg = spawn(ffmpegPath, args);
        
        let duration = 0;

        ffmpeg.stderr.on('data', (data) => {
            const str = data.toString();
            
            // 解析总时长
            if (!duration) {
                const durationMatch = str.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
                if (durationMatch) {
                    duration = parseInt(durationMatch[1]) * 3600 + 
                               parseInt(durationMatch[2]) * 60 + 
                               parseInt(durationMatch[3]);
                }
            }

            // 解析当前时间进度
            const timeMatch = str.match(/time=(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch && duration > 0) {
                const currentTime = parseInt(timeMatch[1]) * 3600 + 
                                    parseInt(timeMatch[2]) * 60 + 
                                    parseInt(timeMatch[3]);
                const progress = Math.min(95, Math.round((currentTime / duration) * 100));
                parentPort.postMessage({ type: 'progress', value: progress });
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg 退出，错误码: ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`无法启动 FFmpeg: ${err.message}。请确保已安装 FFmpeg。`));
        });
    } catch (e) {
        reject(e);
    }
}

async function convertDocument(inputPath, outputPath, targetFormat) {
    const format = targetFormat.toLowerCase();
    const ext = '.' + format.replace(/^\./, '');

    parentPort.postMessage({ type: 'progress', value: 30 });

    // Try LibreOffice CLI first
    try {
        execSync(`soffice --headless --convert-to ${format} --outdir "${path.dirname(outputPath)}" "${inputPath}"`, { stdio: 'ignore' });
        
        parentPort.postMessage({ type: 'progress', value: 80 });

        const generatedName = path.basename(inputPath, path.extname(inputPath)) + '.' + format;
        const tempOutputPath = path.join(path.dirname(outputPath), generatedName);
        if (fs.existsSync(tempOutputPath)) {
            if (tempOutputPath !== outputPath) fs.renameSync(tempOutputPath, outputPath);
            return;
        } else {
            throw new Error('LibreOffice CLI 未生成输出文件，回退到库方法');
        }
    } catch (cliErr) {
        parentPort.postMessage({ type: 'progress', value: 40 });
        // Fallback to libreoffice-convert
        try {
            const fileBuffer = fs.readFileSync(inputPath);
            const convertedBuffer = await new Promise((resolve, reject) => {
                convert.convert(fileBuffer, ext, (err, done) => {
                    if (err) return reject(err);
                    resolve(done);
                });
            });
            parentPort.postMessage({ type: 'progress', value: 90 });
            fs.writeFileSync(outputPath, convertedBuffer);
            return;
        } catch (libErr) {
            throw new Error(`文档转换失败: CLI 错误: ${cliErr.message}; libreoffice-convert 错误: ${libErr.message}`);
        }
    }
}