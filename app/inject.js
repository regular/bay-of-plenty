const fs = require('fs')
const {join, resolve} = require('path')
const debug = require('debug')('bop:main')

const Page = require('./page')
const Logging = require('./lib/logging')
const makeTabs = require('./lib/tabs')
const Menu = require('./menu')
const secure = require('./secure')
const Pool = require('./sbot-pool')
const OpenApp = require('./open-app')
const localConfig = require('./lib/local-config')
const AppPermissions = require('./app-permissions')

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

const DEBUG_TABS = process.env.DEBUG_TABS

module.exports = function inject(electron, Sbot, argv) {
  debug('argv: %o', argv)
  const makeMenu = Menu(electron.Menu, electron.MenuItem)

  const webPreferences = {
    enableRemoteModule: false,
    nodeIntegration: false,
    contextIsolation: true,
    worldSafeExecuteJavaScript: true,
    partition: argv['clean-session'] ? 'foo' : undefined
  }

  const {app, BrowserWindow, BrowserView, session} = electron
  const pool = Pool(Sbot)

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
    if (unrefMainSbot) {
      debug('unref main sbot')
      unrefMainSbot()
    }
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
  
    const getPermission = AppPermissions(electron, win)

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
      initTab,
      setWindowTitle,
      DEBUG_TABS
    })


    // private API for private sbot plugin
    const bop = {
      queryAppPermission,
      setTabTitle: tabs.setTabTitle,
      getTabById: tabs.getTabById
    } 

    function getSbot(conf, id) {
      return pool.get({conf, bop, id})
    }
    
    function getMainSbot() {
      const conf = localConfig(argv, {launchLocal: filename, canned: true})
      const {unref, promise} = getSbot(conf, null)
      unrefMainSbot = unref
      return promise
    }

    const mainSbotPromise = getMainSbot()
    function queryAppPermission(app, perm, cb) {
      mainSbotPromise.then( ({ssb})=> {
        getPermission(ssb, app, perm, cb)
      })
    }

    const openApp = OpenApp(
      getSbot,
      tabs,
      argv
    )
    bop.openApp = openApp

    // --- Menu

    const menu = makeMenu(win, tabs)
    menu.on('quit', ()=>app.quit())
    menu.on('reload', ()=>tabs.currentTab().view.webContents.reload())
    menu.on('toggle-dev-tools', ()=>{
      tabs.currentTab().view.webContents.toggleDevTools() 
    })
    menu.on('new-tab', ()=>tabs.newTab())
    menu.on('close-tab', ()=>tabs.currentTab().close())
    menu.on('next-tab', ()=>tabs.nextTab())
    menu.on('previous-tab', ()=>tabs.previousTab())
    menu.on('activate-tab', ({id})=>{
      tabs.getTabById(id).activate()
    })

    // --

    tabs.newTab({
      launchLocal: filename
    })

    async function initTab(tab, newTabOpts) {
      debug('init tab: %O', newTabOpts)
      menu.keepInSync(tab)

      tab.on('close', ({last})=>{
        debug('tab closed, was last:', last)
        tab.view.webContents.destroy()

        if (last && win && !win.isDestroyed()) {
          setTimeout( ()=> win.close(), 80)
        }
      })

      function setAlert(text) {
        tabs.addTag(tab.id, 'alert', {text})
        console.log(
          `setting alert in tab ${tab.id} because console.error was called with "${text}"`
        )
        if (argv['fail-on-error']) {
          console.error('exiting because --fail-on-error is set')
          process.exit(1)
        }
      }

      Logging(tab.page, {
        tabid: tab.id,
        setAlert
      })

      const launchLocalInAllTabs = argv['launch-local-in-all-tabs'] ?
        {launchLocal: filename} : {}

      // TODO:- load canned config here
      //      - load secret here
      //      - put uploadBlobDir: true, appPermissions: tre
      //        into canned config

      openApp(tab, null, null, Object.assign(
        {}, launchLocalInAllTabs, newTabOpts
      ), (err, result) =>{
        if (err) {
          console.error(err.message)
          throw err
        }
        loadURL(tab.page, result.url).catch(err =>{
          console.error('Unable to load new tab content', err.message)
        })
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

