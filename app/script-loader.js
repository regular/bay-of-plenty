const crypto = require('crypto')
const debug = require('debug')('bop:script-loader')
const Browserify = require('browserify')
const indexhtmlify = require('indexhtmlify')
const BufferList = require('bl')

module.exports = async function(page, filename, opts) {
  opts = opts || {}
  debug('setRequestInterception ...')
  await page.setRequestInterception(true)
  debug('setRequestInterception done.')
  page.once('request', async req=>{
    debug('intercept request to %s', req.url())
    try {
      debug('compile')
      result = await compile(filename)
      debug('compile done')
      /* TODO
      res.setHeader(
        'Content-Security-Policy', 
        `script-src 'sha256-${result.sha}';`
      )
      */
      debug('sending response')
      await req.respond({
        status: 200,
        contentType: 'text/html',
        body: result.body
      })
    } catch(err) {
      debug('compile failed')
      console.error(`error compiling: ${err.message} ${err.annotated}`)
      await req.respond({
        status: 503,
        contentType: 'text/plain',
        body: err.annotated
      })
    }
  })
  debug('navigating')
  await page.goto('http://localhost/foo')
  if (opts.keepIntercepting !== true) {
    debug('stop intercepting network requests')
    await page.setRequestInterception(false)
  }
}

function compile(filename, cb) {
  return new Promise( (resolve, reject) => {
    const browserify = Browserify()
    browserify.transform(require('brfs'))
    browserify.transform(require('bricons'))
    browserify.add(filename)
    browserify.bundle()
    .pipe(BufferList( (err, buffer) => {
      if (err) {
        console.error(err.annotated)
        return reject(err)
      }
      const bl_hash = BufferList()
      bl_hash.append(Buffer.from('\n'))
      bl_hash.append(buffer)
      const sha = crypto.createHash('sha256')
        .update(bl_hash.slice())
        .digest('base64')

      const doc = BufferList()
      doc.append(buffer)
      doc.pipe(indexhtmlify())
      .pipe(BufferList( (err, buffer) => {
        if (err) {
          console.error(err.message)
          return reject(err)
        }
        resolve({sha, body:buffer})
      }))
    }))
  })
}
