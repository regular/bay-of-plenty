const fs = require('fs')
const {join} = require('path')
const {isBlobId} = require('ssb-ref')
const ssbKeys = require('ssb-keys')
const pull = require('pull-stream')

const debug = require('debug')('bop:sbot')
const loadOrCreateConfigFile = require('./network-config-file')
const addBlobs = require('./add-blobs')
const {avatarUpdate} = require('./avatar-update')
const Authorize = require('./plugins/authorize')

module.exports = function(argv) {
  const authorize = Authorize(argv)
  return function(config, bop, cb) {
    loadOrCreateConfigFile(config, (err, config) => {
      if (err) return cb(err)
      const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
      debug('Creating sbot with config' + JSON.stringify(config, null, 2))
      let createSbot = require('tre-bot')()
        .use(require('./plugin')(bop, keys))
        .use(authorize)
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
        .use(require('ssb-private'))
        .use(require('ssb-social-index')({
          namespace: 'about',
          type: 'about',
          destField: 'about'
        }))

      if (config.bayOfPlenty && config.bayOfPlenty.appPermissions) {
        const netId = getNetId(config)
        debug('adding appPermissions API')
        createSbot = createSbot
        .use(require('ssb-social-index')({
          namespace: 'appPermissions',
          type: 'app-permissions',
          destField: 'app',
          getSocialValue: (socialValues, yourId, authorId) => {
            debug('getSocialValue values:%O, yourId: %s, authorId: %s', socialValues, yourId, authorId)
            if (socialValues[yourId]) {
              // you assigned a value, use this!
              return socialValues[yourId]
            }
            if (socialValues[netId]) {
              // they assigned a value, use this!
              return socialValues[netId]
            }
            return null
          }
        }))
      }

      createSbot(config, keys, (err, ssb) => {
        if (err) return cb(err)
        debug('sbot manifest' + JSON.stringify(ssb.getManifest(), null, 2))
        debug(`public key ${keys.id}`)
        debug(`network key ${config.caps.shs}`)
        debug(`datapath: ${config.path}`)
        /*
        const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
        */
        if (config.autoconnect) {
          let ac = config.autoconnect
          if (typeof ac == 'string') ac = [ac]
          ac.forEach(address => {
            debug(`auto-connecting to ${address}`)
            ssb.conn.remember(address)
            ssb.conn.connect(address)
          })
        }

        gatherMeta(ssb, config, keys)

        if (config.canned) {
          debug('adding blobs ...')
          addBlobs(ssb, join(__dirname, 'blobs'), err =>{
            if (err) return cb(err)
            debug('done adding blobs.')
            cb(null, ssb, config, keys.id)
          })
        } else {
          cb(null, ssb, config, keys.id)
        }

      })
    })
  }
}

function getNetId(config) {
  const ext = "ed25519"
  const sigil = '@'
  const netId = `${sigil}${config.caps.shs}.${ext}`
  return netId
}

function gatherMeta(ssb, config, keys) {
  updateAvatars(ssb, config.network, keys.id, 'name')
  updateAvatars(ssb, config.network, keys.id, 'image')

  const netId = getNetId(config)
  debug('requesting social values for %s', netId)

  updateAvatars(ssb, config.network, netId, 'name')
  updateAvatars(ssb, config.network, netId, 'image')
  updateAvatars(ssb, config.network, netId, 'description')

  if (config.boot) {
    debug('requesting app icon for %s', config.boot)
    updateAvatars(ssb, config.network, config.boot, 'name')
    updateAvatars(ssb, config.network, config.boot, 'image')
    updateAvatars(ssb, config.network, config.boot, 'description')
  }
}


function updateAvatars(ssb, network, id, key) {
  const origin = ssb.ws.getAddress().match(/ws:([^~]*)/)[1]

  pull(
    ssb.about.socialValueStream({dest: id, key}),
    pull.map( value =>{
      if (isBlobId(value)) {
        return `http:${origin}/blobs/get/${encodeURIComponent(value)}`
      } else {
        return value
      }
    }),
    pull.drain( value => {
      avatarUpdate(network, id, key, value)
    }, err=>{
      console.error(`socialValueStream er: ${err.message}`)
    })
  )
}
