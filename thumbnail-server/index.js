const http = require('http')
const {join} = require('path')
const pull = require('pull-stream')
const multiblob = require('multiblob')
const multiblob_httpp = require('multiblob-http')
const DB = require('./db')
const AddImageStream = require('./add-image-stream')
const hyperquest = require('hyperquest')
const toPull = require('stream-to-pull-stream')
const mkdirp = require('mkdirp')

function fetch(url) {
  return toPull.source(hyperquest(url))
}

module.exports = function(dir, config) {
  config = config || {}
  mkdirp.sync(dir)
  const idFromURL = config.idFromURL || (x=>x)
  const port = config.port || 8080
  const host = config.host || 'localhost'
  const sizes = config.sizes || [256, 128, 64, 48, 16]
  const blobs = multiblob(dir)
  const db = DB(dir)
  const addImageStream = AddImageStream(db, blobs, sizes)
  const server = http.createServer(multiblob_httpp(blobs, '/thumbnails'))
  const origin = `${host}:${port}`

  return {
    listen,
    close: server.close.bind(server),
    addImageURL,
    getPrefix
  }

  function listen(cb) {
    server.listen(port, host, cb)
  }

  function getPrefix() {
    return `http://${origin}/thumbnails/get/`
  }

  function addImageURL(url, cb) {
    const id = idFromURL(url)
    const source = fetch(url)
    addImageStream(id, source, (err, result) =>{
      if (err) return cb(err)
      cb(null, Object.fromEntries(Object.entries(result).map( ([size, hashAndFormat])=>{
        const [hash, format] = hashAndFormat.split('|')
        return [size, `${getPrefix()}${encodeURIComponent(hash)}?contentType=${encodeURIComponent('image/'+format)}`]
      })))
    })
  }

}
