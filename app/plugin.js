const fs = require('fs')
const Debug = require('debug')
const debug = Debug('plugin')

debug.log = (...args) => {
  console.log(...args)
}

exports.name = 'bayofplenty'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', 'PLUGIN INIT\n')

  debug('INFO: plugin init')

console.log('console.log from plugin')
console.error('console.error from plugin')
debug('debug from plugin')

  return {}
}
