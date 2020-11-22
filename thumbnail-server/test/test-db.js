const test = require('tape')
const DB = require('../db')
const pull = require('pull-stream')
const mkdirp = require('mkdirp')

const dir = `/tmp/test-${Date.now()}`
console.log('db dir is ', dir)
mkdirp.sync(dir)
let db

test('empty db', t=>{
  db = DB(dir)

  db.getHashAndFormatForId('id', 10, 10, (err, result) => {
    t.ok(err, 'getHashForId should error')
    db.hasAllSizes('id', [1,2,3], (err, result) =>{
      t.error(err, 'hasAllSizes should not error')
      t.equal(result, false, 'hasAllSizes should return false')
      t.end()
    })
  })
})

test('add some hashes', t=>{
  pull(
    pull.values([
      {id: 'a', entries: [
        {width: 100, height: 200, hash: 'A', format:'foo'},
        {width: 10, height: 10, hash: 'A-10', format:'foo'},
        {width: 20, height: 20, hash: 'A-20', format: 'foo'}
      ]},
      {id: 'b', entries:[
        {width: 200, height: 400, hash: 'B', format: 'bar'},
        {width: 20, height: 20, hash: 'B-20', format: 'bar'}
      ]}
    ]),
    pull.asyncMap( ({id, entries}, cb)=>{
      db.add(id, entries, cb)
    }),
    pull.onEnd(err=>{
      t.error(err)
      t.end()
    })
  )
})

test('get back hashes', t=>{
  db.getHashAndFormatForId('a', 100, 200, (err, result) =>{
    t.error(err)
    const [hash, format] = result
    t.equal(hash, 'A', 'found A')
    t.equal(format, 'foo', 'correct format')
    db.getHashAndFormatForId('a', 20, 20, (err, result) =>{
      t.error(err)
      const [hash, format] = result
      t.equal(hash, 'A-20', 'found A-20')
      t.equal(format, 'foo', 'correct format')
      t.end()
    })
  })
})

test('hasAllSizes', t=>{
  db.hasAllSizes('a', [10, 20], (err, result)=>{
    t.error(err)
    t.ok(result, 'found A-10 and A-20')
    db.hasAllSizes('b', [10, 20], (err, result)=>{
      t.error(err)
      t.equal(result, false, 'did not find B-10 and B-20')
      db.hasAllSizes('b', [20], (err, result)=>{
        t.error(err)
        t.ok(result, 'did find B-20')
        t.end()
      })
    })
  })
})
