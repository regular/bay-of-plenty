const fs = require('fs')
const {join} = require('path')
const ssbKeys = require('ssb-keys')

const log = require('./log')(fs, 'bop:sbot')
const loadOrCreateConfigFile = require('./network-config-file')

module.exports = function(networks, cb) {
  networks = networks || {}
  const netkeys = Object.keys(networks)
  log(`available networks ${netkeys}`)
  let config = netkeys.length && networks[netkeys[0]]
  if (!config) {
    try {
      log('Trying to read bundled .trerc')
      config = JSON.parse(fs.readFileSync('.trerc', 'utf8'))
    } catch(err) {
      log(err.message)
      return cb(err)
    }
  }
  config = loadOrCreateConfigFile(config)
  
  log('Creating sbot with config' + JSON.stringify(config, null, 2))

  const createSbot = require('tre-bot')()
    .use(require('./plugin'))
    .use(require('ssb-autofollow'))
    .use(require('ssb-autoname'))
    .use(require('ssb-autoinvite'))
    .use(require('tre-boot'))

  const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
  createSbot(config, keys, (err, ssb) => {
    log(`public key ${keys.id}`)
    log(`network key ${config.caps.shs}`)
    const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
    cb(null, ssb, config, keys.id, browserKeys)
  })

}
