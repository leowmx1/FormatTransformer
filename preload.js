const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFile: (category) => 
        ipcRenderer.invoke('select-file', { category }),
    convertFile: (filePath, targetFormat, category, options) => 
        ipcRenderer.invoke('convert-file', { filePath, targetFormat, category, options }),
    handleDroppedFile: (arrayBuffer, fileName) => ipcRenderer.invoke('handle-dropped-file', arrayBuffer, fileName),
    getFilePath: (file) => {
        if (webUtils && webUtils.getPathForFile) {
            return webUtils.getPathForFile(file);
        }
        return file.path;
    },
    getImageDimensions: (filePath) => ipcRenderer.invoke('get-image-dimensions', filePath),
    getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
    showContextMenu: (filePath) => ipcRenderer.send('show-context-menu', filePath),
    onProgress: (callback) => ipcRenderer.on('conversion-progress', (_event, value) => callback(value)),
});
