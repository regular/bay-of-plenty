const debug = require('debug')('test')
const hyperquest = require('hyperquest')
const BufferList = require('bl')
const {resolve} = require('url')
const qs = require('query-string')

const inviteCode = "*kWFhOEuLiics3Po/Taio9jyGPK9mKfndrDt23s5vFvE=.ed25519@h8sMNhOo43PP8HX+9B3PCJPchqxhpPXgzwFG7HIaNbc=.ed25519%UG4Wp7+Qoihyec2xofCku/xW3nlAaXiQEu0UAZbNW1I=.sha256138.201.131.83:52654:@MODsaDg5OpsFlca7LLSLxikxFGze4DN0xbAzvrz7uMQ=.ed25519~0i9oFxHn5qv3lh09C5bOf7wolbbtYsSpxjK4Bcf7Vws="

const appHandlers = {}
const electron = {
  app: {
    on: (event, listener) => {
      appHandlers[event] = appHandlers[event] || []
      appHandlers[event].push(listener)
    }
  },
  Menu: {
    setApplicationMenu: ()=>{},
    buildFromTemplate: ()=>{}
  },
  BrowserWindow: function (opts) {
    return Window(opts)
  }
}
electron.BrowserWindow.prototype = {}

function Window(opts) {
  const win = {} 
  const handlers = {}
  return {
    on: (event, listener) => {
      handlers[event] = appHandlers[event] || []
      handlers[event].push(listener)
    },
    openDevTools: ()=>{
      debug('open dev tools')
    },
    webContents: {
      executeJavaScript: code => {
        return new Promise((resolve, reject)=>{
          resolve(inviteCode) 
        })
      }
    },
    loadURL: url => {
      debug('window loadURL %s', url)
      hyperquest(url, (err, res) =>{
        if (err) {
          debug('http request failed: %s', err.message)
          return
        }
        debug('httpd response code', res.statusCode)
        const bl = BufferList()
        res.pipe(BufferList( (err, data)=>{
          const html = data.toString()
          let formAction
          html.replace(/action=\"([^\"]+)\"/, (_, action) => {
            formAction = action
          })
          debug('form action: %s', formAction)
          if (!formAction) return
          debug('Ask main process to get network conf')
          hyperquest(`${resolve(url, formAction)}`, (err, res)=>{
            debug('httpd response code', res.statusCode)
          })
        }))
      })
    }
  }
}

function emit(handlers, name, ...args) {
  (handlers[name] || []).forEach(listener => {
    listener(...args)
  })
}

const fs = {
  appendFileSync: (path, data) => {
    debug('logfile %s: %s', path, data)
  }
}

const sbot = function(networks, cb) {
  if (Object.keys(networks).length == 0) {
    // simulate we tried to read bundled .trerc
    return cb(new Error('ENOENT'))
  }
  debug('sbot: networkks are: %O', networks)
  const ssb = {
    ws: {
      getAddress: cb => {
        cb(null, 'wsaddress')
      }
    }
  }
  const config = {
    ws: {
      port: 'wsport'
    }
  }
  const browserKeys = {}
  cb(null, ssb, config, 'myid', browserKeys)
}

const logMessages = []
const log = (...args) => {
  process.stderr.write(['log:'].concat(args).map(a=>`${a}`).join(' ') + '\n')
  logMessages.push(args)
}

require('./inject.js')(electron, fs, log, sbot)

emit(appHandlers, 'ready')
