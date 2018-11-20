/**
 * Hi contributors!
 *
 * Before you edit or update codes in this file,
 * make sure you have read this bellow:
 * Commonmark Spec: https://spec.commonmark.org/0.28/
 * and GitHub Flavored Markdown Spec: https://github.github.com/gfm/
 * The output markdown needs to obey the standards of the two Spec.
 */
// const LINE_BREAKS = /\n/

class ExportMarkdown {
  constructor (blocks) {
    this.blocks = blocks
    this.listType = [] // 'ul' or 'ol'
    // helper to translate the first tight item in a nested list
    this.isLooseParentList = true
  }

  generate () {
    return this.translateBlocks2Markdown(this.blocks)
  }

  translateBlocks2Markdown (blocks, indent = '') {
    const result = []

    for (const block of blocks) {
      switch (block.type) {
        case 'p':
          this.insertLineBreak(result, indent, true)
          result.push(this.translateBlocks2Markdown(block.children, indent))
          break

        case 'span':
          result.push(this.normalizeParagraphText(block, indent))
          break

        case 'hr':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeParagraphText(block, indent))
          break

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeHeaderText(block, indent))
          break

        case 'figure':
          this.insertLineBreak(result, indent, true)
          switch (block.functionType) {
            case 'table':
              const table = block.children[1]
              result.push(this.normalizeTable(table, indent))
              break
            case 'html':
              result.push(this.normalizeHTML(block, indent))
              break
            case 'multiplemath':
              result.push(this.normalizeMultipleMath(block, indent))
              break
            case 'mermaid':
            case 'flowchart':
            case 'sequence':
            case 'vega-lite':
              result.push(this.normalizeContainer(block, indent))
              break
          }
          break

        case 'li': {
          const insertNewLine = block.isLooseListItem

          // helper variable to correct the first tight item in a nested list
          this.isLooseParentList = insertNewLine

          this.insertLineBreak(result, indent, insertNewLine)
          result.push(this.normalizeListItem(block, indent))
          this.isLooseParentList = true
          break
        }

        case 'ul': {
          const insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          this.insertLineBreak(result, indent, insertNewLine)
          this.listType.push({ type: 'ul' })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break
        }

        case 'ol': {
          const insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          this.insertLineBreak(result, indent, insertNewLine)
          const listCount = block.start !== undefined ? block.start : 1
          this.listType.push({ type: 'ol', listCount })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break
        }

        case 'pre':
          this.insertLineBreak(result, indent, true)
          if (block.functionType === 'frontmatter') {
            result.push(this.normalizeFrontMatter(block, indent))
          } else {
            result.push(this.normalizeCodeBlock(block, indent))
          }
          break

        case 'blockquote':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeBlockquote(block, indent))
          break
        default:
          console.log(block.type)
          break
      }
    }
    return result.join('')
  }

  insertLineBreak (result, indent, insertNewLine) {
    if (!result.length) return
    const newLine = insertNewLine ? '\n' : ''
    if (/\S/.test(indent)) {
      result.push(`${indent}${newLine}`)
    } else if (insertNewLine) {
      result.push(newLine)
    }
  }

  normalizeParagraphText (block, indent) {
    return `${indent}${block.text}\n`
  }

  normalizeHeaderText (block, indent) {
    const { headingStyle } = block
    const match = block.text.match(/(#{1,6})(.*)/)
    if (headingStyle === 'atx') {
      const text = `${match[1]} ${match[2].trim()}`
      return `${indent}${text}\n`
    } else if (headingStyle === 'setext') {
      const level = match[1].length
      if (level !== 1 && level !== 2) {
        console.error(`setext heading only have h1 or h2 but we got a heading h${level}`)
      }
      return `${indent}${match[2].trim()}\n${indent}${level === 1 ? '===' : '---'}\n`
    }
  }

  normalizeBlockquote (block, indent) {
    const { children } = block
    const newIndent = `${indent}> `
    return this.translateBlocks2Markdown(children, newIndent)
  }

  normalizeFrontMatter (block, indent) { // preBlock
    const result = []
    result.push('---\n')
    for (const line of block.children[0].children) {
      result.push(`${line.text}\n`)
    }
    result.push('---\n')
    return result.join('')
  }

  normalizeMultipleMath (block, /* figure */ indent) {
    const result = []
    result.push('$$\n')
    for (const line of block.children[0].children[0].children) {
      result.push(`${line.text}\n`)
    }
    result.push('$$\n')
    return result.join('')
  }

  // `mermaid` `flowchart` `sequence` `vega-lite`
  normalizeContainer (block, indent) {
    const result = []
    const diagramType = block.children[0].functionType
    result.push('```' + diagramType + '\n')
    for (const line of block.children[0].children[0].children) {
      result.push(`${line.text}\n`)
    }
    result.push('```\n')
    return result.join('')
  }

  normalizeCodeBlock (block, indent) {
    const result = []
    const textList = block.children[1].children.map(codeLine => codeLine.text)
    const { functionType } = block
    if (functionType === 'fencecode') {
      result.push(`${indent}${block.lang ? '```' + block.lang + '\n' : '```\n'}`)
      textList.forEach(text => {
        result.push(`${indent}${text}\n`)
      })
      result.push(indent + '```\n')
    } else {
      textList.forEach(text => {
        result.push(`${indent}    ${text}\n`)
      })
    }

    return result.join('')
  }

  normalizeHTML (block, indent) { // figure
    const result = []
    const codeLines = block.children[1].children[0].children[0].children
    for (const line of codeLines) {
      result.push(`${indent}${line.text}\n`)
    }
    return result.join('')
  }

  normalizeTable (table, indent) {
    const result = []
    const { row, column } = table
    const tableData = []
    const tHeader = table.children[0]

    const tBody = table.children[1]
    tableData.push(tHeader.children[0].children.map(th => th.text.trim()))
    tBody.children.forEach(bodyRow => {
      tableData.push(bodyRow.children.map(td => td.text.trim()))
    })

    const columnWidth = tHeader.children[0].children.map(th => ({ width: 5, align: th.align }))

    let i
    let j

    for (i = 0; i <= row; i++) {
      for (j = 0; j <= column; j++) {
        columnWidth[j].width = Math.max(columnWidth[j].width, tableData[i][j].length + 2) // add 2, because have two space around text
      }
    }
    tableData.forEach((r, i) => {
      const rs = indent + '|' + r.map((cell, j) => {
        const raw = ` ${cell + ' '.repeat(columnWidth[j].width)}`
        return raw.substring(0, columnWidth[j].width)
      }).join('|') + '|'
      result.push(rs)
      if (i === 0) {
        const cutOff = indent + '|' + columnWidth.map(({ width, align }) => {
          let raw = '-'.repeat(width - 2)
          switch (align) {
            case 'left':
              raw = `:${raw} `
              break
            case 'center':
              raw = `:${raw}:`
              break
            case 'right':
              raw = ` ${raw}:`
              break
            default:
              raw = ` ${raw} `
              break
          }
          return raw
        }).join('|') + '|'
        result.push(cutOff)
      }
    })
    return result.join('\n') + '\n'
  }

  normalizeList (block, indent) {
    const { children } = block
    return this.translateBlocks2Markdown(children, indent)
  }

  normalizeListItem (block, indent) {
    const result = []
    const listInfo = this.listType[this.listType.length - 1]
    let { children, bulletListItemMarker } = block
    let itemMarker

    if (listInfo.type === 'ul') {
      itemMarker = bulletListItemMarker ? `${bulletListItemMarker} ` : '- '
      if (block.listItemType === 'task') {
        const firstChild = children[0]
        itemMarker += firstChild.checked ? '[x] ' : '[ ] '
        children = children.slice(1)
      }
    } else {
      itemMarker = `${listInfo.listCount++}. `
    }

    const newIndent = indent + ' '.repeat(itemMarker.length)
    result.push(`${indent}${itemMarker}`)
    result.push(this.translateBlocks2Markdown(children, newIndent).substring(newIndent.length))
    return result.join('')
  }
}

export default ExportMarkdown
