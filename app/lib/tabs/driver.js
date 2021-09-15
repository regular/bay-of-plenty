const debug = require('debug')('bop:tab-driver')
const Page = require('../../page')

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
  }

  function makeView(newTabOpts) {
    const view = makeBrowserView()
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
    view.webContents.loadURL('data:text/html;charset=utf-8,%3Chtml%3E%3C%2Fhtml%3E').catch(err=>{
      console.error('Error loading page from data: URL', err.message)
    })
  }
}
