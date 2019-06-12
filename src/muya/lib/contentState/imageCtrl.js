import { URL_REG } from '../config'

const imageCtrl = ContentState => {
  /**
   * insert inline image at the cursor position.
   */
  ContentState.prototype.insertImage = function ({ alt = '', src = '', title = '' }) {
    const match = /(?:\/|\\)?([^./\\]+)\.[a-z]+$/.exec(src)
    if (!alt) {
      alt = match && match[1] ? match[1] : ''
    }

    const { start, end } = this.cursor
    const { formats } = this.selectionFormats({ start, end })
    const { key, offset: startOffset } = start
    const { offset: endOffset } = end
    const block = this.getBlock(key)
    if (
      block.type === 'span' &&
      (
        block.functionType === 'codeLine' ||
        block.functionType === 'languageInput' ||
        block.functionType === 'thematicBreakLine'
      )
    ) {
      // You can not insert image into code block or language input...
      return
    }
    const { text } = block
    const imageFormat = formats.filter(f => f.type === 'image')
    // Only encode URLs but not local paths or data URLs
    let imgUrl
    if (URL_REG.test(src)) {
      imgUrl = encodeURI(src)
    } else {
      imgUrl = src
    }

    let srcAndTitle = imgUrl

    if (srcAndTitle && title) {
      srcAndTitle += ` "${title}"`
    }

    if (
      imageFormat.length === 1 &&
      imageFormat[0].range.start !== startOffset &&
      imageFormat[0].range.end !== endOffset
    ) {
      // Replace already existing image
      let imageAlt = alt

      // Extract alt from image if there isn't an image source already (GH#562). E.g: ![old-alt]()
      if (imageFormat[0].alt && !imageFormat[0].src) {
        imageAlt = imageFormat[0].alt
      }

      const { start, end } = imageFormat[0].range
      block.text = text.substring(0, start) +
        `![${imageAlt}](${srcAndTitle})` +
        text.substring(end)

      this.cursor = {
        start: { key, offset: start + 2 },
        end: { key, offset: start + 2 + imageAlt.length }
      }
    } else if (key !== end.key) {
      // Replace multi-line text
      const endBlock = this.getBlock(end.key)
      const { text } = endBlock
      endBlock.text = text.substring(0, endOffset) + `![${alt}](${srcAndTitle})` + text.substring(endOffset)
      const offset = endOffset + 2
      this.cursor = {
        start: { key: end.key, offset },
        end: { key: end.key, offset: offset + alt.length }
      }
    } else {
      // Replace single-line text
      const imageAlt = startOffset !== endOffset ? text.substring(startOffset, endOffset) : alt
      block.text = text.substring(0, start.offset) +
        `![${imageAlt}](${srcAndTitle})` +
        text.substring(end.offset)

      this.cursor = {
        start: {
          key,
          offset: startOffset + 2
        },
        end: {
          key,
          offset: startOffset + 2 + imageAlt.length
        }
      }
    }
    this.partialRender()
  }

  ContentState.prototype.replaceImage = function ({ key, token }, { alt = '', src = '', title = '' }) {
    const block = this.getBlock(key)
    const { start, end } = token.range
    const oldText = block.text
    let imageText = '!['
    if (alt) {
      imageText += alt
    }
    imageText += ']('
    if (src) {
      imageText += src
    }
    if (title) {
      imageText += ` "${title}"`
    }
    imageText += ')'
    block.text = oldText.substring(0, start) + imageText + oldText.substring(end)
    return this.singleRender(block)
  }
  
  ContentState.prototype.deleteImage = function ({ key, token }) {
    const block = this.getBlock(key)
    const oldText = block.text
    const { start, end } = token.range
    block.text = oldText.substring(0, start) + oldText.substring(end)

    this.cursor = {
      start: { key, offset: start },
      end: { key, offset: start }
    }
    return this.singleRender(block)
  }

  ContentState.prototype.selectImage = function (imageInfo) {
    this.selectedImage = imageInfo
    const block = this.getBlock(imageInfo.key)
    return this.singleRender(block, false)
  }
}

export default imageCtrl
