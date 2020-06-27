const {EventEmitter} = require('events')
const {Page} = require('puppeteer-core/lib/Page')
const debug = require('debug')('bop:page')
const d_cdp = require('debug')('bop:cdp')
const d_cdp_scopes = {
  Network: d_cdp.extend('network'),
  Runtime: d_cdp.extend('runtime'),
  Page: d_cdp.extend('page')
}

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
    const name = args[0]
    debug('send %s', name)
    if (name == 'Target.setAutoAttach') {
      debug('setAutoAttach %O', args.slice(1))
    }
    return session.sendCommand.apply(session, args)
  }
  /*
  client._connection = {
    session: ()=>client
  }
  */
  session.on('message', (_, name, event)=>{
    if (name == 'Target.attachedToTarget') {
      debug('suppress %s %O', name, event)
      return 
    }
    if (!name.startsWith('Network.webSocketFrame')) {
      // Network.webSocketFrame are so frequent that they are not helpful
      const [cdp_scope, ...rest] = name.split('.')
      const d = d_cdp_scopes[cdp_scope]
      if (d) d(rest.join('.'))
      else debug(`emit ${name}`)
    }
    if (name == 'Log.entryAdded') {
      debug('Log entry: %O', event)
    }
    
    if (name == 'Network.webSocketCreated') {
      d_cdp_scopes.Network('webSocketCreated: %O', event)
    }
    if (name == 'Network.responseReceived') {
      const {status, statusText, url} = event.response
      debug('Network Response: %s %s %s', status, statusText, url.substr(0,80))
    }
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
