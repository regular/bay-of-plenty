const fs = require('fs')
const {parse} = require('url')
const {join} = require('path')
const mkdirp = require('mkdirp')
const debug = require('debug')('bop:plugin')
const debug_auth = require('debug')('bop:auth')
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
const toPull = require('stream-to-pull-stream')
const pkg = require('./package.json')
const listPublicKeys = require('./lib/list-public-keys')
const getDatapath = require('./lib/get-data-path')
const {deallocPort} = require('./port-allocator')
const avatarUpdate = require('./avatar-update')
const makeCSP = require('./lib/csp')

//jshint -W079
const btoa = require('btoa')

const LOG_LEVELS = 'error warning notice info'.split(' ')
const LOG_LEVEL = 4

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

module.exports = function(bop) {
  return {
    name: 'bayofplenty',
    version: require('./package.json').version,
    manifest: {
      openApp: 'async',
      versions: 'sync',
      listPublicKeys: 'source',
      addIdentity: 'async',
      avatarUpdates: 'source',
      logStream: 'source',
      setTitle: 'async'
    },

    init: function (ssb, config) {
      debug('init')

      let tabByBrowserKey = {} // map browser ssb id to puppeteer page (tab content) and tabId (tab index)
      // taken from ssb-master
      ssb.auth.hook(function (auth, args) {
        const id = args[0]
        const cb = args[1]
        debug_auth('auth called for %s', id)
        const tab = tabByBrowserKey[id]
        if (tab == undefined) {
          debug_auth('not from within BoP')
          console.log(auth.toString())
          return auth(id, (err, perms) => {
            if (err) {
              debug_auth('auth failed: %s', err.message)
            } else {
              debug_auth('auth succeeded perms = %o', perms)
              console.dir(perms)
            }
            cb(err, perms)
          })
        }
        const revRoot = revisionRoot(tab.app) 
        debug_auth('Called auth for app %s', revRoot)
        //return cb(null, {allow: null, deny: null})

        function test(name, args) {
          debug_auth('test %s, atgs = %o', name, args)
        }
        const perms = {
          pre: test,
          test,
          post: ()=>true
        }

        cb(null, perms)
      })

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
        const u = parse('http://makeurlparseright.com'+req.url)
        debug('%s request for path', req.method, u.pathname)
        if(req.method === 'POST' && u.pathname == '/blobs/add') {
          debug('adding blob ...')
          pull(
            toPull.source(req),
            ssb.blobs.add(function (err, hash) {
              debug('blob upload done: %o %s', err, hash)
              res.end(JSON.stringify({
                hash,
                url: `/blobs/get/${encodeURIComponent(hash)}`
              }))
            })
          )
          return
        }
        if (req.method !== "GET" && req.method !== 'HEAD') return next()

        const launchLocal = config.bayOfPlenty && config.bayOfPlenty.launchLocal
        if (launchLocal) {
          const ws_address = JSON.stringify(ssb.ws.getAddress())
          if (u.pathname == '/.trerc') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              caps: config.caps, // TODO: this leaks appKey to the public 
              tre: config.tre
            }, null, 2))
            return
          }
          if (u.pathname == '/.tre/ws-address') {
            res.setHeader('Content-Type', 'application/json')
            res.end(ws_address)
            return
          }
        }

        if (u.pathname.startsWith('/launch/')) {
          if (launchLocal) {
            debug(`request for launch page with local file: ${launchLocal}`)
          } else {
            const bootKey = decodeURIComponent(u.pathname.split('/')[2])
            debug(`request for launch page with bootKey: ${bootKey}`)
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          return sendLaunchPage(res, {launchLocal})
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
            //return res.end(503, `Failed to get script hash: ${err.message}`)
            return next()
          }
          debug('requested blob is webapp with script hash %s', scriptHash)

          const csp = makeCSP(config, scriptHash)

          res.setHeader(
            'Content-Security-Policy', csp
          )
          return next()
        })
      })

      ssb.close.hook( function(fn, args) {
        debug('close')
        logger.unsubscribe(LOG_LEVEL, log)
        windows = []
        tabByBrowserKey = {}
        deallocPort(config.host, config.port)
        deallocPort('127.0.0.1', config.ws.port)
        deallocPort('localhost', config.ws.port)
        fn.apply(this, args)
      })

      function addTab(tab, browserKeys) {
        const id = browserKeys.id
      
        // did a page change its identity?
        const removes = []
        for(let i in tabByBrowserKey) {
          if (tabByBrowserKey[i].page == tab.page) {
            debug('tab %d has changed its browser id', tabByBrowserKey[i].tabId)
            removes.push(i)
          }
        }
        removes.forEach(i=>delete tabByBrowserKey[i])

        debug('add tab %d, browser id %s', tab.id, id)
        tabByBrowserKey[id] = tab
        tab.once('close', ()=>{
          debug('tab %d closed', tab.id)
          delete tabByBrowserKey[id]
        })
        // TODO
        //windows.push(view)
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

      sv.addTab = addTab
      sv.log = log

      sv.setTitle = function(title, cb) {
        const tab = tabByBrowserKey[this.id]
        if (tab == undefined) {
          return cb(new Error('Could not identify tab'))
        }
        const app = revisionRoot(tab.app) 
        if (!app) {
          return cb(new Error('Could not identify calling webapp'))
        }
        bop.queryAppPermission(app, 'setTitle', (err, isAllowed) =>{
          if (err) return cb(err)
          bop.setTabTitle(tab.id, {title, prefix: false})
          cb(null)
        })
      }
      
      sv.openApp = function(invite, id, opts, cb) {
        if (typeof opts == 'function') {
          cb = opts
          opts = undefined
        }
        opts = opts || {}
        debug('openApp called via rpc by %s', this.id)
        const tab = tabByBrowserKey[this.id]
        if (tab == undefined) {
          debug('No page found for %s', this.id)
          return cb(new Error(`${this.id.substr(0,5)} is not authorized to open an application`))
        }
        debug('openApp in tab %s', tab.id)
        bop.openApp(tab, invite, id, opts, (err, kvm)=>{
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

      return sv
    }
  }
}

// evaluated in browser context
function client_log(msg) {
  const bop = window.bayofplenty
  if (!bop || !bop.log) return false // don't try again
  return bop.log(msg)
}

// TODO: use tre-compile

function sendLaunchPage(res, opts) {
  const {launchLocal} = opts
  const body = BufferList()
  body.append(h('div.bayofplenty', {
    style: 'opacity: 0'
  }, [
    h('h1', 'Bay of Plenty'),
    launchLocal ? h('.filepath', launchLocal) : [],
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
  browserify.add(join(__dirname, launchLocal ? 'launch-local.js' : 'launch.js'))
  browserify.bundle()
    .pipe(BufferList( (err, buffer) => {
      if (err) {
        res.statusCode = 503
        res.end(err.annotated)
        console.error(err.annotated)
        return process.exit(1)
      }
      const bl_hash = BufferList()
      bl_hash.append(buffer)

      //buffer_hash = Buffer.from('\nconsole.log("hello")')
      //buffer = Buffer.from('console.log("hello")')

      const sha = crypto.createHash('sha256')
        .update(bl_hash.slice())
        .digest('base64')

      //console.log('sha', sha)
      
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

function revisionRoot(kv) {
  if (!kv) return null
  return kv.value.content.revisionRoot || kv.key
}
