const fs = require('fs')
const {parse} = require('url')
const {join} = require('path')
const debug = require('./log')(fs, 'bop:plugin')
const Browserify = require('browserify')
const indexhtmlify = require('indexhtmlify')
const BufferList = require('bl')
const hyperstream = require('hyperstream')
const h = require('hyperscript')
//jshint -W079
const btoa = require('btoa')

exports.name = 'bayofplenty'
exports.version = require('./package.json').version
exports.manifest = {
  close: 'async'
}

exports.init = function (ssb, config) {
  debug('INFO: plugin init')
  let windows = []
  const queue = []

  ssb.on('log:info', (...args) => log('info', ...args))

  ssb.ws.use(function (req, res, next) {
    if (!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = parse('http://makeurlparseright.com'+req.url)
    if (u.pathname == '/about') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      module.exports.sendAboutPage(res)
      return
    }
    next()
  })

  function close(cb) {
    ssb.off('log:info', log)
    windows = []
    cb(null)
  }  

  function addWindow(win, browserKeys) {
    windows.push(win)
    const b64 = btoa(JSON.stringify(browserKeys)).toString('base64')
    const code = `
      console.log("setting keys");
      window.localStorage["tre-keypair"] = atob("${b64}");
      console.log("done setting keys");
    `
    debug('executing', code)
    win.webContents.executeJavaScript(code)
  }

  function emptyQueue() {
    function exec(code, rm) {
      return function(win) {
        debug('executing', code)
        win.webContents.executeJavaScript(code, (err, v) =>{
          if (err) return console.log(err.message)
          if (v == false) {
            debug('returned false remuoving from list')
            rm.push(win)
          }
        })
      }
    }
    let rm = []
    while(queue.length) {
      const msg = queue.shift()
      const b64 = btoa(JSON.stringify(msg))
      const code = `
        (function(){
          const msg = JSON.parse(atob('${b64}'));
          const {type, args} = msg;
          (${client_log.toString()})(type, ...args);
        })();
      `
      windows.forEach(exec(code, rm))
      // jshint -W083
      windows = windows.filter(x=>!rm.includes(x))
      rm = []
    }
  }

  function log(type, ...args) {
    queue.push({type, args})
    emptyQueue()
  }

  return {
    close,
    addWindow,
    log
  }
}

// evaluated in browser context
function client_log(type, ...args) {
  const bop = window.bayofplenty
  if (!bop) return false // don't try again
  return bop.log(type, ...args)
}

module.exports.sendAboutPage = function sendAboutPage(res) {
  const body = BufferList()
  body.append(h('div.bayofplenty', [
    h('h1', 'Bay of Plenty'),
    h('h2', 'Versions'),
    h('ul.versions', 
      Object.keys(process.versions).map(k => {
        return h('li', `${k}: ${process.versions[k]}`)
      })
    )
  ]).outerHTML)
  const hs = hyperstream({body})

  const browserify = Browserify()
  browserify.add(join(__dirname, 'about.js'))
  browserify.bundle()
    .pipe(indexhtmlify())
    .pipe(hs)
    .pipe(res)
}
