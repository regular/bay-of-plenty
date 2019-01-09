const fs = require('fs')
const debug = require('debug')
debug.enable('*')

module.exports = function(scope) {
  const log = debug(scope)
  log.log = msg => {
    //console.error(msg)
    fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', msg + '\n')
  }
  return log
}
