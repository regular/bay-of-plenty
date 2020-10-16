//jshint esversion: 9
//jshint -W079
const spawn_bop = require('./spawn-bop')
const puppeteer = require('puppeteer-core')

module.exports = function(args, opts, cb) {
  let connecting = false
  const bop = spawn_bop(args, Object.assign({
    remoteDebuggingPort: 0,
  }, opts))
  bop.stderr.on('data', data =>{
    const m = data.toString().match(/DevTools listening on ws:\/\/127.0.0.1:(\d+)/)
    if (m && !connecting) connect(Number(m[1]), cb)
  })
  return bop

  function connect(remoteDebuggingPort, cb) {
    console.log('connecting to debug port', remoteDebuggingPort)
    connecting = true
    puppeteer.connect({
      browserURL: `http://127.0.0.1:${remoteDebuggingPort}`
    }).then(browser=>{
      cb(null, browser)
    }).catch(err => {
      console.log(err.message)
      setTimeout(()=>connect(remoteDebuggingPort, cb), 100)
    })
  }
}
