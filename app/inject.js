const Httpd = require('./httpd')
const menuTemplate = require('./menu')
const invites = require('tre-invite-code')

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
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()))
    win = new BrowserWindow({ width: 800, height: 600 })
    win.on('closed', () => {
      win = null
    })
    win.openDevTools()

    server({}, (err, ssb, config, myid, browserKeys) => {
      if (err) {
        log('sbot failed',err.message)
        return
      }
      log('sbot started')
      // set browserkeys
      win.loadURL(`http://localhost:${config.ws.port}/about`)
      // TODO: wait for ready?
      win.webContents.executeJavaScript(
        `localStorage.setItem('tre-keypair', '${JSON.stringify(browserKeys)}')`
      ) .then( ()=>{
        log('done setting browser keys')
        win.loadURL(`http://localhost:${config.ws.port}/boot`)
      })
      .catch(err=>{
        log('error setting browser keys', err.message)
      })
    })
  }

  function server(networks, cb) {
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
      askForInvite( (err, invite) => {
        if (err) {
          log('Failed to ask for invite code:', err.message)
          return cb(err)
        }
        log('success, invite is:', invite)
        const netconf = invites.parse(invite)
        if (!netconf) {
          log('invite code parse error')
          return cb(new Error('inivte code syntax error'))
        }
        log('retrying to start sbot')
        return server({[netconf.network]:netconf}, cb)
      })
    })
  }

  function getLocalStorageItem(key, cb) { 
    win.webContents.executeJavaScript(
      `localStorage.getItem("${key}")`
    ).then( value =>{
      cb(null, value)
    }).catch(err => {
      log(`getLocalStorageItem ${key} failed: ${err.message}`)
      cb(err)
    })
  }

  function askForInvite(cb) {
    let done = false
    function onGetInvite(httpd, _cb) {
      if (done) return
      done = true
      log('Closing httpd')
      httpd.close()

      getLocalStorageItem('invite', (err, invite) => {
        if (err) {
          log('error getting invite', err.message)
          cb(err); _cb(err)
          return
        }
        log('got invite from localStorage', invite)
        cb(null, invite); _cb(null)
      })
    }
    
    const port = 18484
    log('starting http ..')
    Httpd(port, onGetInvite, (err, httpd) => {
      if (err) {
        log('httpd failed', err.message)
        return cb(err)
      }
      log('httpd listening on', port)
      win.loadURL(`httP://127.0.0.1:${port}/invite.html`)
    })
  }

}
