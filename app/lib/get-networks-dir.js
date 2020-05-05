const {join} = require('path')

module.exports = function getNetworksDir() {
  return join(process.env.HOME, '.bay-of-plenty', 'networks')
}
