const webpack = require('webpack');
const path = require('path');

// const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/app.js',

  output: {
    filename: 'pedigree.min.js',
    path: path.resolve(__dirname, 'dist'),
  },

  externals: [
    'XWiki', // XWiki JS library
    'Class', // PrototypeJS
    '$super',
    'Prototype',
    '$',
    '$F',
  ],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ]
      },
      {
        test: /\.(png|svg|jpg|gif|eot|woff2?|ttf)$/,
        use: [
          'file-loader',
        ]
      }
    ]
  },

  devtool: 'inline-source-map', // 'cheap-module-eval-source-map',

  devServer: {
    contentBase: path.join(__dirname, '.'),
    port: 9000
  },

  resolve: {
  	alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
  	}
  },

  plugins: [
    // new HtmlWebpackPlugin({
    //   template: 'index.html',
    // }),
    // new webpack.ProvidePlugin({
      // Raphael: 'pedigree/raphael',
      // XWiki: 'pedigree/xwiki',
    // })
  ],
};
