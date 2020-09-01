const fs = require('fs')
const {isFeedId} = require('ssb-ref')
const debug = require('debug')('bop:authorize')
const {loadSync} = require('ssb-keys')
const zerr = require('zerr')

const BadKey = zerr('BadKey', '%s is neither a feedid nor a keyfile in JSON format')

module.exports = function(argv) {
  const authorized = arr(argv.authorize).map(x=>{
    if (isFeedId(x)) return x
    let id
    try {
      id = loadSync(x).id
    } catch(e) {
      throw BadKey(e, x)
    }
    if (!id) throw BadKey(x)
    return id
  })
  authorized.forEach(x =>{
    debug('authorized %s', x)
  })
  return {init}

  function init(ssb, config) {
    ssb.auth.hook(function (fn, args) {
      const id = args[0]
      const cb = args[1]
      debug('auth called for %s', id)
      const ok = authorized.includes(id)
      if (ok) return cb(null, {allow: null, deny: null})
      fn.apply(this, args)
    })
  }
}

// --

function arr(x) {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}
