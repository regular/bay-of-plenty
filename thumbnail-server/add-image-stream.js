const scale = require('./scale')

module.exports = function(db, blobs, sizes) {

  function createSink(cb) {
    return blobs.add(null, cb)
  }

  return function addImageStream(id, source, cb) {
    db.hasAllSizes(id, sizes, (err, result) => {
      if (err) return cb(err)
      if (result) return cb(null, result)
    
      scale(source, createSink, sizes, (err, result)=>{
        if (err) return cb(err)
        const entries = Object.entries(result).map( ([size, hashAndFormat]) =>{
          const [width, height] = size.split('x')
          const [hash, format] = hashAndFormat.split('|')
          return {width, height, format, hash}
        })
        db.add(id, entries, err =>{
          if (err) return cb(err)
          cb(null, result)
        })
      })

    })
  }
}
