const debug = require('debug')('bop:browser-console')
const supportsColor = require('supports-color')
const colorSupportLevel = (supportsColor.stderr && supportsColor.stderr.level) || 0
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
  const sym = tabid < numberSymbols.length ? numberSymbols[tabid] : `${tabid}`
  return function ({type, text, location}) {
    let loc = ''
    const {lineNumber, url} = location
    if (lineNumber !== undefined) {
      loc = `:${lineNumber} `
    }
    if (debug.enabled && (type !== 'log' || process.env.DEBUG_LOG)) {
      let prefix = '', postfix = ''
      if (colorWraps[type]) {
        [prefix, postfix] = colorWraps[type]
      }
      if (url !== currUrl) {
        console.error(`${sym} In ${url}:`)
        currUrl = url
      }
      console.error(`${sym} ${levelSymbols[type]||' '} ${loc} ${prefix} ${text} ${postfix}`)
    }
  }
}

