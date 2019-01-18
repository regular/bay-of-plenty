const electron = require('electron')
const fs = require('fs')
const sbot = require('./sbot')
const log = require('./log')(fs, 'bop:index')

require('./inject.js')(electron, fs, log, sbot)