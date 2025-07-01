/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/webview/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'vscode-background': 'var(--vscode-editor-background)',
        'vscode-foreground': 'var(--vscode-editor-foreground)',
        'vscode-border': 'var(--vscode-panel-border)',
        'vscode-button': 'var(--vscode-button-background)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-input': 'var(--vscode-input-background)',
        'vscode-input-border': 'var(--vscode-input-border)',
      },
    },
  },
  plugins: [],
};
