const {EventEmitter} = require('events')
const debug = require('debug')('bop:tabs')

module.exports = function(win, BrowserView, webPreferences, init) {
  const views = Object.fromEntries(Array.from(win.getBrowserViews()).map(view=>[view.id, view]))
  views._main = null
  let currId = Object.keys(views).sort()[0]

  function makeSoleChild(view) {
    console.log(`makeSoleChild view #${view == null ? 'main'  : view.id}`)
    while(win.getBrowserViews().length) {
      win.removeBrowserView(win.getBrowserViews()[0])
    }
    if (view !== null) win.addBrowserView(view)
  }
  
  function activateTab(viewId) {
    if (`${viewId}` == currId) return
    const view = views[viewId]
    if (view === undefined) return
    const oldView = views[currId]
    if (oldView) {
      oldView.emitter.emit('deactivate-tab')
    }
    currId = `${viewId}`
    makeSoleChild(view)
    if (view) {
      view.emitter.emit('activate-tab')
    }
  }

  function newTab() {
    const view = new BrowserView({webPreferences})
    view.emitter = new EventEmitter()
    makeSoleChild(view)
    const size = win.getContentSize()
    const topMargin = 0
    const bottomMargin = 0
    const bounds = {x: 0, y: topMargin, width: size[0], height: size[1] - topMargin - bottomMargin}
    view.setBounds(bounds)
    view.setAutoResize({width: true, height: true})
    //view.setBackgroundColor('#ff0000')
    currId = `${view.id}`
    debug(`New Tab, id: ${currId}`)
    views[currId] = view
    activateTab(currId)

    function onWinClosed() {
      debug(`tab ${view.id} parent window closed before tab -- destroying tab`)
      delete views[`${view.id}`]
      if (view.id == currId) {
        view.emitter.emit('deactivate-tab')
      }
      view.emitter.emit('close')
      view.emitter.removeAllListeners()
      view.destroy()
    }

    win.on('closed', onWinClosed)
    view.emitter.on('close', ()=>{
      debug(`tab ${view.id} closesd, removing listener for window closed`)
      win.off('closed', onWinClosed)
    })

    view.webContents.once('dom-ready', e => {
      console.log('dom ready on new tab')
      view.webContents.executeJavaScript(`document.write('<h2>Index: ${currId}</h2>')`)
      init({
        id: view.id,
        webContents: view.webContents,
        once: view.emitter.once.bind(view.emitter),
        on: view.emitter.on.bind(view.emitter),
        removeAllListeners: view.emitter.removeAllListeners.bind(view.emitter)
      })
    })
    view.webContents.loadFile(__dirname + '/public/newtab.html')
  }

  function closeTab() {
    const oldId = currId
    debug(`close tab ${oldId}`)
    const view = views[oldId]
    if (!view) {
      return console.error(`view ${oldId} not found`)
    }
    nextTab()
    delete views[oldId]
    view.emitter.emit('deactivate-tab')
    view.emitter.emit('close')
    view.emitter.removeAllListeners()
    /*
    debug('destroy view.webContents')
    view.webContents.destroy()
    */
    debug('destroy view')
    view.destroy()
  }

  function gotoTab(offset) {
    const keys = Object.keys(views).sort()
    const newId = keys[(keys.indexOf(currId)+keys.length+offset) % keys.length]
    console.log(`current id: ${currId}, ${typeof currId}`)
    console.log(`keys: ${keys}`)
    console.log(`index: ${keys.indexOf(currId)}`)
    console.log(`new id: ${newId}`)
    if (newId == currId || newId == undefined) return
    activateTab(newId)
  }

  function previousTab() {
    gotoTab(-1)
  }

  function nextTab() {
    gotoTab(1)
  }

  function currentView() {
    return views[currId] || win
  }
  
  return {
    newTab,
    closeTab,
    activateTab,
    previousTab,
    nextTab,
    currentView
  }
}
