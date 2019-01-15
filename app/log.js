const debug = require('debug')
debug.enable('*')

module.exports = function(fs, scope) {
  const log = debug(scope)
  log.log = (...args) => {
    fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', args.map(x => `${x}`).join(' ') + '\n')
  }
  return log
}
