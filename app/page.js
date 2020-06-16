const {EventEmitter} = require('events')
const {Page} = require('puppeteer-core/lib/Page')
const debug = require('debug')('bop:page')

const cache = new WeakMap()

// returns a promise
module.exports = function(webContents) {
  const session = webContents.debugger
  if (session.isAttached()) {
    debug('already attached')
    return cache[webContents.id]
  }
  try {
    debug('attaching ...')
    session.attach('')
    debug('done')
  } catch(err) {
    debug(`attach error: ${err.message}`)
    return RejectedPromise(err)
  }

  const client = new EventEmitter()
  client.send = function() {
    const args = Array.from(arguments)
    debug(`send ${args}`)
    return session.sendCommand.apply(session, args)
  }
  session.on('message', (_, name, event)=>{
    debug(`emit ${name}`)
    client.emit(name, event)
  })
  const target = {
    _isClosedPromise: new Promise(resolve=>{resolve(false)})
  }
  const ignoreHTTPSErrors = false
  const defaultViewport = null
  const screenshotTaskQueue = null

  const page = Page.create(client, target, ignoreHTTPSErrors, defaultViewport, screenshotTaskQueue)
  cache[webContents.id] = page
  return page
}

function RejectedPromise(err) {
  return new Promise( (resolve, reject)=>{
    reject(err)
  })
}
