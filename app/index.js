const minimist = require('minimist')

if (process.env.THROW_SODIUM_NATIVE) {
  console.log('sodium-native ...')
  const sn = require('sodium-native')
  console.log(sn.version)
}
if (process.env.THROW_DEPRECATION) {
  process.throwDeprecation = true
}

const argv = parseArgs()
const electron = require('electron')
const sbot = require('./sbot')(argv)

require('./inject.js')(electron, sbot, argv)

function parseArgs() {
  const i = process.argv.indexOf('--')
  const argv = i !== -1 ? process.argv.slice(i + 1) : process.argv.slice(2)
  return minimist(argv)
}

