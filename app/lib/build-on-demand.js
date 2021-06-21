const {parse} = require('url')
const {basename} = require('path')
const crypto = require('crypto')
const debug = require('debug')('bop:build-on-demand')
const compile = require('tre-compile/compile')

const hyperstream = require('hyperstream')
const BufferList = require('bl')

module.exports = async function(ssb, page, filename, opts) {
  opts = opts || {}
  const random = basename(filename) + crypto.randomBytes(32).toString('hex')
  const origin = opts.origin || 'http://localhost/'
  const base = opts.base || `${origin}blobs/get/`

  ssb.ws.use(function(req, res, next) {
    const u = parse('http://makeurlparseright.com'+req.url)
    if(req.method !== 'GET' || u.pathname !== '/' + random) return next()
    debug('request for %s', filename)

    compile(filename, (err, result) => {
      if (err) { 
        debug('compile failed')
        console.error(`error compiling: ${err.message} ${err.annotated}`)
        res.setHeader('content-type', 'text/plain')
        return res.end(503, err.annotated)
      }

      debug('compile done')
      debug('sending response')
      res.setHeader(
        'Content-Security-Policy', `script-src 'sha256-${result.sha}';`
      )
      res.setHeader('x-bay-of-plenty-script-loader', filename)
      res.setHeader('content-type', 'text/html')

      const body = BufferList()
      body.append(result.body)
      const hs = hyperstream({head: {_appendHtml: `<base href="${base}">`}})
      hs.pipe(res)
      body.pipe(hs)
      //res.end(result.body)
    })
  })
  debug('navigating')
  await page.goto(`${origin}${random}`)
}

