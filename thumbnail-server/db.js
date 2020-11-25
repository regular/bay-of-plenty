const {join} = require('path')
const Level = require('level')
const pull = require('pull-stream')
const pl = require('pull-level')

module.exports = function(dir) {
  const db = Level(join(dir, 'leveldb'), {
    keyEncoding: 'utf8',
    valueEncoding: 'utf8'
  })

  return {
    hasAllSizes,
    add,
    getHashAndFormatForId,
    close
  }

  function close(cb) {
    db.close(cb)
  }

  function allSizes(id, cb) {
    pull(
      pl.read(db, {
        gt: id,
        lt: id + '~',
        keys: true,
        values: true
      }),
      pull.map( ({key, value}) => {
        key = key.slice(id.length)
        return [key, value]
      }),
      pull.collect( (err, entries) => {
        if (err) return cb(err)
        cb(null, Object.fromEntries(entries))
      })
    )
  }

  function hasAllSizes(id, sizes, cb) {
    allSizes(id, (err, result) => {
      if (err) return cb(err)
      const notFound = sizes.find( s=>result[`${s}x${s}`] == undefined )
      if (notFound) return cb(null, false)
      cb(null, result)
    })
  }
  
  function add(id, entries, cb) {
    const batch = entries.map( ({width, height, format, hash}) => {
      return {
        type: 'put',
        key: `${id}${width}x${height}`,
        value: hash + '|' + format
      }
    })
    db.batch(batch, cb)
  }

  function getHashAndFormatForId(id, width, height, cb) {
    db.get(
      `${id}${width}x${height}`,
      (err, data) => {
        if (err) return cb(err)
        cb(null, data.split('|'))
      }
    )
  }
}
