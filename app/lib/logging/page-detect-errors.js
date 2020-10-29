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
    if (response.status() == 0 && response.statusText() == '' &&
      Object.keys(response.headers()).length == 0) {
      debug('degraded response object, probably intercepted, ignoring')
      return
    }
    if (status < 200 || status >= 400) {
      debug('http status %O', response.headers())
      pushable.push({type: 'network-error', text: `${status} ${response.url()}`})
    }
  })
  page.on('requestfailed', request => {
    const errorText = request.failure().errorText
    const type = request.resourceType()
    const method = request.method()
    const url = request.url()
    const response = request.response()
    const status = response && response.status()
    const ok = response && response.ok()
    const text = `${errorText} ${type} ${method} ${url} ${status} ok: ${ok}`
    debug('requestfailed %s', text)
    debug(`response was: ${status} ok: ${ok}`)

    if (method == 'HEAD' && 
        type == 'fetch' &&
        ok == true) {
      debug('this is considered a bogus error: the fetch actually suceeded.')
      return
    }

    pushable.push({
      type: 'network-error',
      text
    })
  })
  return pushable.source
}
