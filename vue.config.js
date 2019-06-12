const SpritePlugin = require('svg-sprite-loader/plugin')

module.exports = {
  publicPath: '/muya-example/',
  outputDir: 'docs',
  chainWebpack: config => {

    const svgRule = config.module.rule('svg')

    // clear all existing loaders.
    // if you don't do this, the loader below will be appended to
    // existing loaders of the rule.
    svgRule.uses.clear()

    // add replacement loader(s)
    svgRule
      .use('svg-sprite-loader')
        .loader('svg-sprite-loader')
        .options({
          extract: true,
          publicPath: '/'
        })
        .end()

    config
      .plugin('spritePlugin')
      .use(SpritePlugin)
  }
}