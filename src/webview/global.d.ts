declare const vscode: {
  postMessage: (message: any) => void;
};

// 确保在没有acquireVsCodeApi的环境中也能工作
declare global {
  interface Window {
    acquireVsCodeApi?: () => any;
  }
}

declare module '*.css' {
  const content: string;
  export default content;
}
