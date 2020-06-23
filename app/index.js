if (process.env.THROW_SODIUM_NATIVE) {
  console.log('sodium-native ...')
  const sn = require('sodium-native')
  console.log(sn.version)
}
if (process.env.THROW_DEPRECATION) {
  process.throwDeprecation=true
}

const electron = require('electron')
const sbot = require('./sbot')

require('./inject.js')(electron, sbot)
