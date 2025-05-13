import type { IElectronAPI } from '../types'; // Assuming types/index.ts is one level up from src

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// This ensures the file is treated as a module, which can be important depending on tsconfig settings.
export {}; 