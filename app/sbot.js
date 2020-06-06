const fs = require('fs')
const {join} = require('path')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')

const debug = require('debug')('bop:sbot')
const loadOrCreateConfigFile = require('./network-config-file')
const addBlobs = require('./add-blobs')
const {avatarUpdate} = require('./avatar-update')

module.exports = function(config, cb) {
  loadOrCreateConfigFile(config, (err, config) => {
    if (err) return cb(err)
    debug('Creating sbot with config' + JSON.stringify(config, null, 2))
    const createSbot = require('tre-bot')()
      .use(require('./plugin'))
      .use({
        manifest: {getAddress: "sync"},
        init: ssb => ({getAddress: scope => ssb.multiserver.address(scope)})
      })
      .use(require('ssb-sandboxed-views'))
      .use(require('ssb-autofollow'))
      .use(require('ssb-autoname'))
      .use(require('ssb-autoinvite'))
      .use(require('tre-boot'))
      .use(require('ssb-backlinks'))
      .use(require('ssb-social-index')({
        namespace: 'about',
        type: 'about',
        destField: 'about'
      }))

    const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
    createSbot(config, keys, (err, ssb) => {
      if (err) return cb(err)
      debug('sbot manifest' + JSON.stringify(ssb.getManifest(), null, 2))
      debug(`public key ${keys.id}`)
      debug(`network key ${config.caps.shs}`)
      debug(`datapath: ${config.path}`)
      const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
      if (config.autoconnect) {
        let ac = config.autoconnect
        if (typeof ac == 'string') ac = [ac]
        ac.forEach(address => {
          debug(`auto-connecting to ${address}`)
          ssb.conn.remember(address)
          ssb.conn.connect(address)
        })
      }
      pull(
        ssb.about.socialValueStream({dest: keys.id, key: 'name'}),
        pull.drain( name => {
          avatarUpdate(config.network, keys.id, 'name', name)
        }, err=>{
          console.error(`socialValueStream er: ${err.message}`)
        })
      )
      // TODO: only if canned
      addBlobs(ssb, join(__dirname, 'blobs'), err =>{
        if (err) return cb(err)
        cb(null, ssb, config, keys.id, browserKeys)
      })
    })
  })
}
