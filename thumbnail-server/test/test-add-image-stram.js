const test = require('tape')
const DB = require('../db')
const multiblob = require('multiblob')
const pull = require('pull-stream')
const mkdirp = require('mkdirp')
const file = require('pull-file')
const AddImageStream = require('../add-image-stream')

const dir = `/tmp/test-${Date.now()}`
console.log('db dir is ', dir)
mkdirp.sync(dir)
let db
const blobs = multiblob(dir)

test('empty db', t=>{
  db = DB(dir)
  const addImageStream = AddImageStream(db, blobs, [64, 128])

  addImageStream('a', file(__dirname + '/fixtures/heart.svg'), (err, result) =>{
    t.error(err)
    console.log('addImageStream retusn: %o',result)

    db.hasAllSizes('a', [64, 128], (err, result)=>{
      t.error(err)
      console.log('hasAllSizes returns %o', result)
      t.ok(result, 'has all sizes')
      t.end()
    })
  })
})

test('add already existing thumbs', t=>{
  // NOTE: we do not pass blobs to make sure it does not hit the blobtore
  const addImageStream = AddImageStream(db, null, [64, 128])

  addImageStream('a', file(__dirname + '/fixtures/heart.svg'), (err, result) =>{
    t.error(err)
    console.log('addImageStream retusn: %o',result)

    db.hasAllSizes('a', [64, 128], (err, result)=>{
      t.error(err)
      console.log('hasAllSizes returns %o', result)
      t.ok(result, 'has all sizes')
      t.end()
    })
  })
})

test('add a pixmap, so we actually have to resize', t=>{
  const addImageStream = AddImageStream(db, blobs, [64, 128])

  addImageStream('b', file(__dirname + '/fixtures/ostrich.jpeg'), (err, result) =>{
    t.error(err)
    console.log('addImageStream retusn: %o',result)

    db.hasAllSizes('b', [64, 128], (err, result)=>{
      t.error(err)
      console.log('hasAllSizes returns %o', result)
      t.ok(result, 'has all sizes')
      t.end()
    })
  })
})
