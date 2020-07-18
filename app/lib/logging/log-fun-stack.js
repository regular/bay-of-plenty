const util = require('util')
const debug = require('debug')('bop:log-fun-stack')
const Format = require('console-with-style')

module.exports = function(t) {
  const formatters = []
  function use(log, {colorSupportLevel}) {
    const format = Format(colorSupportLevel)
    const stringify = Stringify(colorSupportLevel)
    formatters.push({format, log, stringify})
  }
  function runFormatters({consoleMessage, values}) {
    if (!values.length) {
      values.unshift(consoleMessage.text())
    }
    const location = consoleMessage.location()
    const type = consoleMessage.type()
    formatters.forEach( ({format, log, stringify}) => {
      const text = typeof values[0] == 'string' ? format.apply(null, values)
        : values.map(stringify).join(' ')
      log({type, location, text})
    })
  }
  return {use, runFormatters}
}

function Stringify(colorSupportLevel) {
  return function stringify(v) {
    if (typeof v == 'string') return v
    if (typeof v == 'number' || typeof v == 'boolean') return `${v}`
    return util.inspect(v, {colors: colorSupportLevel > 0})
  }
}
