<template>
  <div id="app">
    <div ref="editor"></div>
  </div>
</template>

<script>
  import Muya from './muya/lib'
  import TablePicker from './muya/lib/ui/tablePicker'
  import QuickInsert from './muya/lib/ui/quickInsert'
  import CodePicker from './muya/lib/ui/codePicker'
  import EmojiPicker from './muya/lib/ui/emojiPicker'
  import ImagePathPicker from './muya/lib/ui/imagePicker'
  import ImageSelector from './muya/lib/ui/imageSelector'
  import FormatPicker from './muya/lib/ui/formatPicker'
  import FrontMenu from './muya/lib/ui/frontMenu'
  import './muya/themes/default.css'
  import './assets/index.css'

  export default {
    name: 'app',
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor

        Muya.use(TablePicker)
        Muya.use(QuickInsert)
        Muya.use(CodePicker)
        Muya.use(EmojiPicker)
        Muya.use(ImagePathPicker)
        Muya.use(ImageSelector)
        Muya.use(FormatPicker)
        Muya.use(FrontMenu)

        this.editor = new Muya(ele, {
          markdown: 'Welcome to use muya...'
        })
        this.editor.on('change', changes => {
          console.log(changes)
        })
      })
    }
  }
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
