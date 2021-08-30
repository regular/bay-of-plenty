const debug = require('debug')('bop:csp')
const avatarUpdate = require('../avatar-update')

module.exports = function(config, scriptHash) {
  const csp = 
      `default-src 'self'; ` +
      `img-src 'self' data: blob: ${avatarUpdate.getPrefix()}; ` +
      `style-src 'self' 'unsafe-inline'; ` +
      `font-src 'self' data: blob:; ` +
      `script-src 'sha256-${scriptHash}'; ` + // TODO: wasm-eval
      `connect-src 'self' data: blob: ws://localhost:${config.ws.port}; ` +
      `worker-src 'self' blob:`

  debug('csp: %s', csp)
  return csp
}
