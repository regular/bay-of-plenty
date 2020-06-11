const fs = require('fs')
const {join} = require('path')

const puppeteer = require('./puppeteer')

const pull = require('pull-stream')
const Pushable = require('pull-pushable')

const menuTemplate = require('./menu')
const invites = require('tre-invite-code')
const {parse} = require('url')
const qs = require('query-string')
const secure = require('./secure')
const Tabs = require('./tabs')
const listPublicKeys = require('./lib/list-public-keys')
const getDatapath = require('./lib/get-data-path')

const webPreferences = {
  enableRemoteModule: false,
  nodeIntegration: false,
  contextIsolation: true
}

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

module.exports = function inject(electron, fs, log, sbot) {
  const {app, ipcMain, BrowserWindow, BrowserView, Menu, MenuItem} = electron

  app.allowRendererProcessReuse = true

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


    win = new BrowserWindow({
      backgroundColor: '#333', 
      width: 1200,
      height: Math.round(1200*9/16),
      darkTheme: true,
      webPreferences
    })

    /*
    function initTabView(tab) {
      console.log('detected new tab')
      tab.once('close', ()=>{
        console.log('detected tab close')
      })
    }
    */

    const tabs = Tabs(win, BrowserView, webPreferences, initTabView)
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app, tabs)))
    win.on('closed', () => {
      log('window closed')
      win = null
    })
    if (process.env.BOP_DEV_TOOLS) {
      win.openDevTools()
    }
    initTabView(win)

    function initTabView(view) {
      const appMenu = Menu.getApplicationMenu()
      const tabMenu = appMenu.getMenuItemById('tabs').submenu
      let label = `Tab ${view.id}`
      let accelerator = `CmdOrCtrl+${view.id}`
      if (!tabMenu.getMenuItemById('separator')) {
        tabMenu.append(new MenuItem({
          id: 'separator',
          type: 'separator'
        }))
        label = 'Main Tab'
        accelerator = `CmdOrCtrl+0`
      }
      tabMenu.append(new MenuItem({
        label,
        accelerator,
        type: 'radio',
        id: label,
        click: ()=>{
          if (label == 'Main Tab') {
            return tabs.activateTab('_main')
          }
          tabs.activateTab(`${view.id}`)
        }
      }))
      Menu.setApplicationMenu(appMenu)
      Menu.getApplicationMenu().getMenuItemById(label).checked = true

      win.setTitle(label)
      view.on('deactivate-tab', ()=>{
        win.setTitle('Main Tab') // we receive no activate-tab for the main tab
        Menu.getApplicationMenu().getMenuItemById('Main Tab').checked = false
      })
      view.on('activate-tab', ()=>{
        win.setTitle(label)
        Menu.getApplicationMenu().getMenuItemById(label).checked = true
      })
      view.on('close', ()=>{
        // There is no menu.remove() ...
        Menu.getApplicationMenu().getMenuItemById(label).visible = false
      })

      boot(sbot, view, log, (err, result)=>{
        if (err) {
          log('Failed to boot: ' + err.message)
          process.exit(1)
        }
        const {webapp, url} = result
        const name = webapp.value.content.name
        
        async function tryLoad() {
          try {
            log('loading webapp blob ...')
            await view.webContents.loadURL(url)
          } catch(err) {
            log(`error loading ${url}: ${err.message} -- retrying`)
            tryLoad()
          }
        }
        tryLoad()
        log(`done booting webapp "${name}"`)
      })
    }

  }
}

function boot(sbot, win, log, cb) {
  return openApp(null, null, cb)

  function openApp(invite, id, cb) {
    const conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) return cb(new Error('invite parse error'))

    server(sbot, win, log, conf, id, (err, ssb, config, myid, browserKeys) => {
      if (err) {
        log(`sbot failed: ${err.message}`)
        return cb(err)
      }
      
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      win.once('close', e=>{
        log('window/tab closed -- closing sbot')
        ssb.close()
      })
      
      log('Waiting for navigation to /about.')
      win.webContents.once('did-navigate', e => {
        log('Waiting for dom-ready on obbout page ..')

        win.webContents.once('dom-ready', e => {
          log('dom ready on about page')

          puppeteer(win.webContents)

          ssb.bayofplenty.addWindow(win, browserKeys, consoleMessageSource(win.webContents))

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
function server(sbot, win, log, conf, id, cb) {
  if (!conf) conf = JSON.parse(fs.readFileSync(join(__dirname, '.trerc')))
  conf = Object.assign({}, JSON.parse(fs.readFileSync(join(__dirname, 'default-config.json'))), conf || {})
  
  if (!conf.network) return cb(new Error('No network specified'))
  let datapath = getDatapath(conf.network, null)
  if (!id) {
    return getOrCreateSbot(datapath, cb)
  }
  console.log('Looking for existing datapath for network', conf.network)
  pull(
    listPublicKeys(conf.network),
    pull.find( r => {return r.id == id}, (err, result)=>{
      console.log('XXX done', err)
      if (err) return cb(new Error(`unknown identity: ${id}, ${err.message}`))
      datapath = result.datapath
      console.log('done:', datapath)
      getOrCreateSbot(datapath, cb)
    })
  )

  function getOrCreateSbot(datapath, cb) {
    console.log('XXX Creating sbot with datapath', datapath)
    const entry = sbots[datapath]
    if (entry) {
      entry.refCount++
      const {ssb, config, myid, browserKeys} = entry
      log('re-using sbot')
      return cb(null, ssb, config, myid, browserKeys)
    }
    conf.path = datapath
    sbot(conf, (err, ssb, config, myid, browserKeys) => {
      if (!err) {
        log(`sbot started, ssb id ${myid}, datapath: ${datapath}`)
        sbots[datapath] = {
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
}

function askForInvite(win, log, cb) {
  let done = false
  
  const port = 18484
  win.webContents.loadFile(__dirname + '/public/invite.html')
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

function consoleMessageSource(webContents) {
  const p = Pushable(true)

  webContents.on('console-message', (e, level, message, line, sourceUrl) =>{
    p.push({
      level: '_ info warn error'.split(' ')[level],
      message, line
    })
  })
  return p.source
}

