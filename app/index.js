/* uncomment to crash when there's no native crypto
console.log('sodium-native ...')
const sn = require('sodium-native')
console.log(sn.version)
*/
const electron = require('electron')
const sbot = require('./sbot')

//process.throwDeprecation=true
require('./inject.js')(electron, sbot)
