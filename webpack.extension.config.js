const path = require('path');

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  target: 'node', // VS Code扩展运行在Node.js环境中
  mode: 'production', // 生产模式进行优化
  entry: './src/extension.ts', // 扩展入口文件
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode' // vscode模块不打包
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  optimization: {
    minimize: true
  }
}; 