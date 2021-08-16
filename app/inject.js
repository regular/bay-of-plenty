const fs = require('fs')
const {resolve} = require('path')
const debug = require('debug')('bop:main')

const Page = require('./page')
const Logging = require('./lib/logging')
const makeTabs = require('./lib/tabs')

const menuTemplate = require('./menu')

const secure = require('./secure')
const Pool = require('./sbot-pool')
const OpenApp = require('./open-app')


process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

const DEBUG_TABS = process.env.DEBUG_TABS


module.exports = function inject(electron, Sbot, argv) {
  debug('argv: %o', argv)

  const webPreferences = {
    enableRemoteModule: false,
    nodeIntegration: false,
    contextIsolation: true,
    worldSafeExecuteJavaScript: true,
    partition: argv['clean-session'] ? 'foo' : undefined
  }

  const {app, BrowserWindow, BrowserView, Menu, session} = electron
  const pool = Pool(Sbot)

  const appByView = []
  function getAppByViewId(id) {
    return appByView[id]
  }
    
  let [filename] = argv._
  if (filename) {
    if (!fs.existsSync(filename)) {
      console.error(`File not found: ${filename}`)
      process.exit(1)
    } else {
      filename = resolve(filename)
      console.log(`Running ${filename}`)
    }
  } else {
    console.log('Running default app')
  }

  app.allowRendererProcessReuse = true

  debug(`node version ${process.version}`)
  debug(`process.env.DEBUG ${process.env.DEBUG}`)

  let win
  app.on('ready', start)
  app.on('will-quit', shutdown)
  app.on('quit', (e, code) => {
    debug('quit %d', code)
  })
  process.on('uncaughtException', err=>{
    console.error('uncaught exception', err.message, err.stack)
    process.exitCode = process.exitCode || 1
    app.quit()
  })
  process.on('unhandledRejection', err=>{
    console.error('unhandled rejection', err.message, err.stack)
    process.exitCode = process.exitCode || 2
    app.quit()
  })

  let unrefMainSbot

  function shutdown(e) {
    debug('shutdown called')
    e.preventDefault()
    debug('waiting for all sbots to close')
    if (unrefMainSbot) unrefMainSbot()
    pool.allDone().then(()=>{
      debug('All sbots are closed')
      // give it a second to finish log output
      setTimeout( ()=>{
        debug('Good Bye!')
        process.exit(process.exitCode)
      }, 1000)
    })
  }

  async function start() {
    if (argv['clear-cache']) {
      console.log('clearing cache')
      await session.defaultSession.clearCache()
    }
    secure(app)  

    win = new BrowserWindow({
      backgroundColor: '#333', 
      title: 'Bay of Plenty',
      width: 1200,
      height: Math.round(1200*9/16),
      darkTheme: true,
      webPreferences
    })
    win.on('closed', () => {
      debug('window closed')
      win = null
    })
    if (DEBUG_TABS) {
      win.openDevTools()
    }
    win.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E')
    const mainPage = await Page(win.webContents)

    function setWindowTitle(title) {
      const {prefix} = title
      if (prefix || prefix == false) {
        title = title.title
      }
      if (prefix !== false) {
        title = `${prefix || 'Bay of Plenty'} — ${title}`
      }
      win.setTitle(title)
    }

    Logging(mainPage, {
      tabid: '[tabbar]',
      setAlert: text => {
        console.error(`FATAL: error in tabbar: ${text}`)
        process.exit(1)
      }
    })

    function makeView() {
      return new BrowserView({webPreferences})
    }

    const tabs = await makeTabs(win, mainPage, {
      makeView,
      initTabView,
      setWindowTitle,
      DEBUG_TABS
    })

    function setTabTitle(viewId, title) {
      tabs.setTabTitle(viewId, title)
    }

    let bop // private API for private sbot plugin

    function getSbot(conf, id) {
      return pool.get({conf, bop, id})
    }
    
    function getMainSbot() {
      console.log('Starting main sbot ..')
      const {unref, promise} = getSbot(null, null)
      unrefMainSbot = unref
      return promise
    }
    const mainSbot = await getMainSbot()
    console.log('Done starting main sbot.')

    const openApp = OpenApp(
      getSbot,
      tabs,
      appByView,
      argv
    )

    bop = {getAppByViewId, setTabTitle, openApp} 

    // ---

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app, tabs)))

    tabs.newTab({
      launchLocal: filename
    })

    async function initTabView(view, newTabOpts) {
      debug('init tab: %O', newTabOpts)
      updateMenu(electron, win, view, tabs)

      view.on('close', ({last})=>{
        debug('view closed, was last:', last)
        if (last && win && !win.isDestroyed()) {
          setTimeout( ()=> win.close(), 80)
        }
      })
      const page = await Page(view.webContents)
      debug('Page initialized')

      page.once('close', ()=>{
        debug('page close event')
      })

      function setAlert(text) {
        tabs.addTag(view.id, 'alert', {text})
        console.log(
          `setting alert in tab ${view.id} because console.error was called with "${text}"`
        )
        if (argv['fail-on-error']) {
          console.error('exiting because --fail-on-error is set')
          process.exit(1)
        }
      }

      Logging(page, {
        tabid: view.id,
        setAlert
      })

      const launchLocalInAllTabs = argv['launch-local-in-all-tabs'] ?
        {launchLocal: filename} : {}

      // TODO:- load canned config here
      //      - load secret here
      //      - put uploadBlobDir: true, appPermissions: tre
      //        into canned config

      openApp(null, null, Object.assign({
        viewId: view.id,
        page
      }, launchLocalInAllTabs, newTabOpts), (err, result) =>{
        if (err) {
          console.error(err.message)
          throw err
        }
        loadURL(page, result.url)
      })
    }
  }
}

// -- util

async function loadURL(page, url) {
  debug(`loading ${url} ...`)
  const response = await page.goto(url, {
    timeout: 90000
  })
  debug('done loading')
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
  }
  tabMenu.append(new MenuItem({
    label,
    accelerator,
    type: 'radio',
    id: label,
    click: ()=>{
      tabs.activateTab(`${view.id}`)
    }
  }))
  Menu.setApplicationMenu(appMenu)
  Menu.getApplicationMenu().getMenuItemById(label).checked = true

  view.on('activate-tab', ()=>{
    Menu.getApplicationMenu().getMenuItemById(label).checked = true
  })
  view.on('close', ()=>{
    // There is no menu.remove() ...
    Menu.getApplicationMenu().getMenuItemById(label).visible = false
  })
}

