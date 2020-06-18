const debug = require('debug')('bop:main')

const pull = require('pull-stream')
const Pushable = require('pull-pushable')
//const pullPupp = require('./pull-puppeteer')


const invites = require('tre-invite-code')

const Page = require('./page')
const PageLog = require('./page-log')
const consoleReflection = require('./lib/page-console-reflection')
const ExposeFunctionAgain = require('./expose-function')
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
      const reflection = consoleReflection(page, err=>{
        console.error(`page reflection ended: ${err.message}`)
      })

      const openApp = OpenApp(pool, page, view, reflection)
      
      // when exposed here, the exposed function is broken
      // after navigation. (it then is tha underlying native function)
      // so, after navigation, we need to resotre the js part using
      // exposeFunctionAgain
      //await page.exposeFunction('myfunc', async (a)=>a+1)
      
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

      page.on('domcontentloaded', async ()  =>{
        reflection.enable()
      })

      openApp(null, null, (err, result) =>{
        if (err) {
          console.error(err.message)
          app.quit()
        }
        const {webapp, url} = result
        const name = webapp.value.content.name
        loadURL(page, url)
      })
    }
  }
}

function OpenApp(pool, page, view, reflection) {
  //const exposeFunctionAgain = ExposeFunctionAgain(page)

  return function openApp(invite, id, cb) {
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
       debug(`browser public key: ${browserKeys.public}`)
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      view.once('close', e=>{
        debug('view closed -- unref sbot')
        unref()
      })

      const bootKey = (conf && conf.boot) || config.boot
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) return cb(err)
        const url = `http://127.0.0.1:${config.ws.port}/about/${encodeURIComponent(bootKey)}`
        reflection.reset()

        page.once('domcontentloaded', async ()  =>{
          console.log('domcontentloaded')
          ssb.bayofplenty.addWindow(view, browserKeys, consoleMessageSource(view.webContents))
          //console.log('exposing again')
          //await exposeFunctionAgain('myfunc', async (a)=>a+1)

          debug('setting browser keypair')
          await page.evaluate(async (keys)=>{
            /*
            console.log('calling myfunc()')
            const r = await myfunc(5)
            console.log('bar result',r)
            */

            console.log("setting keys")
            window.localStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
         
            //window.dispatchEvent(new Event('bay-of-plenty'))
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

