const Pushable = require('pull-pushable')
const debug = require('debug')('remote-debugger')

module.exports = function(webContents) {
  const dbgr = webContents.debugger
  const p = Pushable(true, ()=>{
    if (dbgr.isAttached()) {
      debug('detaching')
      dbgr.detach()
    }
  })

  if (dbgr.isAttached()) {
    debug('already attached')
  } else {
    try {
      debug('attaching ...')
      dbgr.attach('1.1')
      debug('done')
    } catch(err) {
      debug(`attach error: ${err.message}`)
      return p.end(err)
    }
  }

  dbgr.once('detach', (e, reason)=>{
    debug('browser detached')
    p.end(new Error(reason))
  })
  
  dbgr.sendCommand('Page.enable')
    .then( r=>debug(`Page.enable returns ${JSON.stringify(r)}`))
    .catch(err=>debug(`Page.enable error: ${err.message}`))

  dbgr.sendCommand('Runtime.enable')
    .then( r=>debug(`Runtime.enable returns ${JSON.stringify(r)}`))
    .catch(err=>debug(`Runtime.enable error: ${err.message}`))

  dbgr.on('message', (event, msg, params)=>{
    debug(`msg: ${msg}`)
    p.push({event, msg, params})
  })

  return p.source
}

/* this goes into inject.js
const debuggerSource = require('./remote-debugger')
function streamCDPMessages() {
  pull(
    debuggerSource(view.webContents),
    pull.drain( ({event, msg, params})=>{
      if (msg == "Runtime.exceptionThrown") {
        const {exceptionDetails, timestamp} = params
        const {exception, lineNumber, stackTrace} = exceptionDetails
        const {description} = exception
        console.log(`Runtime.exceptionThrown ${description}`)
      } else if (msg == "Runtime.consoleAPICalled") {
        const {args, stackTrace, timestamp, type} = params
        const {callFrames} = stackTrace
        const a = args.map( ({type, value})=>`[${type}] ${value}`).join(' ')
        const f = callFrames.map( ({functionName, lineNumber})=>{return `${functionName} (l#${lineNumber})`}).join(' <- ')
        console.log(`Runtime.consoleAPICalled ${type} ${a} ${f}`)
        //console.dir(params, {depth:5})
      }
    }, err=>{
      console.error(`debuggerSource ended: ${err == true ? err : err.message}`)
    })
  )
}
*/

