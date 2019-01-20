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
const LOG_LEVELS = 'error warning notice info'.split(' ')
const LOG_LEVEL = 4

exports.init = function (ssb, config) {
  debug('INFO: plugin init')
  let windows = []
  const queue = []

  const logger = logging(ssb)
  logger.subscribe(ssb.id, LOG_LEVEL, log)

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
    logger.unsubscribe(LOG_LEVEL, log)
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
          (${client_log.toString()})(msg);
        })();
      `
      windows.forEach(exec(code, rm))
      // jshint -W083
      windows = windows.filter(x=>!rm.includes(x))
      rm = []
    }
  }

  function log(msg) {
    queue.push(msg)
    emptyQueue()
  }

  return {
    close,
    addWindow,
    log
  }
}

// evaluated in browser context
function client_log(msg) {
  const bop = window.bayofplenty
  if (!bop) return false // don't try again
  return bop.log(msg)
}

module.exports.sendAboutPage = function sendAboutPage(res) {
  const body = BufferList()
  body.append(h('div.bayofplenty', {
    style: 'opacity: 0'
  }, [
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
  browserify.transform(require('brfs'))
  browserify.add(join(__dirname, 'about.js'))
  browserify.bundle()
    .pipe(indexhtmlify())
    .pipe(hs)
    .pipe(res)
}


function logging(server) {
  const handlers = {}

  function unsubscribe(level, onLog) {
    LOG_LEVELS.forEach(l => {
      if (level >= LOG_LEVELS.indexOf(l)) {
        const type = `log:${l}`
        if (handlers[type]) {
          server.off(type, handlers[type])
          delete handlers[type]
        }
      }
    })
  }

  function subscribe(id, level, onLog) {
    LOG_LEVELS.forEach(l => {
      if (level >= LOG_LEVELS.indexOf(l)) {
        const type = `log:${l}`
        let handler = handlers[type] = formatter(id, l)
        server.on(type, handler)
      }
    })
    function formatter(id, level) {
      return function (ary) {
        const [plug, id, verb, ...data] = ary
        const _data = (data.length == 1 && typeof data[0] == 'string' ?
          data[0] : JSON.stringify(data)) || ''
        onLog({level, plug, id, verb, data: _data})
      }
    }
  }
  return {
    subscribe,
    unsubscribe
  }
}
