const {client} = require('tre-client')

client( (err, ssb, config) =>{
  if (err) return console.error(`Failed to connect to ssb-server: ${err.message}`)

  document.body.innerHTML = 'Hello from client-app'

  ssb.whoami((err, feed) =>{
    if (err) return console.error(err.message)
    console.info('feed id: %s', feed.id)
    console.info('app key: %s', config.caps.shs)
  })
})
