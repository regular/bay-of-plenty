const fs = require('fs')
const {join} = require('path')
const ssbKeys = require('ssb-keys')

const log = require('./log')(fs, 'bop:sbot')
const loadOrCreateConfigFile = require('./network-config-file')
const addBlobs = require('./add-blobs')

module.exports = function(config, cb) {
  loadOrCreateConfigFile(config, (err, config) => {
    if (err) return cb(err)
    log('Creating sbot with config' + JSON.stringify(config, null, 2))
    const createSbot = require('tre-bot')()
      .use(require('./plugin'))
      .use(require('ssb-autofollow'))
      .use(require('ssb-autoname'))
      .use(require('ssb-autoinvite'))
      .use(require('tre-boot'))

    const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
    createSbot(config, keys, (err, ssb) => {
      if (err) return cb(err)
      log(`public key ${keys.id}`)
      log(`network key ${config.caps.shs}`)
      const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
      if (config.autoconnect) {
        ssb.gossip.connect(config.autoconnect)
      }
      // TODO: only if canned
      addBlobs(ssb, join(__dirname, 'blobs'), err =>{
        if (err) return cb(err)
        cb(null, ssb, config, keys.id, browserKeys)
      })
    })
  })
}
