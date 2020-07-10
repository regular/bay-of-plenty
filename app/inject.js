const debug = require('debug')('bop:main')
const {join} = require('path')

const pull = require('pull-stream')
const Pushable = require('pull-pushable')

const invites = require('tre-invite-code')

const Page = require('./page')
const PageLog = require('./page-log')
const consoleReflection = require('./lib/page-console-reflection')
const Pool = require('./sbot-pool')

const menuTemplate = require('./menu')
const secure = require('./secure')
const Tabs = require('./tabs')
const Tabbar = require('./tabbar')
const loadScript = require('./script-loader')

const webPreferences = {
  enableRemoteModule: false,
  nodeIntegration: false,
  contextIsolation: true
}

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

const DEBUG_TABS = 1

module.exports = function inject(electron, Sbot) {
  const {app, BrowserWindow, BrowserView, Menu} = electron
  const pool = Pool(Sbot)

  app.allowRendererProcessReuse = true

  debug(`node version ${process.version}`)
  debug(`process.env.DEBUG ${process.env.DEBUG}`)

  let win
  app.on('ready', start)

  app.on('will-quit', e=>{
    e.preventDefault()

    pool.allDone().then(()=>{
      debug('All sbots are closed')
      // give it a second to finish log output
      setTimeout( ()=>{
        debug('Good Bye!')
        process.exit(0)
      }, 1000)
    })
  })

  async function start() {
    secure(app)  

    win = new BrowserWindow({
      backgroundColor: '#333', 
      title: 'Bay of Plenty',
      width: 1200,
      height: Math.round(1200*9/16),
      darkTheme: true,
      webPreferences
    })
    if (DEBUG_TABS) {
      win.openDevTools()
    }
    win.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E`')

    const mainPage = await Page(win.webContents)
    await loadScript(mainPage, join(__dirname, 'tabbar-browser.js'), {
      keepIntercepting: true
    })
    const tabbar = Tabbar(mainPage)
    tabbar.on('new-tab', e=>{
      tabs.newTab()
    })
    tabbar.on('previous-tab', e=>{
      tabs.previousTab()
    })
    tabbar.on('next-tab', e=>{
      tabs.nextTab()
    })
    tabbar.on('activate-tab', e=>{
      tabs.activateTab(e.id)
    })
    tabbar.on('close-tab', e=>{
      tabs.closeTab(e.id)
    })

    function makeView() {
      return new BrowserView({webPreferences})
    }

    const tabs = Tabs(win, makeView, initTabView, {
      topMargin: 32,
      bottomMargin: DEBUG_TABS ? 250 : 0
    })
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(app, tabs)))
    win.on('closed', () => {
      debug('window closed')
      win = null
    })

    tabs.newTab()

    async function initTabView(view) {
      updateMenu(electron, win, view, tabs)

      // keep tabbar in sync
      tabbar.onNewTab(view.id, `Tab ${view.id}`)
      view.on('activate-tab', ()=>{
        tabbar.onTabActivated(view.id)
      })
      view.on('close', ({last})=>{
        debug('view closed, was last:', last)
        tabbar.onTabClosed(view.id)
        if (last && win && !win.isDestroyed()) win.close()
      })

      //tabbar.onTabAddTag(view.id, 'loading')

      const page = await Page(view.webContents)
      debug('Page initialized')
      PageLog(page, view.id)
      const reflection = consoleReflection(page, err=>{
        console.error(`page reflection ended: ${err.message}`)
      })

      const openApp = OpenApp(pool, page, view, reflection, tabbar)
      
      await page.evaluateOnNewDocument(debug=>{
        console.log(`%c setting localStorage.debug to %c ${debug}`, 'color: yellow;', 'color: green;')
        localStorage.debug=debug
      }, process.env.DEBUG || '')

      page.on('request', request=>{
        if (request.isNavigationRequest()) {
          debug(`navigation request to ${request.url()}`)
          reflection.reset()
        }
      })
      page.on('framenavigated', frame =>{
        debug(`frame navigated ${frame._url}`)
      })

      page.on('domcontentloaded', ()  =>{
        debug('domcontentloaded')
        reflection.enable()
      })

      openApp(null, null, (err, result) =>{
        if (err) {
          console.error(err.message)
          app.quit()
        }
        const {webapp, url} = result
        const name = webapp.value.content.name
        //tabbar.onTabTitleChanged(view.id, name)
        loadURL(page, url).then(()=>{
          //tabbar.onTabRemoveTag(view.id, 'loading')
        })
      })
    }
  }
}

function OpenApp(pool, page, view, reflection, tabbar) {

  return function openApp(invite, id, cb) {
    debug('openAPp called')
    tabbar.onTabAddTag(view.id, 'loading')
    const conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) {
      const err = new Error('invite parse error')
      debug(err.message)
      return cb(err)
    }

    const {unref, promise} = pool.get({conf, id})
    promise.catch(err =>{
      debug(`sbot-pool failed: ${err.message}`)
      return cb(err)
    }).then( ({ssb, config, myid, browserKeys}) => {
       debug(`browser public key: ${browserKeys.public}`)
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      view.once('close', e=>{
        debug(`view ${view.id} closed -- unref sbot`)
        unref()
      })

      const bootKey = (conf && conf.boot) || config.boot
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) return cb(err)
        const url = `http://127.0.0.1:${config.ws.port}/about/${encodeURIComponent(bootKey)}`
        reflection.reset()

        debug('webapp: %O', result.kv.value.content)
        const title = result.kv.value.content.name
        tabbar.onTabTitleChanged(view.id, title)

        page.once('domcontentloaded', async ()  =>{
          debug('domcontentloaded (launch page)')
          ssb.bayofplenty.addWindow(view, browserKeys, consoleMessageSource(view.webContents))

          page.once('domcontentloaded', async e  =>{
            debug('domcontentloaded (webapp)')
            debug('removing loading tag')
            tabbar.onTabRemoveTag(view.id, 'loading')
          })

          debug('setting browser keypair')
          await page.evaluate(async (keys)=>{
            console.log("setting keys")
            window.localStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
          }, browserKeys)
        })

        cb(null, {webapp: result.kv, url})
      })
    })
  }
}

async function loadURL(page, url) {
  console.error(`loading ${url} ...`)
  const response = await page.goto(url, {
    timeout: 90000
  })
  console.error('done loading')
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

  //win.setTitle(label)
  view.on('activate-tab', ()=>{
    //win.setTitle(label)
    Menu.getApplicationMenu().getMenuItemById(label).checked = true
  })
  view.on('close', ()=>{
    // There is no menu.remove() ...
    Menu.getApplicationMenu().getMenuItemById(label).visible = false
  })
}

function confFromInvite(invite) {
  invite = invite.replace(/\s*/g,'')
  const conf = invites.parse(invite)
  return conf ? conf : null
}

// TODO: remove
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

function wait(s) {
  return new Promise( resolve => {
    setTimeout(resolve, s * 1000)
  })
}

