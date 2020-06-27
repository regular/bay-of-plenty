const fs = require('fs')
const {parse} = require('url')
const {join} = require('path')
const mkdirp = require('mkdirp')
const debug = require('debug')('bop:plugin')
const Browserify = require('browserify')
const indexhtmlify = require('indexhtmlify')
const BufferList = require('bl')
const hyperstream = require('hyperstream')
const h = require('hyperscript')
const crypto = require('crypto')
const FlumeviewLevel = require('flumeview-level')
const {generate} = require('ssb-keys')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const Notify = require('pull-notify')
const pkg = require('./package.json')
const listPublicKeys = require('./lib/list-public-keys')
const getDatapath = require('./lib/get-data-path')
const {deallocPort} = require('./port-allocator')
const avatarUpdate = require('./avatar-update')

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
  openApp: 'async',
  versions: 'sync',
  listPublicKeys: 'source',
  addIdentity: 'async',
  avatarUpdates: 'source',
  logStream: 'source',
  consoleMessageStream: 'source'
}

exports.init = function (ssb, config) {
  debug('INFO: plugin init')
  let windows = []
  const queue = []
  const logger = logging(ssb)

  logger.subscribe(ssb.id, LOG_LEVEL, log)
  const consoleMessageNotifiers = {}

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
    debug('HTTP request for path', u.pathname)
    if (u.pathname.startsWith('/launch/')) {
      const bootKey = decodeURIComponent(u.pathname.split('/')[2])
      debug(`request for launch page, bootKey: ${bootKey}`)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      return sendLaunchPage(res)
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

  ssb.close.hook( function(fn, args) {
    debug('close')
    logger.unsubscribe(LOG_LEVEL, log)
    windows = []
    deallocPort(config.host, config.port)
    deallocPort('127.0.0.1', config.ws.port)
    deallocPort('localhost', config.ws.port)
    fn.apply(this, args)
  })

  function addConsoleStream(source, id) {
    debug(`Adding console message source for ${id}`)
    const notify = consoleMessageNotifiers[id] = consoleMessageNotifiers[id] || Notify()
    pull(
      source,
      pull.drain(notify, err=>{
        notify.end(err)
        delete consoleMessageNotifiers[id]
      })
    )
  }

  function addWindow(win, browserKeys, consoleOutputStream) {
    windows.push(win)
    addConsoleStream(consoleOutputStream, browserKeys.id)

    emptyQueue()
  }

  function emptyQueue() {
    // make sure first window receives all messages
    if (!windows.length) return
    function exec(code, rm) {
      return function(win) {
        debug('exec JS 2')
        win.webContents.executeJavaScript(code)
        .catch( err  => {
          debug('err exec JS 2')
          debug('executeJavaScript throws %s', err.message)
          debug('remuoving window from list')
          rm.push(win)
          return console.log(err.message)
        })
        .then( v => {
          debug('done exec JS 2', v)
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
        new Promise( (resolve, reject) => {
          const msg = JSON.parse(atob('${b64}'));
          resolve((${client_log.toString()})(msg));
        });
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

  sv.addWindow = addWindow
  sv.log = log

  let openAppCallback = null
  sv.setOpenAppCallback = function(cb) {
    openAppCallback = cb
  }
  
  sv.openApp = function(invite, id, cb) {
    if (!openAppCallback) return cb(new Error('No openAppCallback set'))
    openAppCallback(invite, id, (err, kvm)=>{
      if (err) return cb(err)
      debug('openApp %O', kvm)
      cb(null, kvm)
    })
  }

  sv.versions = function() {
    return Object.assign(
      {},
      process.versions,
      {'bay-of-plenty': pkg.version}
    )
  }

  sv.listPublicKeys = function(network) {
    return pull(
      listPublicKeys(network),
      pull.map( ({id})=>id)
    )
  }

  sv.addIdentity = function(network, cb) {
    const pair = generate()
    const datapath = getDatapath(network, pair.id)
    mkdirp.sync(datapath)
    fs.writeFileSync(join(datapath, 'secret'), JSON.stringify(pair), 'utf8')
    cb(null, pair.id)
  }

  sv.avatarUpdates = function(network, id) {
    return avatarUpdate.getUpdates(network, id)
  }

  sv.logStream = function(level) {
    const p = Pushable(true, onDone)
    logger.subscribe(ssb.id, level, onLog)

    function onDone() {
      logger.unsubscribe(level, onLog)
    }

    function onLog(msg) {
      p.push(msg)
    }

    return p.source
  }

  sv.consoleMessageStream = function() {
    const {id} = this
    debug(`getting consoleMessageStream for ${id}`)
    const notify = consoleMessageNotifiers[id]
    if (!notify) {
      debug(`id ${id} not found.`)
      return pull.error(`Unknown id: ${id}`)
    }
    return notify.listen()
  }
  
  return sv
}

// evaluated in browser context
function client_log(msg) {
  const bop = window.bayofplenty
  if (!bop || !bop.log) return false // don't try again
  return bop.log(msg)
}

module.exports.sendLaunchPage = sendLaunchPage

function sendLaunchPage(res) {
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
  browserify.add(join(__dirname, 'launch.js'))
  browserify.bundle()
    .pipe(BufferList( (err, buffer) => {
      if (err) {
        res.statusCode = 503
        res.end(err.annotated)
        console.error(err.annotated)
        return process.exit(1)
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

      debug('script hash on launch page: %s', sha)
      
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
