const debug = require('debug')('bop:main')
const {join} = require('path')

const Page = require('./page')
const Logging = require('./lib/logging')

const menuTemplate = require('./menu')
const loadScript = require('./script-loader')

const secure = require('./secure')
const Pool = require('./sbot-pool')
const Tabs = require('./tabs')
const Tabbar = require('./tabbar')
const OpenApp = require('./open-app')

const webPreferences = {
  enableRemoteModule: false,
  nodeIntegration: false,
  contextIsolation: true
}

process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 1

const DEBUG_TABS = process.env.DEBUG_TABS

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
    win.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E')

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
      tabbar.onNewTab(view.id, `⌘${view.id} — loading`)
      view.on('activate-tab', ()=>{
        tabbar.onTabActivated(view.id)
      })
      view.on('close', ({last})=>{
        debug('view closed, was last:', last)
        tabbar.onTabClosed(view.id)
        if (last && win && !win.isDestroyed()) win.close()
      })

      const page = await Page(view.webContents)
      debug('Page initialized')

      function setAlert(text) {
        tabbar.onTabAddTag(view.id, 'alert')
        console.log(
          `setting alert in tab ${view.id} because console.error was called with "${text}"`
        )
      }

      Logging(page, {
        tabid: view.id,
        setAlert
      })

      function onLoading(loading) {
        if (loading) {
          tabbar.onTabAddTag(view.id, 'loading')
        } else {
          tabbar.onTabRemoveTag(view.id, 'loading')
        }
      }

      function onTitleChanged(title) {
        tabbar.onTabTitleChanged(view.id, title)
      }

      const openApp = OpenApp(pool, page, view, {
        onLoading,
        onTitleChanged
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

  view.on('activate-tab', ()=>{
    Menu.getApplicationMenu().getMenuItemById(label).checked = true
  })
  view.on('close', ()=>{
    // There is no menu.remove() ...
    Menu.getApplicationMenu().getMenuItemById(label).visible = false
  })
}


