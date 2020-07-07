const debug = require('debug')('bop:tabbar')

module.exports = function(page) {

  function sendMessage(name, detail, cb) {
    cb = cb || (()=>{})
    const args = [fireEvent, name, detail]
    debug('sendMessage %s %o', name, detail)
    page.evaluate.apply(page, args)
    .catch( err =>{
      console.error(`tabbar: sendMessage failed ${err.message}`)
      cb(err)
    })
    .then(()=>cb(null))
  }

  // evaled in browser context
  function fireEvent(name, detail) {
    const event = new CustomEvent(name, {detail})
    window.dispatchEvent(event)
  }

  function onNewTab(id, title) {
    sendMessage('on-new-tab', {id, title})
  }
  function onTabActivated(id) {
    sendMessage('on-tab-activated', {id})

  }
  function onTabClosed(id) {
    sendMessage('on-tab-closed', {id})
  }
  function onTabTitleChanged(id, title) {
    sendMessage('on-tab-title-changed', {id, title})
  }
  return {
    onNewTab,
    onTabActivated,
    onTabClosed,
    onTabTitleChanged
  }
}
