// main.js
const { app, BrowserWindow } = require('electron');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false, // 安全设置，通常为false
            contextIsolation: true, // 安全设置，通常为true
        }
    });
    // 加载你的界面文件
    win.loadFile('index.html');
    // 如果想打开开发者工具，可以取消下一行的注释
    // win.webContents.openDevTools();
};

// 当Electron完成初始化后创建窗口
app.whenReady().then(() => {
    createWindow();
    // 在macOS上，即使没有窗口，也常让应用继续运行
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 当所有窗口都关闭时退出应用（Windows & Linux）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});