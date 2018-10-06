const webpack = require('webpack');
const path = require('path');

const isDevEnv = process.env.NODE_ENV != 'production';
const isProdEnv = process.env.NODE_ENV == 'production';

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

var config = {
  mode: 'production',
  devtool: 'source-maps',
  entry: {
    'terminalizer': [
      './src/js/index.js',
      './src/css/terminalizer.css'
    ],
    'terminalizer.min': [
      './src/js/index.js',
      './src/css/terminalizer.css'
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].js',
    library: 'webpackNumbers',
    libraryTarget: 'umd',
    globalObject: 'this',
    umdNamedDefine: true
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        cache: true,
        parallel: true,
        sourceMap: true,
        include: /\.min\.js$/
      }),
      new OptimizeCSSAssetsPlugin({
        assetNameRegExp: /\.min\.css$/,
        cssProcessorOptions: {
          map: {
            inline: false,
            annotation: true
          }
        }
      })
    ]
  },
  externals: {
   jquery: {
     commonjs: 'jquery',
     commonjs2: 'jquery',
     amd: 'jquery',
     root: '$'
   },
   xterm: {
     commonjs: 'xterm',
     commonjs2: 'xterm',
     amd: 'xterm',
     root: 'Terminal'
   }
 },
 plugins: [
   new CleanWebpackPlugin(['./dist'], {verbose: false}),
   new MiniCssExtractPlugin({filename: 'css/[name].css'}),
   new webpack.NoEmitOnErrorsPlugin()
 ],
 module: {
  rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
        {loader: 'babel-loader', options: {presets: ['@babel/preset-env']}}
        ]
      },
      {
        test: /\.css$/,
        use: [
          {loader: MiniCssExtractPlugin.loader},
          {loader: 'css-loader'},
          {loader: 'postcss-loader', options: {plugins: [require('autoprefixer')]}}
        ],
      }
    ]
  }
};

// Apply the configurations for the development environment
if (isDevEnv) {

  // Configurations
  config.mode = 'development';
  config.devtool = 'eval';

  // Remove .min files
  delete config.entry['terminalizer.min'];

}

module.exports = config;
