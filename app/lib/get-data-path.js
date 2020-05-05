const getNetworksDir = require('./get-networks-dir')
const encode = require('./fs-safe-encode')
const {join} = require('path')

module.exports = function getDatapath(network, id) {
  return join(getNetworksDir(), `${encode(network)}-${encode(id)}`)
}
