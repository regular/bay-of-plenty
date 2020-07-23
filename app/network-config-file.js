const fs = require('fs')
const {join} = require('path')
const debug = require('debug')('bop:network-config-file')
const ssbKeys = require('ssb-keys')
const ssbConfigDefaults = require('ssb-config/defaults')
const mkdirp = require('mkdirp')
const defaultCap = require('ssb-caps/caps.json')
const ip = require('non-private-ip')
const getNetworksDir = require('./lib/get-networks-dir')
const encode =require('./lib/fs-safe-encode')
const {allocPort} = require('./port-allocator')

module.exports = function loadOrCreateConfigFile(config, cb) {
  const unsafe_caps = config.caps && config.caps.shs || config.network && config.network.slice(1).replace(/\.[^.]+$/, '')
  const safe_caps = encode(unsafe_caps)

  debug(`loadOrCreate ${config.path}`)
  mkdirp.sync(config.path)

  //const browserKeys = ssbKeys.loadOrCreateSync(join(config.path, 'browser-keys'))
  //config.master = [browserKeys.id]

  configurePorts(config, (err, config) => {
    if (err) return cb(err)

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

    // ssbConfigDefaults seems to remove ws.port
    const wsPort = config.ws.port
    config = ssbConfigDefaults('', config)

    // ssbConfigDefaults put keys here, we dont want that
    delete config.keys
    // ssbConfigDefaults delete ws props. We dont want that
    config.ws.port = wsPort

    fs.writeFileSync(join(config.path, 'config'), JSON.stringify(config, null, 2), 'utf8')
    cb(null, config)
  })
}

function configurePorts(config, cb) {
  const privateIP = ip.private.v4

  if (!config.port) {
    if (!config.autoinvite) {
      config.port = Math.floor(50000 + 15000 * Math.random())
    } else {
      config.port = Number(config.autoinvite.split(':')[1])
    }
  }
  allocPort(privateIP, config.port, (err, port) => {
    if (err) return cb(err)
    config.port = port

    if (!config.ws) config.ws = {}
    if (!config.ws.port) config.ws.port = config.port + 1

    allocPort('127.0.0.1', config.ws.port, (err, port) => {
      if (err) return cb(err)
      config.ws.port = port

      config.connections = {}
      config.connections.incoming = {
        net: [{ port: config.port, host: privateIP, scope: "private", transform: "shs" }],
        ws: [{ port: config.ws.port, scope: "device", transform: "shs" }]
      }
      config.connections.outgoing = {
        net: [{ transform: "shs" }]
      }
      cb(null, config)
    })
  })
}

