const debug = require('debug')('bop:tab-driver')
const Page = require('../../page')
const dummyPage = require('../dummy-page')

module.exports = function tab_driver(win, makeBrowserView, initNewTab, opts) {
  return {
    makeView,
    removeAllViews,
    addView,
    manageLifetime
  }
  function removeAllViews() {
    debug('removing all views')
    for(;;) {
      let v = win.getBrowserViews()[0]
      if (v) win.removeBrowserView(v); else break
    }
  }

  function addView(view) {
    debug('adding view')
    win.addBrowserView(view)
    // Needed to force a window redraw
    const bounds = win.getBounds()
    const bogusBounds = Object.assign({}, bounds)
    bogusBounds.x += 1
    bogusBounds.width -= 1
    win.setBounds(bogusBounds)
    setTimeout( ()=>{
      win.setBounds(bounds)
    }, 0)
  }

  function makeView(newTabOpts) {
    const size = win.getContentSize()
    const {topMargin, bottomMargin} = opts
    const bounds = {x: 0, y: topMargin, width: size[0], height: size[1] - topMargin - bottomMargin}
    if (process.env.DEBUG_TABS) {
      bounds.height = 100
    }
    const view = makeBrowserView()
    debug('make new view with bounds %o', bounds)
    view.setBounds(bounds)
    view.setAutoResize({width: true, height: true})
    return view
  }

  function manageLifetime(view, tab, newTabOpts) {

    function onWinClosed() {
      debug(`parent window closed before tab ${tab.id} -- destroying tab`)
      tab.destroy()
    }

    win.on('closed', onWinClosed)
    tab.on('close', ()=>{
      debug(`tab ${tab.id} closesd, removing listener for window closed`)
      win.off('closed', onWinClosed)
    })

    view.webContents.once('dom-ready', async e => {
      debug('dom ready on new tab %d', tab.id)
      tab.page = await Page(view.webContents)
      debug('Page initialized')

      tab.page.once('close', ()=>{
        debug('page close event')
      })
      initNewTab(tab, newTabOpts)
    })
    view.webContents.loadURL(dummyPage).catch(err=>{
      console.error('Error loading page from data: URL', err.message)
    })
  }
}
