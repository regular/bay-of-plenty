const fs = require('fs')
const pull = require('pull-stream')
const glob = require('pull-glob')
const {join} = require('path')
const toPull = require('stream-to-pull-stream')
const debug = require('debug')('bop:add-blobs')

module.exports = function addBlobs(ssb, dir, cb) {
  debug('globbing blobs')
  pull(
    glob(join(dir, '*')),
    pull.asyncMap((fn, cb)=>{
      debug('adding blob %s ...', fn)
      pull(
        toPull.source(fs.createReadStream(fn)),
        ssb.blobs.add((err, hash)=>{
          debug('blobs.add done: %o, %s', err, hash)
          cb(err, hash)
        })
      )
    }),
    pull.onEnd(cb)
  )
}

