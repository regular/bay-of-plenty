const util = require('util')
const debug = require('debug')('bop:browser-console')
const Format = require('console-with-style')
const supportsColor = require('supports-color')
const colorSupportLevel = (supportsColor.stderr && supportsColor.stderr.level) || 0
const format = Format(colorSupportLevel)
const ansi = require('ansi-styles')
const icons = require('log-symbols')

const numberSymbols = '⓿❶❷❸❹❺❻❼❽❾❿'

const colorWraps = {
  log: [ansi.color.ansi16m.hex('#207f20'),  ansi.color.close],
  warning: [ansi.bgColor.ansi16m.hex('#7f7f20'),  ansi.bgColor.close],
  error: [ansi.bgColor.ansi16m.hex('#7f2020'),  ansi.bgColor.close]
}

const levelSymbols = {
  error: icons.error,
  warning: icons.warning,
  info: icons.info
}

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
    if (debug.enabled && (type !== 'log' || process.env.DEBUG_LOG)) {
      let prefix = '', postfix = ''
      if (colorWraps[type]) {
        [prefix, postfix] = colorWraps[type]
      }
      console.error(`${sym} ${levelSymbols[type]||' '} ${loc} ${prefix} ${text} ${postfix}`)
    }
  }
}

function stringify(v) {
  if (typeof v == 'string') return v
  if (typeof v == 'number' || typeof v == 'boolean') return `${v}`
  return util.inspect(v, {colors: colorSupportLevel > 0})
}
