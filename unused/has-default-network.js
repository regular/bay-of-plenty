const ssbKeys = require('ssb-keys')
const {join} = require('path')

module.exports = function() {
  const filename = join(process.env.HOME, '.ssb', 'secret')
  const keys = ssbKeys.loadSync(filename)
  return keys && keys.id
}
