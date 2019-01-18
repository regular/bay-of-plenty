const Httpd = require('./httpd')
const menuTemplate = require('./menu')
const invites = require('tre-invite-code')
const {parse} = require('url')
const qs = require('query-string')

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
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app)))
    win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false
      }
    })
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

      // set browserKeys
      log('load about page')
      win.loadURL(`http://localhost:${config.ws.port}/about`)
      log('Waiting for navigation to /about.')
      win.webContents.once('did-navigate', e => {
        log('Waiting for dom-ready on obbout page ..')

        win.webContents.once('dom-ready', e => {
          log('dom ready on about page')
          ssb.bayofplenty.addWindow(win, browserKeys)
        })
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
        invite = invite.replace(/\s*/g,'')
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

  function askForInvite(cb) {
    let done = false
    function onGetInvite(httpd, _cb) {
      return
    }
    
    const port = 18484
    log('starting http ..')
    let httpd
    httpd = Httpd(port, onGetInvite, err => {
      if (err) {
        log('httpd failed', err.message)
        return cb(err)
      }
      log('httpd listening on', port)
      win.loadURL(`httP://127.0.0.1:${port}/invite.html`)
      win.webContents.once('will-navigate', (e, url) =>{
        e.preventDefault()
        httpd.close()
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
    })
  }

}
