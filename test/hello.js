//jshint esversion: 9
//jshint -W079
const fs = require('fs')
const {join} = require('path')
const crypto = require('crypto')
const test = require('tape')
const spawn_bop = require('./lib/spawn-bop-with-puppeteer')
const wait = require('./lib/wait')
const mkdirp = require('mkdirp').sync

test('hello world!', t=>{
  const dir = `/tmp/${Date.now()}`
  mkdirp(dir)
  const configPath = join(dir, 'config')
  console.log('configPath', configPath)
  fs.writeFileSync(configPath, JSON.stringify({
    network: `*${crypto.randomBytes(32).toString('base64')}.random`,
  }), 'utf8')

  const bop = spawn_bop([
    `${__dirname}/fixtures/hello_world.js`,
    `--config=${configPath}`
  ], {
    env: Object.assign({}, process.env, {
      DEBUG: 'bop:script-loader',
      DEBUG_COLORS: 1
    })
  }, (err, browser) =>{
    t.error(err, 'puppeteer connected')
    ;(async function() {
      const appTarget = await browser.waitForTarget(t=>t.url().includes('hello_world'))
      t.ok(appTarget, 'app tab found')
      const page = await appTarget.page()
      const body = await page.$('body')
      const text = await body.evaluate( el=>el.innerText )
      console.log(text) 
      t.equal(text, 'hello world!')
      //await wait(1000)
      const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
      t.ok(tabbarTarget, 'tabbar found')
      const tabbar = await tabbarTarget.page()
      const close = await tabbar.waitForSelector('.tab.active .close', {visible: true})
      console.log('Clicking close')
      await close.click()
    })()
  })

  /*
  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })
  bop.stderr.on('data', data =>{
    process.stdout.write(data)
  })
  */

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    t.end()
  })

})
