const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFile: (category) => 
        ipcRenderer.invoke('select-file', { category }),
    convertFile: (filePath, targetFormat, category, options) => 
        ipcRenderer.invoke('convert-file', { filePath, targetFormat, category, options }),
    handleDroppedFile: (arrayBuffer, fileName) => ipcRenderer.invoke('handle-dropped-file', arrayBuffer, fileName),
});
