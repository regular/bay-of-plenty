const {EventEmitter} = require('events')
const pull = require('pull-stream')
const Pishable = require('pull-pushable')
const debug = require('debug')('pull-puppeteer')
const {Page} = require('puppeteer-core/lib/cjs/puppeteer/common/Page')

module.exports = function(duplex, opts) {
  opts = opts || {}
  const pushable = Pushable()

  const client = new EventEmitter()
  client.send = function() {
    const args = Array.from(arguments)
    pushable.push(args)
  }
  let onClose
  const target = {
    _isClosedPromise: new Promise(resolve=>{onClose = resolve})
  }

  pull(
    pushable,
    duplex,
    pull.drain( ({name, event})=>{
      client.emit(name, event)
    }, end=>{
      if (end) console.error(end.message)
      debug('close')
      onClose(true)
    })
  )

  const ignoreHTTPSErrors = opts.ignoreHTTPSErrors == undefined ? false : opts.ignoreHTTPSErrors
  const defaultViewport = opts.defaultViewport == undefined ? null : opts.defaultViewport
  const screenshotTaskQueue = opts.screenshotTaskQueue == undefined ? null : opts.screenshotTaskQueue

  return Page.create(client, target, ignoreHTTPSErrors, defaultViewport, screenshotTaskQueue)
}
