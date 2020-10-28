const Server = require('..')
const test = require('tape')
const mkdirp = require('mkdirp')
const hyperquest = require('hyperquest')
const toPull = require('stream-to-pull-stream')
const detect = require('tre-image-size')
const pull = require('pull-stream')

function fetch(url) {
  return toPull.source(hyperquest(url))
}

const dir = `/tmp/test-${Date.now()}`
console.log('db dir is ', dir)
mkdirp.sync(dir)

test('server', t=>{
  t.plan(8)
  const server = Server(dir, {
    sizes: [100]
  })
  server.listen( err=>{
    t.error(err)
    server.addImageURL('https://live.staticflickr.com/7029/6545648743_c0780f9a34_n.jpg', (err, result) =>{
      t.error(err)
      console.dir(result)
      t.ok(result['100x100'], 'has requested thumbnail size')
      pull(
        fetch(result['100x100']),
        detect(meta => {
          t.equal(meta.format, 'jpeg', 'format')
          t.equal(meta.width, 100, 'width')
          t.equal(meta.height, 100, 'height')
        }),
        pull.onEnd( err =>{
          t.error(err)
          server.close( err=>{
            t.error(err, 'server.close')
          })
        })
      )
    })
  })
})
