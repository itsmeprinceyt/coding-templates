export interface ElectronAPI {
    sayHello: () => void;
    getAppVersion: () => Promise<string>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export {};