// See https://electronjs.org/docs/tutorial/security#3-enable-context-isolation-for-remote-content
// TODO: use https
const {shell} = require('electron')
const debug = require('debug')('bop:security')

function isURLAllowed(url) {
  if (url.startsWith('https://127.0.0.1/')) return true
  // TODO: remove non-https
  if (url.startsWith('http://127.0.0.1/')) return true
  debug('URL not ok', url)
  return false
}

module.exports = function(app) {
  const { session } = require('electron')

  const sess = session.defaultSession

  // 4) Handle Session Permissions
  sess.setPermissionRequestHandler((webContents, permission, cb) => {
    const url = webContents.getURL()
    /*
    if (permission === 'notifications') {
      // Approves the permissions request
        cb(true)
    }
    */
    //if (!url.startsWith('https://my-website.com')) {
    // Denies the permissions request
    debug('Deny %s for %s', permission, url)
    return callback(false)
    //}
  })

  // 6) Define a Content Security Policy
  sess.webRequest.onHeadersReceived((details, cb) => {
    debug('Header received')
    if (Object.keys(details.responseHeaders).map(x=>x.toLowerCase()).includes(
      'content-security-policy'
    )) {
      debug('Found existing CSP', details.responseHeaders['Content-Security-Policy'])
      return cb({})
    }
    debug("setting CSP script-src 'none';")
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["script-src 'none';"]
      }
    })
  })

  // 11) Verify WebView Options Before Creation

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Strip away preload scripts if unused or verify their location is legitimate
      delete webPreferences.preload
      delete webPreferences.preloadURL

      // Disable Node.js integration
      webPreferences.nodeIntegration = false

      // Verify URL being loaded
      if (!isURLAllowed(params.src)) {
        event.preventDefault()
      }
    })
  })

  // 12) Disable or limit navigation

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      debug('will-navigate to %s', navigationUrl)
      if (!isURLAllowed(navigationUrl)) {
        debug('Prevented navigation to %s', navigationUrl)
        event.preventDefault()
      }
    })
  })

  // 13) Disable or limit creation of new windows
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
      debug('new-window')
      // In this example, we'll ask the operating system
      // to open this event's url in the default browser.
      if (!isURLAllowed(navigationUrl)) {
        debug('Prevented new window for URI %s. Opening externally instead', navigationUrl)
        event.preventDefault()
        shell.openExternalSync(navigationUrl)
      }
    })
  })

}
