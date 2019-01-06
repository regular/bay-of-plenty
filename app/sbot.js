const fs = require('fs')
const {join, resolve} = require('path')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const mkdirp = require('mkdirp')
const log = require('./log')('bop:sbot')

// load plugins from scuttlebot-release, so the versions are shrinkwrapped
const scuttlebot_modpath = 'scuttlebot-release/node_modules/'
let createSbot = require(join(scuttlebot_modpath, 'scuttlebot'))
const plugins = [
  'scuttlebot/plugins/master',
  'scuttlebot/plugins/gossip',
  'scuttlebot/plugins/replicate',
  'ssb-friends',
  'ssb-blobs',
  'scuttlebot/plugins/invite',
  'scuttlebot/plugins/local',
  'scuttlebot/plugins/logging',
  'ssb-query',
  'ssb-links',
  'ssb-ws',
  'ssb-ebt'
]
plugins.forEach( p => {
  createSbot.use(require(join(scuttlebot_modpath, p)))
})

createSbot
  .use(require('ssb-autofollow'))
  .use(require('ssb-autoname'))
  .use(require('ssb-autoinvite'))
  .use(require('ssb-revisions'))
  .use(require('tre-client'))
  .use(require('tre-parts'))

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
  const path = join(process.env.HOME, config.caps.shs)
  log(`mkdir ${path}`)
  mkdirp.sync(path)

  const keys = ssbKeys.loadOrCreateSync(join(path, 'secret'))
  const browserKeys = ssbKeys.loadOrCreateSync(join(path, 'browser-keys'))

  const ssb = createSbot(Object.assign({}, config, {
    keys,
    path,
    master: [browserKeys.public]
  }))
  setTimeout( () => {
    ssb.whoami( (err, feed) => {
      if (err) return cb(err)
      log(`pub key ${feed.id}`)
      log(`app key ${config.caps.shs}`)
      return cb(null, ssb, config, feed.id)
    })
  }, 200)
}
