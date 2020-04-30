// Wed Apr 29 13:57:31 CEST 2020
// -
// Wed Apr 29 14:23:34 CEST 2020
//
// Wed Apr 29 17:26:34 CEST 2020
// -
// 20 min
//
// Thu Apr 30 10:11:29 CEST 2020
// -
//
const {EventEmitter} = require('events')

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
    console.log('New Tab')
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
    views[currId] = view
    activateTab(currId)
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
    const view = views[oldId]
    if (!view) return
    nextTab()
    delete views[oldId]
    view.emitter.emit('deactivate-tab')
    view.emitter.emit('close')
    view.emitter.removeAllListeners()
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
  
  return {
    newTab,
    closeTab,
    activateTab,
    previousTab,
    nextTab
  }
}
