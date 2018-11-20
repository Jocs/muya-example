import selection from '../selection'
import { CLASS_OR_ID } from '../config'
import { getSanitizeHtml } from '../utils/exportHtml'
import ExportMarkdown from '../utils/exportMarkdown'

const copyCutCtrl = ContentState => {
  ContentState.prototype.cutHandler = function () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    startBlock.text = startBlock.text.substring(0, start.offset) + endBlock.text.substring(end.offset)
    if (start.key !== end.key) {
      this.removeBlocks(startBlock, endBlock)
    }
    this.cursor = {
      start,
      end: start
    }
    this.partialRender()
  }

  ContentState.prototype.getClipBoradData = function () {
    const html = selection.getSelectionHtml()
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const removedElements = wrapper.querySelectorAll(
      `.${CLASS_OR_ID['AG_TOOL_BAR']},
      .${CLASS_OR_ID['AG_MATH_RENDER']},
      .${CLASS_OR_ID['AG_HTML_PREVIEW']},
      .${CLASS_OR_ID['AG_MATH_PREVIEW']},
      .${CLASS_OR_ID['AG_COPY_REMOVE']},
      .${CLASS_OR_ID['AG_LANGUAGE_INPUT']}`

    )
    ;[...removedElements].forEach(e => e.remove())

    const hrs = wrapper.querySelectorAll(`[data-role=hr]`)
    ;[...hrs].forEach(hr => hr.replaceWith(document.createElement('hr')))

    const headers = wrapper.querySelectorAll(`[data-head]`)
    ;[...headers].forEach(header => {
      const p = document.createElement('p')
      p.textContent = header.textContent
      header.replaceWith(p)
    })

    // replace inline rule element: code, a, strong, em, del to span element
    // in order to escape turndown translation

    const inlineRuleElements = wrapper.querySelectorAll(
      `a.${CLASS_OR_ID['AG_INLINE_RULE']},
      code.${CLASS_OR_ID['AG_INLINE_RULE']},
      strong.${CLASS_OR_ID['AG_INLINE_RULE']},
      em.${CLASS_OR_ID['AG_INLINE_RULE']},
      del.${CLASS_OR_ID['AG_INLINE_RULE']}`
    )
    ;[...inlineRuleElements].forEach(e => {
      const span = document.createElement('span')
      span.textContent = e.textContent
      e.replaceWith(span)
    })

    const aLinks = wrapper.querySelectorAll(`.${CLASS_OR_ID['AG_A_LINK']}`)
    ;[...aLinks].forEach(l => {
      const span = document.createElement('span')
      span.innerHTML = l.innerHTML
      l.replaceWith(span)
    })

    const codefense = wrapper.querySelectorAll(`pre[data-role$='code']`)
    ;[...codefense].forEach(cf => {
      const id = cf.id
      const block = this.getBlock(id)
      const language = block.lang || ''
      const selectedCodeLines = cf.querySelectorAll('.ag-code-line')
      const value = [...selectedCodeLines].map(codeLine => codeLine.textContent).join('\n')
      cf.innerHTML = `<code class="language-${language}">${value}</code>`
    })

    const htmlBlock = wrapper.querySelectorAll(`figure[data-role='HTML']`)
    ;[...htmlBlock].forEach(hb => {
      const selectedCodeLines = hb.querySelectorAll('span.ag-code-line')
      const value = [...selectedCodeLines].map(codeLine => codeLine.textContent).join('\n')
      const pre = document.createElement('pre')
      pre.textContent = value
      hb.replaceWith(pre)
    })

    const mathBlock = wrapper.querySelectorAll(`figure.ag-container-block`)
    ;[...mathBlock].forEach(mb => {
      const preElement = mb.querySelector('pre[data-role]')
      const functionType = preElement.getAttribute('data-role')
      const selectedCodeLines = mb.querySelectorAll('span.ag-code-line')
      const value = [...selectedCodeLines].map(codeLine => codeLine.textContent).join('\n')
      let pre
      switch (functionType) {
        case 'multiplemath':
          pre = document.createElement('pre')
          pre.classList.add('multiple-math')
          pre.textContent = value
          mb.replaceWith(pre)
          break
        case 'mermaid':
        case 'flowchart':
        case 'sequence':
        case 'vega-lite':
          pre = document.createElement('pre')
          pre.innerHTML = `<code class="language-${functionType}">${value}</code>`
          mb.replaceWith(pre)
          break
      }
    })

    const htmlData = wrapper.innerHTML
    const textData = this.htmlToMarkdown(htmlData)

    return { html: htmlData, text: textData }
  }

  ContentState.prototype.copyHandler = function (event, type) {
    event.preventDefault()

    const { html, text } = this.getClipBoradData()

    switch (type) {
      case 'normal': {
        event.clipboardData.setData('text/html', html)
        event.clipboardData.setData('text/plain', text)
        break
      }
      case 'copyAsMarkdown': {
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', text)
        break
      }
      case 'copyAsHtml': {
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', getSanitizeHtml(text))
        break
      }
      case 'copyTable': {
        const table = this.getTableBlock()
        if (!table) return
        const markdown = new ExportMarkdown([ table ]).generate()
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', markdown)
        break
      }
    }
  }
}

export default copyCutCtrl
