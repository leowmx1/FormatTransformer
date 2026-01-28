// main.js
const { app, BrowserWindow } = require('electron');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
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
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 文件转换功能
function convertFile(category) {
    // 这里可以实现具体的文件转换逻辑
    alert(`开始进行 ${category} 转换...`);
    // 例如，调用相应的转换函数
}

// 更新按钮事件监听器
const sidebarButtons = document.querySelectorAll('.sidebar-button');

sidebarButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const category = event.target.getAttribute('data-category');
        loadContent(category);
        convertFile(category);
    });
});