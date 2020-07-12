const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const debug = require('debug')('bop:detect-errors')

module.exports = function(page) {
  const pushable = Pushable(true)

  page.on('pageerror', error => {
    debug('pageerror %O', error)
    pushable.push({type: 'error', text: error.message})
  })
  page.on('error', error => {
    debug('error %O', error)
    pushable.push({type: 'error', text: error.message})
  })
  page.on('response', response => {
    const status = response.status()
    if (status < 200 || status >= 400) {
    debug('http status %O', response)
      pushable.push({type: 'network-error', text: `${status} ${response.url()}`})
    }
  })
  page.on('requestfailed', request => {
    const errorText = request.failure().errorText
    const text = `${errorText} ${request.resourceType()} ${request.method()} ${request.url()}`
    debug('requestfailed %s %O', text, request.headers())
    pushable.push({
      type: 'network-error',
      text
    })
  })
  return pushable.source
}
