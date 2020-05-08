const getNetworksDir = require('./get-networks-dir')
const encode = require('./fs-safe-encode')
const {join} = require('path')

module.exports = function getDatapath(network, id) {
  const prefix = join(getNetworksDir(), `${encode(network)}`)
  if (!id) return prefix
  return `${prefix}-${encode(id)}`
}
