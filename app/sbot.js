const fs = require('fs')
const {join, resolve} = require('path')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const mkdirp = require('mkdirp')
const log = require('./log')(fs, 'bop:sbot')
const defaultCap = require('scuttlebot-release/node_modules/scuttlebot/lib/ssb-cap').toString('base64')

// load plugins from scuttlebot-release, so the versions are shrinkwrapped
const scuttlebot_modpath = 'scuttlebot-release/node_modules/'
let {createSbot} = require(join(scuttlebot_modpath, 'scuttlebot'))
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
createSbot = createSbot()
function useBuiltInPlugin(p) {
  return createSbot.use(require(join(scuttlebot_modpath, p)))
}
plugins.forEach( p => {
  createSbot = useBuiltInPlugin(p)
})

createSbot = createSbot
  .use(require('./plugin'))
  .use(require('ssb-autofollow'))
  .use(require('ssb-autoname'))
  .use(require('ssb-autoinvite'))
  .use(require('ssb-revisions'))
  //.use(require('tre-client'))
  .use(require('tre-boot'))
  .use(require('tre-parts'))

//useBuiltInPlugin('ssb-ws')

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
  
  const unsafe_caps = config.caps && config.caps.shs || config.network && config.network.slice(1).replace(/\.[^.]+$/, '')
  const safe_caps = unsafe_caps.replace(/\//g, '-').replace(/\?/g, '_')
  config.path = join(process.env.HOME, '.bay-of-plenty', 'networks', safe_caps)
    
  log(`mkdirp ${config.path}`)
  mkdirp.sync(config.path)

  const keys = ssbKeys.loadOrCreateSync(join(config.path, 'secret'))
  const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))

  if (!config.port) config.port = Math.floor(50000 + 15000 * Math.random())
  if (!config.ws) config.ws = {}
  if (!config.ws.port) config.ws.port = config.port + 1
  if (config.network) {
    if (!config.capss || !config.caps.shs) {
      config.caps = config.caps || {}
      config.caps.shs = config.network.slice(1).replace(/\.[^.]+$/, '')
    }
  } else {
    config.network = `*${config.caps && config.caps.shs || defaultCap}.random`
  }
  fs.writeFileSync(join(config.path, 'config'), JSON.stringify(config, null, 2), 'utf8')

  const ssb = createSbot(Object.assign({}, config, {
    keys,
    master: [browserKeys.id]
  }))
  setTimeout( () => {
    ssb.whoami( (err, feed) => {
      if (err) return cb(err)
      log(`pub key ${feed.id}`)
      log(`app key ${config.caps.shs}`)
      return cb(null, ssb, config, feed.id, browserKeys)
    })
  }, 200)
}
