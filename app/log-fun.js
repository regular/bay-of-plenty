const debug = require('debug')('browser-console')

module.exports = function() {
  let currUrl
  return function ({consoleMessage, values}) {
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
    const text = values.map(stringify).join(' ')
    debug(`${loc} ${type} ${text}`)
  }
}

function stringify(v) {
  if (typeof v == 'string') return v
  if (typeof v == 'number' || typeof v == 'boolean') return `${v}`
  return JSON.stringify(v)
}
