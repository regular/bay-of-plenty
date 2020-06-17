const debug = require('debug')('bop:main')

const pull = require('pull-stream')
const Pushable = require('pull-pushable')

const invites = require('tre-invite-code')

const Page = require('./page')
const PageLog = require('./page-log')
const Pool = require('./sbot-pool')

const menuTemplate = require('./menu')
const secure = require('./secure')
const Tabs = require('./tabs')

const webPreferences = {
  enableRemoteModule: false,
  nodeIntegration: false,
  contextIsolation: true
}

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

module.exports = function inject(electron, Sbot) {
  const {app, BrowserWindow, BrowserView, Menu} = electron
  const pool = Pool(Sbot)

  app.allowRendererProcessReuse = true

  debug(`node version ${process.version}`)
  debug(`process.env.DEBUG ${process.env.DEBUG}`)

  let win
  app.on('ready', start)
  /*
  app.on('will-quit', e=>{
    e.preventDefault()
  })
  */

  async function start() {
    secure(app)  

    win = new BrowserWindow({
      backgroundColor: '#333', 
      width: 1200,
      height: Math.round(1200*9/16),
      darkTheme: true,
      webPreferences
    })
    win.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E`')

    const tabs = Tabs(win, BrowserView, webPreferences, initTabView)
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app, tabs)))
    win.on('closed', () => {
      debug('window closed')
      win = null
    })

    try {
      await initTabView(win)
    } catch(err) {
      console.error(err.message)
      process.exit(1)
    }

    async function initTabView(view) {
      updateMenu(electron, win, view, tabs)

      const page = await Page(view.webContents)
      debug('Page initialized')
      PageLog(page, tabidFromview(view))
      
      page.evaluateOnNewDocument(debug=>localStorage.debug=debug, process.env.DEBUG)
      .catch(err =>{
        debug('evaluateOnNewDocument "localStorage.debug=process.env.DEBUG" failed.')
      })

      const result = await boot(pool, page, view)
      const {webapp, url} = result
      const name = webapp.value.content.name
      await loadURL(page, url)

      debug(`done booting webapp "${name}"`)
    }
  }
}

async function loadURL(page, url) {
  debug('loading webapp blob ...')
  const response = await page.goto(url, {
    timeout: 90000
  })
  if (!response.ok()) {
    throw new Error(`Server response: ${response.status()} ${response.statusText()}`)
  }
}

function updateMenu(electron, win, view, tabs) {
  const {Menu, MenuItem} = electron
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
}

async function boot(pool, page, view) {
  return new Promise((resolve, reject)=>{
    openApp(null, null, (err, result) =>{
      if (err) return reject(err)
      resolve(result)
    })
  })

  function openApp(invite, id, cb) {
    debug('openAPp called')
    const conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) {
      const err = new Error('invite parse error')
      debug(err.message)
      return cb(err)
    }

    const {unref, promise} = pool({conf, id})
    promise.catch(err =>{
      debug(`sbot-pool failed: ${err.message}`)
      return cb(err)
    }).then( ({ssb, config, myid, browserKeys}) => {
       
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      view.once('close', e=>{
        debug('view closed -- unref sbot')
        unref()
      })
      
      debug('Waiting for navigation to /about.')
      page.once('framenavigated', async e=>{
        debug('Waiting for DOMContentLoaded on obout page ..')
        
        //page.once('DOMContentLoaded', async e => {
          debug('dom ready on about page')
          debug('setting browser keypair')
          await page.evaluate(keys=>{
            console.log("setting keys")
            window.localStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
          }, browserKeys)

          ssb.bayofplenty.addWindow(view, browserKeys, consoleMessageSource(view.webContents))
        })
      //})

      const bootKey = (conf && conf.boot) || config.boot
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) return cb(err)
        const url = `http://127.0.0.1:${config.ws.port}/about/${encodeURIComponent(bootKey)}`
        cb(null, {webapp: result.kv, url})
      })
    })
  }
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

function tabidFromview(view) {
  let tabid = view.id
  if (view.constructor.name == 'BrowserWindow') {
    tabid = 0
  }
  return tabid
}

function wait(s) {
  return new Promise( resolve => {
    setTimeout(resolve, s * 1000)
  })
}

