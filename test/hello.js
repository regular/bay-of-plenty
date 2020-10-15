const test = require('tape')
const spawn = require('./lib/spawn-bop')

test('hello world!', t=>{
  const bop = spawn([`${__dirname}/fixtures/hello_world.js`], {
    env: Object.assign({}, process.env, {
      DEBUG: '*',
      DEBUG_COLORS: 1
    })
  })
  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })
  bop.stderr.on('data', data =>{
    process.stdout.write(data)
  })

  const timer = setTimeout( ()=>{
    bop.kill()
  }, 5000)

  bop.on('exit', code =>{
    clearTimeout(timer)
    t.equal(code, 0, 'exit code is 0')
    t.end()
  })

})
