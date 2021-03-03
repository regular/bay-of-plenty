const ssbKeys = require('ssb-keys')

const createSbot = require('tre-bot')()
  .use({
    manifest: {getAddress: "sync"},
    init: ssb => ({getAddress: scope => ssb.multiserver.address(scope)})
  })

module.exports = function(config, cb) {
  const keys = ssbKeys.generate()
  createSbot(config, keys, cb)
}
