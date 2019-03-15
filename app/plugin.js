const fs = require('fs')
const {parse} = require('url')
const {join} = require('path')
const debug = require('./log')(fs, 'bop:plugin')
const Browserify = require('browserify')
const indexhtmlify = require('indexhtmlify')
const BufferList = require('bl')
const hyperstream = require('hyperstream')
const h = require('hyperscript')
const crypto = require('crypto')
const FlumeviewLevel = require('flumeview-level')
const pull = require('pull-stream')

//jshint -W079
const btoa = require('btoa')

const LOG_LEVELS = 'error warning notice info'.split(' ')
const LOG_LEVEL = 4

const SECURE = false

function makeIndex() {
  return FlumeviewLevel(1, function map(kv) {
    const {value} = kv
    const content = value && value.content
    if (content.type !== 'webapp') return []
    const {codeBlob, scriptHash} = content
    if (!codeBlob) return []
    return [[codeBlob, scriptHash || 'none']]
  })
}

exports.name = 'bayofplenty'
exports.version = require('./package.json').version
exports.manifest = {
  close: 'async'
}

exports.init = function (ssb, config) {
  debug('INFO: plugin init')
  let windows = []
  const queue = []
  const logger = logging(ssb)
  logger.subscribe(ssb.id, LOG_LEVEL, log)

  const sv = ssb._flumeUse('WebappIndex', makeIndex())
  
  function getScriptHashForBlob(blobHash, cb) {
    const o = {
      gt: [blobHash, null],
      lt: [blobHash, undefined]
    }
    pull(
      sv.read(o),
      pull.collect( (err, results)=>{
        if (err) return cb(err)
        if (results.length == 0) return cb(
          new Error('script hash for webapp blob not found ' + blobHash)
        )
        if (results.length > 1) return cb(
          new Error('multiple script hashes for webapp blob found ' + blobHash)
        )
        cb(null, results[0].key[1])
      })
    )
  }

  ssb.ws.use(function (req, res, next) {
    if (!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = parse('http://makeurlparseright.com'+req.url)
    debug('request for path', u.pathname)
    if (u.pathname == '/about') {
      debug('request for about page')
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      return sendAboutPage(res)
    }

    if (!u.pathname.startsWith('/blobs/get/')) return next()

    const blob = decodeURIComponent(u.pathname.slice(11))
    if (req.method == 'HEAD') {
      debug('request for blob HEAD %s', blob)
      return next()
    }
    debug('request for blob %s', blob)
    getScriptHashForBlob(blob, (err, scriptHash) => {
      if (err) {
        debug('Failed to get script hash for blob', err.message)
        return next()
      }
      debug('requested blob is webapp with script hash %s', scriptHash)

      if (SECURE) {
        /* TODO
         * For some reason, Chromium and tre-apps-deplay
         * have different opinions of how the hash
         * should look like, IF THE FILE IS LARGE.
         * Until this is resolved, we sadly have to disable CSP
         */

        res.setHeader(
          'Content-Security-Policy', 
          `script-src 'sha256-${scriptHash}';`
        )
      }
      return next()
    })
  })

  function close(cb) {
    debug('close')
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
    //debug('executing', code)
    win.webContents.executeJavaScript(code)
    emptyQueue()
  }

  function emptyQueue() {
    // make sure first window receives all messages
    if (!windows.length) return
    function exec(code, rm) {
      return function(win) {
        //debug('executing', code)
        try {
          win.webContents.executeJavaScript(code, (err, v) =>{
            if (err) return console.log(err.message)
            if (v == false) {
              debug('returned false remuoving from list')
              rm.push(win)
            }
          })
        } catch(e) {
          debug('executeJavaScript throws %s', e.message)
          debug('remuoving window from list')
          rm.push(win)
        }
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
      if (!windows.length) {
        debug('no windows left')
      }
      rm = []
    }
  }

  function log(msg) {
    queue.push(msg)
    emptyQueue()
  }

  sv.close = close
  sv.addWindow = addWindow
  sv.log = log
  return sv
}

// evaluated in browser context
function client_log(msg) {
  const bop = window.bayofplenty
  if (!bop) return false // don't try again
  return bop.log(msg)
}

module.exports.sendAboutPage = sendAboutPage

function sendAboutPage(res) {
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
    .pipe(BufferList( (err, buffer) => {
      if (err) {
        res.statusCode = 503
        res.end(err.message)
        return
      }
      const bl_hash = BufferList()
      bl_hash.append('\n')
      bl_hash.append(buffer)
      /*
      buffer_hash = Buffer.from('\nconsole.log("hello")')
      buffer = Buffer.from('console.log("hello")')
      */
      const sha = crypto.createHash('sha256')
        .update(bl_hash.slice())
        .digest('base64')

      console.log('sha', sha)
      
      res.setHeader(
        'Content-Security-Policy', 
        `script-src 'sha256-${sha}';`
      )

      const doc = BufferList()
      doc.append(buffer)
      doc.pipe(indexhtmlify())
        .pipe(hs)
        .pipe(res)
    }))
}

function logging(server) {
  const handlers = {}
  
  function unsubscribe(level, onLog) {
    //debug('server %O', server)

    LOG_LEVELS.forEach(l => {
      if (level >= LOG_LEVELS.indexOf(l)) {
        const type = `log:${l}`
        if (handlers[type]) {
          server.removeListener(type, handlers[type])
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
        onLog({level, plug, id, verb, data})
      }
    }
  }
  return {
    subscribe,
    unsubscribe
  }
}
