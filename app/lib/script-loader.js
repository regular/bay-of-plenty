const {basename} = require('path')
const crypto = require('crypto')
const debug = require('debug')('bop:script-loader')
const compile = require('tre-compile/compile')

module.exports = async function(page, filename, opts) {
  opts = opts || {}
  const random = basename(filename)+crypto.randomBytes(32).toString('hex')
  const domain = opts.domain || 'http://localhost/'
  debug('setRequestInterception ...')
  await page.setRequestInterception(true)
  debug('setRequestInterception done.')
  //page[opts.keepIntercepting ? 'on' : 'once']('request', async req=>{
  page.once('request', async req=>{
    debug('intercept request to %s', req.url().slice(0,512))
    if (!req.url().endsWith(random)) {
      debug('ignoring')
      return req.continue()
    }
    try {
      debug('compile %s', filename)
      result = await new Promise( (resolve, reject) => {
        compile(filename, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        })
      })
      debug('compile done')

      debug('sending response')
      await req.respond({
        status: 200,
        headers: {
          'Content-Security-Policy':
            `script-src 'sha256-${result.sha}';`,
          'x-bay-of-plenty-script-loader': filename
        },
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
  await page.goto(`${domain}${random}`)
  if (opts.keepIntercepting !== true) {
    debug('stop intercepting network requests')
    await page.setRequestInterception(false)
  }
}

