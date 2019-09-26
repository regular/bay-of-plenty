const fs = require('fs')
const {join} = require('path')
const ssbKeys = require('ssb-server/node_modules/ssb-keys')

const log = require('./log')(fs, 'bop:sbot')
const loadOrCreateConfigFile = require('./network-config-file')

const createSbot = require('./create-sbot')()
  .use(require('ssb-ws'))
  .use(require('./plugin'))
  .use(require('ssb-autofollow'))
  .use(require('ssb-autoname'))
  .use(require('ssb-autoinvite'))
  .use(require('ssb-revisions'))
  .use(require('tre-boot'))

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
  const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
console.dir(keys)  
  createSbot(config, keys, (err, ssb, feed) => {
    log(`public key ${feed.id}`)
    log(`network key ${config.caps.shs}`)
    const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
    cb(null, ssb, config, feed.id, browserKeys)
  })

}
