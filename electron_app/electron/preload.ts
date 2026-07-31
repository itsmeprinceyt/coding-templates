import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    sayHello: () => ipcRenderer.send("hello"),
    getAppVersion: () => ipcRenderer.invoke("get-version")
});