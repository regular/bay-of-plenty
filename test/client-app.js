//jshint esversion: 9
//jshint -W079
const fs = require('fs')
const {join} = require('path')
const crypto = require('crypto')
const test = require('tape')
const spawn_bop = require('./lib/spawn-bop-with-puppeteer')
const wait = require('./lib/wait')
const mkdirp = require('mkdirp').sync

test('client-app', t=>{
  const dir = `/tmp/${Date.now()}`
  let browser
  mkdirp(dir)
  const configPath = join(dir, 'config')
  console.log('configPath', configPath)
  const appkey = crypto.randomBytes(32).toString('base64')
  fs.writeFileSync(configPath, JSON.stringify({
    network: `*${appkey}.random`
  }), 'utf8')

  const bop = spawn_bop([
    `${__dirname}/fixtures/client-app/index.js`,
    `--config=${configPath}`
  ], {
    env: Object.assign({}, process.env, {
      DEBUG: 'bop:browser-console',
      DEBUG_COLORS: 1
    })
  }, (err, _browser) =>{
    browser = _browser
    t.error(err, 'puppeteer connected')
    ;(async function() {
      const appTarget = await browser.waitForTarget(t=>t.url().includes('index.js'))
      t.ok(appTarget, 'app tab found')
    })()
  })


  async function clickClose() {
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    t.ok(tabbarTarget, 'tabbar found')
    const tabbar = await tabbarTarget.page()
    const close = await tabbar.waitForSelector('.tab.active .close', {visible: true})
    console.log('Clicking close')
    await close.click()
  }

  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })
  bop.stderr.on('data', data =>{
    process.stdout.write(data)
    if (data.includes(`app key: ${appkey}`)) {
      t.pass('app logged corret app key')
      clickClose()
    }
  })

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    t.end()
  })

})
