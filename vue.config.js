module.exports = {
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.svg$/,
          use: [
            {
              loader: 'svg-sprite-loader',
              options: {
                extract: true,
                publicPath: '/static/'
              }
            },
            'svgo-loader'
          ]
        }
      ]
    }
  }
}