const {client} = require('tre-client')

client( (err, ssb, config) =>{
  if (err) return console.error(`Failed to connect to ssb-server: ${err.message}`)

  ssb.whoami((err, feed) =>{
    if (err) return console.error(err.message)
    console.info('feed id: %s', feed.id)
    console.info('app key: %s', config.caps.shs)
    openView()
  })

  function openView() {
    const code = `
      module.exports = function(kvm) {
        const {key, value, meta, seq} = kvm
        const {content, author} = value
        return [
          [content.type, author]
        ]
      }`
    ssb.sandviews.openView(code, (err, handle) => {
      if (err) return console.error(err.message)
      console.info('sandview handle: %s', handle)
      /*
      pull(
        sandviews.read(handle, {values: false}),
        pull.log()
      )
      */
    })
  }
})
