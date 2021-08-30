const fs = require('fs')
const {parse} = require('url')
const {dirname, basename} = require('path')
const crypto = require('crypto')
const pull = require('pull-stream')
const debug = require('debug')('bop:build-on-demand')
const compile = require('tre-compile/compile')
const addMeta = require('tre-compile/add-meta')
const pkgUp = require('pkg-up')

const hyperstream = require('hyperstream')
const BufferList = require('bl')

const makeCSP = require('./csp')

module.exports = async function(ssb, page, filename, opts) {
  opts = opts || {}
  const random = basename(filename) + crypto.randomBytes(32).toString('hex')
  const origin = opts.origin || 'http://localhost/'
  const onMeta = opts.onMeta || (()=>{})
  const base = opts.base || `${origin}blobs/get/`

  ssb.ws.use(function(req, res, next) {
    const u = parse('http://makeurlparseright.com'+req.url)
    if(req.method !== 'GET' || u.pathname !== '/' + random) return next()
    debug('request for %s', filename)

    const metaPromise = getMeta(filename)

    compile(filename, async (err, result) => {
      if (err) { 
        debug('compile failed')
        console.error(`error compiling: ${err.message} ${err.annotated}`)
        res.setHeader('content-type', 'text/plain')
        return res.end(503, err.annotated)
      }

      debug('compile done')
      let meta
      try{
        meta = await metaPromise
      } catch(e) {
        console.error(e.message)
        meta = {}
      }
      meta.sha = result.sha
      onMeta(meta)
      debug('sending response')
 
      pull(
        addMeta(result.body, result.sha, Object.assign({base}, meta)),
        pull.collect((err, result)=>{
          if (err) {
            console.error('addMeta failed: %s', err.message)
            res.setHeader('content-type', 'text/plain')
            return res.end(503, err.message)
          }
          res.setHeader(
            'Content-Security-Policy', makeCSP(ssb.config, meta.sha)
          )
          res.setHeader('x-bay-of-plenty-script-loader', filename)
          res.setHeader('content-type', 'text/html')

          const body = BufferList()
          body.append(result)
          /*
          const hs = hyperstream({head: {_appendHtml: `<base href="${base}">`}})
          hs.pipe(res)
          body.pipe(hs)
          */
          body.pipe(res)
        })
      )
    })
  })
  debug('navigating')
  await page.goto(`${origin}${random}`)
}

async function getMeta(filename) {
  return new Promise( async (resolve, reject) =>{
    const pkgpath = await pkgUp({cwd: dirname(filename)})
    if (!pkgpath) {
      throw new Error('No package.json found.')
    }
    fs.readFile(pkgpath, (err, buf)=>{
      if (err) return reject(err)
      resolve(JSON.parse(buf))
    })
  })
}
