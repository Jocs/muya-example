<template>
  <div id="app">
    <div ref="editor"></div>
  </div>
</template>

<script>
  import Muya from './muya/lib'
  import TablePicker from './muya/lib/ui/tablePicker'
  // import QuickInsert from './muya/lib/ui/quickInsert'
  import CodePicker from './muya/lib/ui/codePicker'
  import EmojiPicker from './muya/lib/ui/emojiPicker'
  import ImagePathPicker from './muya/lib/ui/imagePicker'
  import FormatPicker from './muya/lib/ui/formatPicker'
  import './muya/themes/light.css'

  export default {
    name: 'app',
    created () {
      this.$nextTick(() => {
        const ele = this.$refs.editor

        Muya.use(TablePicker)
        // Muya.use(QuickInsert)
        Muya.use(CodePicker)
        Muya.use(EmojiPicker)
        Muya.use(ImagePathPicker)
        Muya.use(FormatPicker)
        const { container } = this.editor = new Muya(ele, {})
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
