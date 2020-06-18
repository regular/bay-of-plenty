const {Events} = require('puppeteer-core/lib/Events')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const debug = require('debug')('bop:console-reflection')

module.exports = function(page, onEnd) {
  const pushable = Pushable()
  let drain
  let enabled = false
  let buffer = []

  pull(
    pushable,
    pull.asyncMap( (msg, cb) => {
      if (!enabled) {
        buffer.push(msg)
        return cb(null)
      }
      sendMessage(msg, cb)
    }),
    drain = pull.onEnd(onEnd)
  )

  function sendMessage(msg, cb) {
    const jsHandles = msg.args()
    const args = [fireEvent, msg.text(), msg.type(), msg.location(), ...jsHandles]
    debug('sendMessage')
    page.evaluate.apply(page, args)
    .catch( err =>{
      if (/can be evaluated only in the context they were created/.test(err.message)) {
        debug('context was destroyed')
        return cb(null)
      }
      debug(`failed ${err.message}`)
      cb(err)
    })
    .then(()=>cb(null))
  }

  // evaled in browser context
  function fireEvent(text, type, location, ...values) {
    const detail = {text, type, location, values}
    const event = new CustomEvent('console-message', {detail})
    window.dispatchEvent(event)
  }

  function enable() {
    debug('enable')
    function next(err) {
      if (err) return console.log(err.message)
      if (!buffer.length) return
      sendMessage(buffer.shift(), next)
    }
    next()
    enabled = true
  }

  function reset() {
    debug('reset')
    enabled = false
    buffer = []
  }

  page.on(Events.Page.Console, message =>{
    pushable.push(message)
  })

  return {abort: drain.abort, enable, reset}
}
