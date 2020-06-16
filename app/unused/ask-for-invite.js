      log('asking for invite code ...')
      askForInvite(win, log, (err, invite) => {
        if (err) {
          log('Failed to ask for invite code:', err.message)
          return cb(err)
        }
        const conf = confFromInvite(invite)
        if (!conf) {
          log('invite code parse error')
          return cb(new Error('inivte code syntax error'))
        }
        log('success, conf is:', JSON.stringify(conf, null, 2))
        log('retrying to start sbot')
        return server(sbot, win, log, conf, cb)
      })
function askForInvite(win, log, cb) {
  let done = false
  
  const port = 18484
  win.webContents.loadFile(__dirname + '/public/invite.html')
  win.webContents.once('will-navigate', (e, url) =>{
    e.preventDefault()
    log('Prevented attempt to navigate to', url)
    const query = parse(url).query
    log('query is', query)
    if (!query) return cb(new Error('No query in add-network URL'))
    const fields = qs.parse(query)
    const code = fields.code
    log('code is', code)
    if (!code) return cb(new Error('No code in query in add-network URL'))
    cb(null, code)
  })
}
