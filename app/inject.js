const menuTemplate = require('./menu')
const invites = require('tre-invite-code')
const {parse} = require('url')
const qs = require('query-string')
const secure = require('./secure')

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

module.exports = function inject(electron, fs, log, sbot) {
  const {app, ipcMain, BrowserWindow, Menu} = electron

  const old_console_log = console.log
  console.log = (...args) => {
    old_console_log.apply(console, args)
    fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', args.map(x => `${x}`).join(' ') + '\n')
  }

  log(`node version ${process.version}`)
  log(`process.env.DEBUG ${process.env.DEBUG}`)

  let win
  app.on('ready', start)

  function start() {
    secure(app)  
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app)))

    win = new BrowserWindow({
      backgroundColor: '#333', 
      width: 1200,
      height: Math.round(1200*9/16),
      darkTheme: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    win.on('closed', () => {
      log('window closed')
      win = null
    })
    if (process.env.BOP_DEV_TOOLS) {
      win.openDevTools()
    }
    boot(sbot, win, log, (err, result)=>{
      if (err) {
        log('Failed to boot: ' + err.message)
        process.exit(1)
      }
      const {webapp, url} = result
      const name = webapp.value.content.name
      
      async function tryLoad() {
        try {
          log('loading webapp blob ...')
          await win.loadURL(url)
        } catch(err) {
          log(`error loading ${url} -- retrying`)
          tryLoad()
        }
      }
      tryLoad()
      log(`done booting webapp "${name}"`)
    })
  }
}

function boot(sbot, win, log, cb) {
  return openApp(null, cb)

  function openApp(invite, cb) {
    const conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) return cb(new Error('invite parse error'))
    server(sbot, win, log, conf, (err, ssb, config, myid, browserKeys) => {
      if (err) {
        log(`sbot failed: ${err.message}`)
        return cb(err)
      }
      
      // TODO: onlye when sbot uses canned config
      ssb.bayofplenty.setOpenAppCallback(openApp)

      win.on('close', e=>{
        log('window closed -- closing sbot')
        ssb.close()
      })
      
      
      log('Waiting for navigation to /about.')
      win.webContents.once('did-navigate', e => {
        log('Waiting for dom-ready on obbout page ..')

        win.webContents.once('dom-ready', e => {
          log('dom ready on about page')
          ssb.bayofplenty.addWindow(win, browserKeys)
        })
      })

      const bootKey = (conf && conf.boot) || config.boot
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) return cb(err)
        const url = `http://127.0.0.1:${config.ws.port}/about/${encodeURIComponent(bootKey)}`
        cb(null, {webapp: result.kv, url})
      })
      
    })
  }
}

const sbots = {}
function server(sbot, win, log, conf, cb) {
  if (conf) {
    if (!conf.network) return cb(new Error('No network specified'))
    const entry = sbots[conf.network]
    if (entry) {
      entry.refCount++
      const {ssb, config, myid, browserKeys} = entry
      log('re-using sbot')
      return cb(null, ssb, config, myid, browserKeys)
    }
  }
  sbot(conf, (err, ssb, config, myid, browserKeys) => {
    if (!err) {
      log(`sbot started, ssb id ${myid}`)
      sbots[config.network] = {
        refCount: 1,
        ssb: Object.assign({}, ssb, {
          close: function() {
            if (--this.refCount == 0) {
              log('refCount==0, closing sbot')
              ssb.close.apply(ssb, Array.from(arguments))
              delete sbots[config.network]
            }
          }
        }),
        config, myid, browserKeys
      }
      return cb(null, ssb, config, myid, browserKeys)
    }
    log('Error starting sbot', err.message)
    if (!/ENOENT/.test(err.message)) {
      log('(no config specified and did not find canned .trerc file')
      return cb(err)
    }
    log('asking for invite code ...')
    askForInvite(win, log, (err, invite) => {
      if (err) {
        log('Failed to ask for invite code:', err.message)
        return cb(err)
      }
      const conf = confFromInvite(invite)
      if (!conf) {
        log('invite code parse error')
        return cb(new Error('inivte code syntax error'))
      }
      log('success, conf is:', JSON.stringify(conf, null, 2))
      log('retrying to start sbot')
      return server(sbot, win, log, conf, cb)
    })
  })
}

function askForInvite(win, log, cb) {
  let done = false
  
  const port = 18484
  win.loadFile(__dirname + '/public/invite.html')
  win.webContents.once('will-navigate', (e, url) =>{
    e.preventDefault()
    log('Prevented attempt to navigate to', url)
    const query = parse(url).query
    log('query is', query)
    if (!query) return cb(new Error('No query in add-network URL'))
    const fields = qs.parse(query)
    const code = fields.code
    log('code is', code)
    if (!code) return cb(new Error('No code in query in add-network URL'))
    cb(null, code)
  })
}

function confFromInvite(invite) {
  invite = invite.replace(/\s*/g,'')
  const conf = invites.parse(invite)
  return conf ? conf : null
}
