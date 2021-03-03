//jshint esversion: 9
//jshint -W079
const fs = require('fs')
const {join} = require('path')
const crypto = require('crypto')
const test = require('tape')
const spawn_bop = require('./lib/spawn-bop-with-puppeteer')
const wait = require('./lib/wait')
const mkdirp = require('mkdirp').sync
const ssbKeys = require('ssb-keys')
const client = require('ssb-zero-conf-client')
const Pub = require('./lib/pub')
const inviteCodes = require('tre-invite-code')
const uploadApp = require('./lib/upload-app')

const DEBUG = 'bop:browser-console,multiserver:net ssb-zero-conf-client'
const dir = `/tmp/${Date.now()}`
const configPath = join(dir, 'config')
const appkey = crypto.randomBytes(32).toString('base64')
const keypair = ssbKeys.generate()
const port = 60999
let bop, browser, pub, appMessage, longInvite

test('start a pub', t => {
  const path = `${dir}-pub`
  console.log(`pub path is: ${path}`)
  mkdirp(path)
  const shs = appkey
  const config = {
    path,
    port: port + 2,
    caps: {shs}
  }
  Pub(config, (err, ssb) =>{
    t.error(err)
    t.ok(ssb, 'pub api')
    pub = ssb
    console.log(`pub id: ${pub.id}`)
    t.end()
  })
})

test('upload app', t=>{
  uploadApp(pub, join(__dirname, 'fixtures/hello_world.html'), (err, content) =>{
    t.error(err)
    t.ok(content, 'has created message content')
    pub.publish(content, (err, kv) =>{
      t.error(err)
      t.ok(kv)
      console.dir(kv)
      appMessage = kv
      t.end()
    })
  }) 
})

test('make invite code', t=>{
  t.ok(pub.invite.create, 'pub can create invites')
  pub.invite.create(1, (err, invite) =>{
    t.error(err, 'invite.create succeeded')
    t.ok(invite, 'created invite code')
    console.log(`invite code: ${invite}`)
    longInvite = inviteCodes.stringify({
      network: `*${appkey}.random`,
      autoinvite: invite,
      autoname: 'alice',
      autofollow: pub.id,
      boot: appMessage.key
    })
    t.ok(longInvite)
    console.log(`long invite: ${longInvite}`)
    t.end()
  })
})

test('launch bootmenu', t=>{
  mkdirp(dir)
  console.log('configPath', configPath)
  fs.writeFileSync(configPath, JSON.stringify({
    network: `*${appkey}.random`,
    port
  }), 'utf8')

  bop = spawn_bop([
    `${__dirname}/../bop-bootmenu/index.js`,
    `--config=${configPath}`,
    `--authorize=${keypair.id}`,
    '--fail-on-error',
    '--clean-session'
  ], {
    env: Object.assign({}, process.env, {
      DEBUG,
      DEBUG_COLORS: 1
    })
  }, (err, _browser) =>{
    browser = _browser
    t.error(err, 'puppeteer connected')
    ;(async function() {
      const appTarget = await browser.waitForTarget(t=>t.url().includes('index.js'))
      t.ok(appTarget, 'app tab found')
      t.end()
    })()
  })

  // if bop exits with a falta error, this
  // test suit fails
  bop.on('exit', code =>{
    if (code) process.exit(code)
  })

  bop.stdout.on('data', data =>{
    process.stdout.write(data)
  })

  bop.stderr.on('data', data =>{
    process.stdout.write(data)
  })
})

/*
test('connect to sbot', t=>{
  client(appkey, keypair, (err, ssb) =>{
    t.error(err)
    t.ok(client)
    t.end()
  })
})
*/

test('fill in invite code', t=>{

  async function fill() {
    const menuTarget = await browser.waitForTarget(t=>t.url().includes('index.js'))
    t.ok(menuTarget, 'menu target found')
    const menu = await menuTarget.page()
    t.ok(menu, 'bootmenu page found')

    const button = await menu.waitForSelector('form[action="/add-network"] button', {visible: true})
    t.ok(button, '"add netork button" found')
    t.ok(await button.evaluate(el=>el.disabled), 'button is disabled')

    const textarea = await menu.waitForSelector('form[action="/add-network"] textarea[name=code]', {visible: true})
    t.ok(textarea, 'textarea found')
    await textarea.type(longInvite)

    t.notOk(await button.evaluate(el=>el.disabled), 'button is enabled')
    await button.click()

    const helloWorldTarget = await browser.waitForTarget(t=>t.url().includes('blobs/get/'+ encodeURIComponent(appMessage.value.content.codeBlob) ))
    t.ok(helloWorldTarget, 'hello world app opened')
    t.end()
  }

  ;(async function() {
    await wait(2000)
    await fill()
  })()
})

test('close bootmaneu tab', t=>{

  async function clickClose() {
    const tabbarTarget = await browser.waitForTarget(t=>t.url().includes('tabbar-browser'))
    t.ok(tabbarTarget, 'tabbar found')
    const tabbar = await tabbarTarget.page()
    const close = await tabbar.waitForSelector('.tab.active .close', {visible: true})
    console.log('found close button')
    console.log('Clicking close')
    await close.click()
  }

  bop.on('exit', code =>{
    console.log('bop exited')
    t.equal(code, 0, 'exit code is 0')
    pub.close()
    t.end()
  })

  ;(async function() {
    await wait(1000)
    await clickClose()
  })()
})

