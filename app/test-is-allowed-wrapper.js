const test = require('tape')
const Wrapper = require('./is-allowed-wrapper')

const pull = require('pull-stream')

test('type async, allowed', t=>{
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(null)
  })

  const wrapped = wrap(function plus(a, b, cb) {
    t.equal(a, 42)
    t.equal(b, 23)
    cb(null, a + b)
  }, 'async', ['plus'])

  wrapped(42, 23, (err, result) =>{
    t.equal(err, null)
    t.equal(result, 42 + 23)
    t.end()
  })

})

test('type async, forbidden', t=>{
  const err = new Error('forbidden')
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(err)
  })

  const wrapped = wrap(function plus(a, b, cb) {
    t.fail('function was called!')
  }, 'async', ['plus'])

  wrapped(42, 23, (e, result) =>{
    t.equal(e, err)
    t.end()
  })

})

test('type source, allowed', t=>{
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(null)
  })

  const wrapped = wrap(function plus(a, b) {
    t.equal(a, 42)
    t.equal(b, 23)
    return pull(
      pull.values([a+b])
    )
  }, 'source', ['plus'])

  pull(
    wrapped(42, 23),
    pull.collect( (err, result)=>{
      t.equal(err, null)
      t.deepEqual(result, [42 + 23])
      t.end()
    })
  )
})

test('type source, forbidden', t=>{
  const err = new Error('forbidden')
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(err)
  })

  const wrapped = wrap(function plus(a, b) {
    t.fail('function was called!')
  }, 'source', ['plus'])

  pull(
    wrapped(42, 23),
    pull.collect( (e, result)=>{
      t.equal(e, err)
      t.end()
    })
  )
})

test('type sink, allowed', t=>{
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(null)
  })

  const wrapped = wrap(function plus(a, b) {
    t.equal(a, 42)
    t.equal(b, 23)
    return pull.collect( (err, result)=>{
      t.equal(err, null)
      t.deepEqual(result, [42,23])
      t.end()
    })
  }, 'sink', ['plus'])

  pull(
    pull.values([42, 23]),
    wrapped(42, 23)
  )
})

test('type sink, forbidden', t=>{
  const err = new Error('forbidden')
  const wrap = Wrapper(function isAllowed(path, args, cb) {
    t.equal(args[0], 42, 'argument is correct')
    t.equal(args[1], 23, 'argument is correct')
    t.deepEqual(path, ['plus'], 'path is correct')
    cb(err)
  })

  const wrapped = wrap(function plus(a, b) {
    t.fail('function was called!')
  }, 'sink', ['plus'])

  pull(
    function read(abort, cb) {
      t.equal(abort, err)
      cb(abort)
      t.end()
    },
    wrapped(42, 23)
  )
})
