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
      width: 800,
      height: 600,
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
    boot(sbot, win, log, err=>{
      if (err) {
        log('Failed to boot: ' + err.message)
        process.exit(1)
      }
      log('done booting')
    })
  }
}

function boot(sbot, win, log, cb) {
  openApp(null, cb)

  function openApp(invite, cb) {
    netconf = invite ? netconfFromInvite(invite) : null
    if (invite && !netconf) return cb(new Error('invite parse error'))
    server(sbot, win, log, netconf || {}, (err, ssb, config, myid, browserKeys) => {
      if (err) {
        log('sbot failed',err.message)
        return cb(err)
      }
      log('sbot started')

      win.on('close', e=>{
        log('window closed -- closing sbot')
        ssb.close()
      })
      
      let timer
      log('Waiting for navigation to /about.')
      win.webContents.once('did-navigate', e => {
        clearInterval(timer)
        log('Waiting for dom-ready on obbout page ..')

        win.webContents.once('dom-ready', e => {
          log('dom ready on about page')
          // TODO: onlye when sbot uses canned config
            ssb.bayofplenty.setOpenAppCallback(openApp)
          ssb.bayofplenty.addWindow(win, browserKeys)
          cb(null)
        })
      })
      /* We need to repeat this because ssb-server
       * has no callback that tells us when it actually started listening
       * (!#@) */
      const aboutURL = `http://127.0.0.1:${config.ws.port}/about`
      timer = setInterval( ()=>{
        log(`load about page: ${aboutURL}`)
        win.loadURL(aboutURL)
      }, 700)
    })
  }
}

function server(sbot, win, log, networks, cb) {
  sbot(networks, (err, ssb, config, myid, browserKeys) => {
    if (!err) {
      log(`sbot started, ssb id ${myid}`)
      return cb(null, ssb, config, myid, browserKeys)
    }
    log('Error starting sbot', err.message)
    if (!/ENOENT/.test(err.message)) {
      log('(no networks and did not find a config file')
      return cb(err)
    }
    log('asking for invite code ...')
    askForInvite(win, log, (err, invite) => {
      if (err) {
        log('Failed to ask for invite code:', err.message)
        return cb(err)
      }
      const netconf = netconfFromInvite(invite)
      if (!netconf) {
        log('invite code parse error')
        return cb(new Error('inivte code syntax error'))
      }
      log('success, netconf is:', JSON.stringify(netconf, null, 2))
      log('retrying to start sbot')
      return server(sbot, win, log, netconf, cb)
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

function netconfFromInvite(invite) {
  invite = invite.replace(/\s*/g,'')
  const netconf = invites.parse(invite)
  if (!netconf) return null
  return {[netconf.network]:netconf}
}
