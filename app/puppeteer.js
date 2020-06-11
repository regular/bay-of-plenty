const {EventEmitter} = require('events')
const {Page} = require('puppeteer-core/lib/Page')
const {Events} = require('puppeteer-core/lib/Events')
const debug = require('debug')('bop:puppeteer')
const Pupplog = require('puppeteer-log')
const LogFun = require('./log-fun')

module.exports = function(webContents) {
  const session = webContents.debugger
  if (session.isAttached()) {
    debug('already attached')
    return
  }
  try {
    debug('attaching ...')
    session.attach('')
    debug('done')
  } catch(err) {
    debug(`attach error: ${err.message}`)
    return
  }

  const pupplog = Pupplog(LogFun(), err=>{
    console.error(`puppeteer-log ended: ${err && err.message}`)
  })

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
    _isClosedPromise: new Promise(resolve=>{})
  }
  const ignoreHTTPSErrors = false
  const defaultViewport = null
  const screenshotTaskQueue = null

  const page = Page.create(client, target, ignoreHTTPSErrors, defaultViewport, screenshotTaskQueue)

  page.then( page =>{
    debug('page initialized')
    page.on(Events.Page.Console, message =>{
      //console.log('console message', message)
      pupplog.push(message)
    })
  }).catch(err => {
    console.error('Unable to create page', err.message)
    console.error(err.stack)
  })

  /*
  client.once('detach', (e, reason)=>{
    debug('browser detached')
  })
  */
  
}

