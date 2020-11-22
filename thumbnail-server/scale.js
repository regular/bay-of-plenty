const detect = require('tre-image-size')
const pull = require('pull-stream')
const bl = require('bl')
const debug = require('debug')('thumbnail-server:scale')
const sharp = require('sharp')

module.exports = function(source, createSink, sizes, cb) {
  let meta
  const buffer = bl()
  sizes = sizes.sort((a,b)=>b-a)

  pull(
    source,
    detect( m=>meta=m),
    pull.through(b=>buffer.append(b)),
    createSink( (err, hash) => {
      if (err) return cb(err)
      if (!meta) return cb(new Error('Unable to detect image format'))
      const result = {}
      debug('format: %s, width: %d, height: %d', meta.format, meta.width, meta.height)
      result[`${meta.width}x${meta.height}`] = hash + '|' + meta.format
      if (meta.format == 'svg+xml') {
        return cb(null, sizes.reduce( (acc, s)=>{
          acc[`${s}x${s}`] = hash + '|' + meta.format
          return acc
        }, result))
      }

      let srcBuffer = buffer.slice()
      pull(
        pull.values(sizes),
        pull.asyncMap( (size, cb) => {
          debug('resize %s to %d', meta.format, size)
          sharp(srcBuffer)
            .resize({width: size, height: size})
            .toBuffer()
            .then(data=>{
              debug('done resizing')
              srcBuffer = data
              cb(null, {size, data})
            })
            .catch(err => {
              debug('error resizing: %s', err.message)
              cb(err)
            })
        }),
        pull.asyncMap( ({size, data}, cb) =>{
          pull(
            pull.once(data),
            createSink( (err, hash) => {
              if (err) return cb(err)
              cb(null, {size, hash})
            })
          )
        }),
        pull.collect( (err, thumbs)=>{
          if (err) return cb(err)
          cb(null, thumbs.reduce( (acc, {size, hash})=>{
            acc[`${size}x${size}`] = hash + '|' + meta.format
            return acc
          }, result))
        })
      )
    })
  )
}
