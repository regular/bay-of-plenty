const fs = require('fs')
const pull = require('pull-stream')
const glob = require('pull-glob')
const {join, dirname} = require('path')
const toPull = require('stream-to-pull-stream')
const debug = require('debug')('bop:list-public-keys')
const encode = require('./fs-safe-encode')
const {loadSync} = require('ssb-keys')

const getNetworksDir = require('./get-networks-dir')

module.exports = function listPublicKeys(network) {
  const safe_network = encode(network).replace(/\+/g, '\\+')
  const pattern = join(getNetworksDir(), `${safe_network}*`, 'secret')
  debug('globbing %s', pattern)
  return pull(
    glob(pattern),
    pull.asyncMap((fn, cb)=>{
      debug('Reading %s ...', fn)
      let id
      try {
        id = loadSync(fn).id
      } catch(err) {
        return cb(err)
      }
      cb(null, {
        id,
        datapath: dirname(fn)
      })
    })
  )
}

