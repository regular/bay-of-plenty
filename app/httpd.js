const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')
const debug = require('debug')('bop:httpd')
const url = require('url')

const serve = serveStatic('public', {'index': ['index.html']})

module.exports = function(port, onAdd, cb) {
  const server = http.createServer(function onRequest (req, res) {
    debug(req.method, req.url)
    const u = url.parse('http://makeurlparseright.com'+req.url)
    if (u.pathname == '/add-network') {
      onAdd( server, err => {
        res.ststusCode = err ? 503 : 200
        res.end(err && err.message)
      })
      return
    }
    serve(req, res, finalhandler(req, res))
  })
  server.listen(port, '127.0.0.1', cb)
}
