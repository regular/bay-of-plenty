const fs = require('fs')
const debug = require('debug')('upload-app')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const multicb = require('multicb')
const parseCSP = require('content-security-policy-parser')
const unquote = require('unquote')
const extractMeta = require('html-extract-meta')

module.exports = function(ssb, filename, cb) {
  const done = multicb({pluck:1, spread: true})
  const source = toPull.source(fs.createReadStream(filename).pipe(extractMeta(done())))

  pull(
    source,
    ssb.blobs.add(done())
  )

  done((err, meta, codeBlob) => {
    if (err) return cb(err)

    const content = {
      type: 'webapp',
      name: 'an app',
      codeBlob,
      scriptHash: getScriptHashFromHTTPHeader(meta.http)
    }
    cb(null, content)
  })
}

function getScriptHashFromHTTPHeader(headers) {
  const header = headers["Content-Security-Policy"]
  const csp = parseCSP(header)
  const sha = (csp['script-src'] || []).find(x=>unquote(x).startsWith('sha256-'))
  if (!sha) throw new Error("No script-src policy with sha256 found!")
  return unquote(sha).replace(/^sha256-/,'')
}
