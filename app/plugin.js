const fs = require('fs')
const {parse} = require('url')
const debug = require('./log')(fs, 'bop:plugin')

exports.name = 'bayofplenty'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  debug('INFO: plugin init')

  ssb.ws.use(function (req, res, next) {
    if (!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = parse('http://makeurlparseright.com'+req.url)
    if (u.pathname == '/about') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body><h1>about</h1></body></html>')
      return
    }
    next()
  })

  return {}
}
