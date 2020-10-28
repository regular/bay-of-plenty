const test = require('tape')
const scale = require('../scale')
const file = require('pull-file')
const pull = require('pull-stream')
const detect = require('tre-image-size')

let n = 0
function createSink(cb) {
  let eta
  return pull(
    detect( m => {
      meta = m
      console.dir(meta)
    }),
    pull.drain(b=>{}, err=>{
      if (err) return cb(err)
      cb(null, `HASH-${n++}-${meta.format}-${meta.width}x${meta.height}`)
    })
  )
}

test('svg', t=>{
  scale(
    file(__dirname + '/fixtures/heart.svg'),
    createSink,
    [64, 128],
    (err, result)=>{
      t.error(err)
      t.deepEqual(result, {
        '512x512': 'HASH-0-svg+xml-512x512',
        '128x128': 'HASH-0-svg+xml-512x512',
        '64x64': 'HASH-0-svg+xml-512x512'
      })
      t.end()
    }
  )
})

test('jpeg', t=>{
  scale(
    file(__dirname + '/fixtures/ostrich.jpeg'),
    createSink,
    [64, 128],
    (err, result)=>{
      t.error(err)
      t.deepEqual(result, {
        '320x247': 'HASH-1-jpeg-320x247',
        '128x128': 'HASH-2-jpeg-128x128',
        '64x64': 'HASH-3-jpeg-64x64'
      })
      t.end()
    }
  )
})
