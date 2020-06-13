/* uncomment to crash when there's no native crypto
console.log('sodium-native ...')
const sn = require('sodium-native')
console.log(sn.version)
*/
const electron = require('electron')
const fs = require('fs')
const sbot = require('./sbot')
const log = require('./log')(fs, 'bop:index')

//process.throwDeprecation=true
require('./inject.js')(electron, fs, log, sbot)
