const net = require('net')
const debug = require('debug')('bop:port-allocator')

const used = {}

function tryPort(host, port, cb) {
  debug(`Trying if ${host}:${port} is available ...`)
  const server = net.createServer()
  server.on('error', listenCallback)

  server.listen(port, host, listenCallback)

  function listenCallback(listenErr) {
    debug(listenErr ? listenErr.message : 'success')
    debug(`closing ${host}:${port}...`)
    server.close( ()=>{
      debug('closed.')
      server.unref() 
      cb(null, listenErr == null)
    })
  }
}

function isAvailable(host, port, cb) {
  if (used[host] && used[host][port]) {
    debug(`${host}:${port} is already taken in-process`)
    return cb(null, false)
  }
  tryPort(host, port, cb)
}

function allocPort(host, port, cb) {
  isAvailable(host, port, (err, available) => {
    if (err) return cb(err)
    if (available) {
      used[host] = used[host] || {}
      used[host][port] = true
      return cb(null, port)
    }
    allocPort(host, port+1, cb)
  })
}

function deallocPort(host, port) {
  if (used[host] && used[host][port]) {
    debug(`dealloc ${host}:${port}`) 
    used[host][port] = false
  } else {
    debug(`!dealloc unallocated ${host}:${port}`) 
  }
}

module.exports = {
  allocPort,
  deallocPort
}
