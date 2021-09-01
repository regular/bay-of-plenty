const debug = require('debug')('bop:tab-driver')

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
    view.setBounds(view.getBounds())
  }

  function makeView(newTabOpts) {
    const size = win.getContentSize()
    const {topMargin, bottomMargin} = opts
    const bounds = {x: 0, y: topMargin, width: size[0], height: size[1] - topMargin - bottomMargin}
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

    view.webContents.once('dom-ready', e => {
      debug('dom ready on new tab %d', tab.id)
      //view.webContents.executeJavaScript(`document.write('<h2>Index: ${tab.id}</h2>')`)
      initNewTab(tab, newTabOpts)
    })
    view.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E').catch(err=>{
      console.error('Error loading page from data: URL', err.message)
    })
  }
}
