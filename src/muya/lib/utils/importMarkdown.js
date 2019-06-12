/**
 * translate markdown format to content state used by Mark Text
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import { Lexer } from '../parser/marked'
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'
import { loadLanguage } from '../prism/index'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_DNA } from '../config'

const LINE_BREAKS_REG = /\n/

// Just because turndown change `\n`(soft line break) to space, So we add `span.ag-soft-line-break` to workaround.
const turnSoftBreakToSpan = html => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<x-mt id="turn-root">${html}</x-mt>`,
    'text/html'
  )
  const root = doc.querySelector(`#turn-root`)
  const travel = childNodes => {
    for (const node of childNodes) {
      if (node.nodeType === 3) {
        let startLen = 0
        let endLen = 0
        const text = node.nodeValue.replace(/^(\n+)/, (_, p) => {
          startLen = p.length
          return ''
        }).replace(/(\n+)$/, (_, p) => {
          endLen = p.length
          return ''
        })
        if (/\n/.test(text)) {
          const tokens = text.split('\n')
          const params = []
          let i = 0
          const len = tokens.length
          for (; i< len; i++) {
            let text = tokens[i]
            if (i === 0 && startLen !== 0) {
              text = '\n'.repeat(startLen) + text
            } else if (i === len - 1 && endLen !== 0) {
              text = text + '\n'.repeat(endLen)
            } 
            params.push(document.createTextNode(text))
            if (i !== len - 1) {
              const softBreak = document.createElement('span')
              softBreak.classList.add('ag-soft-line-break')
              params.push(softBreak)
            }
          }
          node.replaceWith(...params)
        }
      } else if (node.nodeType === 1) {
        travel(node.childNodes)
      }
    }
  }
  travel(root.childNodes)
  return root.innerHTML.trim()
}

const importRegister = ContentState => {
  // turn markdown to blocks
  ContentState.prototype.markdownToState = function (markdown) {
    // mock a root block...
    const rootState = {
      key: null,
      type: 'root',
      text: '',
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
    const tokens = new Lexer({ disableInline: true }).lex(markdown)

    let token
    let block
    let value
    let parentList = [ rootState ]
    const languageLoaded = new Set()

    while ((token = tokens.shift())) {
      switch (token.type) {
        case 'frontmatter': {
          const lang = 'yaml'
          value = token.text
          block = this.createBlock('pre', {
            functionType: token.type,
            lang
          })
          const codeBlock = this.createBlock('code', {
            lang
          })
          value
            .replace(/^\s+/, '')
            .replace(/\s$/, '')
            .split(LINE_BREAKS_REG).forEach(line => {
              const codeLine = this.createBlock('span', {
                text: line,
                lang,
                functionType: 'codeLine'
              })

              this.appendChild(codeBlock, codeLine)
            })

          this.appendChild(block, codeBlock)
          this.appendChild(parentList[0], block)
          break
        }
        case 'hr': {
          value = token.marker
          block = this.createBlock('hr')
          const thematicBreakContent = this.createBlock('span', {
            text: value,
            functionType: 'thematicBreakLine'
          })
          this.appendChild(block, thematicBreakContent)
          this.appendChild(parentList[0], block)
          break
        }
        case 'heading': {
          const { headingStyle, depth, text, marker } = token
          value = headingStyle === 'atx' ? '#'.repeat(+depth) + ` ${text}` : text
          block = this.createBlock(`h${depth}`, {
            headingStyle
          })

          const headingContent = this.createBlock('span', {
            text: value,
            functionType: headingStyle === 'atx'? 'atxLine' : 'paragraphContent'
          })

          this.appendChild(block, headingContent)

          if (marker) {
            block.marker = marker
          }

          this.appendChild(parentList[0], block)
          break
        }
        case 'multiplemath': {
          value = token.text
          block = this.createContainerBlock(token.type, value)
          this.appendChild(parentList[0], block)
          break
        }
        case 'code': {
          const { codeBlockStyle, text, lang: infostring = '' } = token

          // GH#697, markedjs#1387
          const lang = (infostring || '').match(/\S*/)[0]

          value = text
          if (value.endsWith('\n')) {
            value = value.replace(/\n+$/, '')
          }
          if (/mermaid|flowchart|vega-lite|sequence/.test(lang)) {
            block = this.createContainerBlock(lang, value)
            this.appendChild(parentList[0], block)
          } else {
            block = this.createBlock('pre', {
              functionType: codeBlockStyle === 'fenced' ? 'fencecode' : 'indentcode',
              lang
            })
            const codeBlock = this.createBlock('code', {
              lang
            })
            value.split(LINE_BREAKS_REG).forEach(line => {
              const codeLine = this.createBlock('span', {
                text: line
              })
              codeLine.lang = lang
              codeLine.functionType = 'codeLine'
              this.appendChild(codeBlock, codeLine)
            })
            const inputBlock = this.createBlock('span', {
              text: lang,
              functionType: 'languageInput'
            })
            if (lang && !languageLoaded.has(lang)) {
              languageLoaded.add(lang)
              loadLanguage(lang)
                .then(infoList => {
                  if (!Array.isArray(infoList)) return
                  // There are three status `loaded`, `noexist` and `cached`.
                  // if the status is `loaded`, indicated that it's a new loaded language
                  const needRender = infoList.some(({ status }) => status === 'loaded')
                  if (needRender) {
                    this.render()
                  }
                })
                .catch(err => {
                  // if no parameter provided, will cause error.
                  console.warn(err)
                })
            }

            this.appendChild(block, inputBlock)
            this.appendChild(block, codeBlock)
            this.appendChild(parentList[0], block)
          }
          break
        }
        case 'table': {
          const { header, align, cells } = token
          const table = this.createBlock('table')
          const thead = this.createBlock('thead')
          const tbody = this.createBlock('tbody')
          const theadRow = this.createBlock('tr')
          const restoreTableEscapeCharacters = text => {
            // NOTE: markedjs replaces all escaped "|" ("\|") characters inside a cell with "|".
            //       We have to re-escape the chraracter to not break the table.
            return text.replace(/\|/g, '\\|')
          }
          for (const headText of header) {
            const i = header.indexOf(headText)
            const th = this.createBlock('th', {
              text: restoreTableEscapeCharacters(headText)
            })
            Object.assign(th, { align: align[i] || '', column: i })
            this.appendChild(theadRow, th)
          }
          for (const row of cells) {
            const rowBlock = this.createBlock('tr')
            for (const cell of row) {
              const i = row.indexOf(cell)
              const td = this.createBlock('td', {
                text: restoreTableEscapeCharacters(cell)
              })
              Object.assign(td, { align: align[i] || '', column: i })
              this.appendChild(rowBlock, td)
            }
            this.appendChild(tbody, rowBlock)
          }
          Object.assign(table, { row: cells.length, column: header.length - 1 }) // set row and column
          block = this.createBlock('figure')
          block.functionType = 'table'
          this.appendChild(thead, theadRow)
          this.appendChild(block, table)
          this.appendChild(table, thead)
          this.appendChild(table, tbody)
          this.appendChild(parentList[0], block)
          break
        }
        case 'html': {
          const { text } = token
          block = this.createHtmlBlock(text.trim())
          this.appendChild(parentList[0], block)
          break
        }
        case 'text': {
          value = token.text
          while (tokens[0].type === 'text') {
            token = tokens.shift()
            value += `\n${token.text}`
          }
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
          this.appendChild(parentList[0], block)
          break
        }
        case 'paragraph': {
          value = token.text
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
          this.appendChild(parentList[0], block)
          break
        }
        case 'blockquote_start': {
          block = this.createBlock('blockquote')
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'blockquote_end': {
          parentList.shift()
          break
        }
        case 'list_start': {
          const { ordered, listType, start } = token
          block = this.createBlock(ordered === true ? 'ol' : 'ul')
          block.listType = listType
          if (listType === 'order') {
            block.start = /^\d+$/.test(start) ? start : 1
          }
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'list_end': {
          parentList.shift()
          break
        }
        case 'loose_item_start':
        case 'list_item_start': {
          const { listItemType, bulletMarkerOrDelimiter, checked, type } = token
          block = this.createBlock('li', {
            listItemType: checked !== undefined ? 'task' : listItemType,
            bulletMarkerOrDelimiter,
            isLooseListItem: type === 'loose_item_start'
          })

          if (checked !== undefined) {
            const input = this.createBlock('input', {
              checked
            })

            this.appendChild(block, input)
          }
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'list_item_end': {
          parentList.shift()
          break
        }
        case 'space': {
          break
        }
        default:
          console.warn(`Unknown type ${token.type}`)
          break
      }
    }
    languageLoaded.clear()
    return rootState.children.length ? rootState.children : [this.createBlockP()]
  }

  ContentState.prototype.htmlToMarkdown = function (html) {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownService(turndownConfig)
    usePluginAddRules(turndownService)
    // fix #752, but I don't know why the &nbsp; vanlished.
    html = html.replace(/<span>&nbsp;<\/span>/g, ' ')
    html = turnSoftBreakToSpan(html)
    const markdown = turndownService.turndown(html)
    return markdown
  }

  // turn html to blocks
  ContentState.prototype.html2State = function (html) {
    const markdown = this.htmlToMarkdown(html)
    return this.markdownToState(markdown)
  }

  ContentState.prototype.addCursorToMarkdown = function (markdown, cursor) {
    const { ch, line } = cursor
    const lines = markdown.split('\n')
    const rawText = lines[line]
    lines[line] = rawText.substring(0, ch) + CURSOR_DNA + rawText.substring(ch)
    return lines.join('\n')
  }

  ContentState.prototype.getCodeMirrorCursor = function () {
    const blocks = this.getBlocks()
    const { start: { key, offset } } = this.cursor
    const block = this.getBlock(key)
    const { text } = block
    block.text = text.substring(0, offset) + CURSOR_DNA + text.substring(offset)
    const listIndentation = this.listIndentation
    const markdown = new ExportMarkdown(blocks, listIndentation).generate()
    const cursor = markdown.split('\n').reduce((acc, line, index) => {
      const ch = line.indexOf(CURSOR_DNA)
      if (ch > -1) {
        Object.assign(acc, { line: index, ch })
      }
      return acc
    }, {
      line: 0,
      ch: 0
    })
    // remove CURSOR_DNA
    block.text = text
    return cursor
  }

  ContentState.prototype.importCursor = function (cursor) {
    // set cursor
    const travel = blocks => {
      for (const block of blocks) {
        const { key, text, children, editable } = block
        if (text) {
          const offset = text.indexOf(CURSOR_DNA)
          if (offset > -1) {
            block.text = text.substring(0, offset) + text.substring(offset + CURSOR_DNA.length)
            if (editable) {
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
              return
            }
          }
        } else if (children.length) {
          travel(children)
        }
      }
    }
    if (cursor) {
      travel(this.blocks)
    } else {
      const lastBlock = this.getLastBlock()
      const key = lastBlock.key
      const offset = lastBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    }
  }

  ContentState.prototype.importMarkdown = function (markdown) {
    this.blocks = this.markdownToState(markdown)
  }
}

export default importRegister
