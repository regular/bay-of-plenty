const debug = require('debug')('bop:tabbar')
const {EventEmitter} = require('events')
const {parse} = require('url')

module.exports = function(page) {
  const emitter = new EventEmitter()

  page.on('request', async req =>{
    const name = parse(req.url()).path.split('/')[1]
    debug('intercepted request to trigger event %s', name)
    try {
      emitter.emit(name, JSON.parse(req.postData()))
    } catch(err) {
      debug('failed to emit requested event', err.message)
    }
    await req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({message: 'ok'})
    })
  })

  function sendMessage(name, detail, cb) {
    cb = cb || (()=>{})
    const args = [fireEvent, name, detail]
    debug('sendMessage %s %o', name, detail)
    page.evaluate.apply(page, args)
    .catch( err =>{
      console.error(`tabbar: sendMessage "${name}" failed ${err.message}`)
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
  function onTabAddTag(id, tag, value) {
    sendMessage('on-tab-add-tag', {id, tag, value})
  }
  function onTabRemoveTag(id, tag) {
    sendMessage('on-tab-remove-tag', {id, tag})
  }
  return Object.assign(emitter, {
    onNewTab,
    onTabActivated,
    onTabClosed,
    onTabTitleChanged,
    onTabAddTag,
    onTabRemoveTag
  })
}
