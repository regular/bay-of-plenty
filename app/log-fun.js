const debug = require('debug')('bop:browser-console')
const Format = require('console-with-style')
const supportsColor = require('supports-color')
const level = (supportsColor.stderr && supportsColor.stderr.level) || 0
const format = Format(level)

const numberSymbols = '⓿❶❷❸❹❺❻❼❽❾❿'

module.exports = function(tabid) {
  let currUrl
  return function ({consoleMessage, values}) {
    const sym = tabid < numberSymbols.length ? numberSymbols[tabid] : `${tabid}`
    let loc = ''
    const type = consoleMessage.type()
    const {lineNumber, url} = consoleMessage.location()
    if (url !== currUrl) {
      debug('In', url)
      currUrl = url
    }
    if (lineNumber !== undefined) {
      loc = `:${lineNumber} `
    }
    if (!values.length) {
      values.unshift(consoleMessage.text())
    }
    const text = typeof values[0] == 'string' ? format.apply(null, values)
      : values.map(stringify).join(' ')
    if (debug.enabled) {
      console.error(`${sym} ${loc} ${type} ${text}`)
    }
  }
}

function stringify(v) {
  if (typeof v == 'string') return v
  if (typeof v == 'number' || typeof v == 'boolean') return `${v}`
  return JSON.stringify(v)
}
