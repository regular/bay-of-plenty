const fs = require('fs')
const {join} = require('path')
const ssbKeys = require('ssb-keys')
const ssbConfigDefaults = require('ssb-config/defaults')
const mkdirp = require('mkdirp')
const defaultCap = require('ssb-caps/caps.json')

module.exports = function loadOrCreateConfigFile(config) {
  const unsafe_caps = config.caps && config.caps.shs || config.network && config.network.slice(1).replace(/\.[^.]+$/, '')
  const safe_caps = unsafe_caps.replace(/\//g, '-').replace(/\?/g, '_')
  config.path = join(process.env.HOME, '.bay-of-plenty', 'networks', safe_caps)

  mkdirp.sync(config.path)

  const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
  config.master = [browserKeys.id]

  if (!config.port) {
    if (!config.autoinvite) {
      config.port = Math.floor(50000 + 15000 * Math.random())
    } else {
      config.port = Number(config.autoinvite.split(':')[1])
    }
  }
  if (!config.ws) config.ws = {}
  if (!config.ws.port) config.ws.port = config.port + 1
  if (config.network) {
    if (!config.capss || !config.caps.shs) {
      config.caps = config.caps || {}
      config.caps.shs = config.network.slice(1).replace(/\.[^.]+$/, '')
    }
  } else {
    config.network = `*${config.caps && config.caps.shs || defaultCap.shs}.random`
  }
  config.appkey = config.caps.shs
  config.blobs = {
    legacy: false,
    sympathy: 10,
    max: 314572800
  }

  config.connections = {}
  config.connections.incoming = {
    net: [{ port: config.port, scope: "private", transform: "shs" }],
    ws: [{ port: config.ws.port, scope: "device", transform: "shs" }]
  },
  config.connections.outgoing = {
    net: [{ transform: "shs" }]
  }
  config = ssbConfigDefaults('', config)

  // ssbConfigDefaults put keys here, we dont want that
  delete config.keys
  // ssbConfigDefaults delete ws props. We dont wat that
  if (!config.ws.port) config.ws.port = config.port + 1

  fs.writeFileSync(join(config.path, 'config'), JSON.stringify(config, null, 2), 'utf8')
  return config
}
