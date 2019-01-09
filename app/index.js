const {app, ipcMain, BrowserWindow, Menu} = require('electron')
const fs = require('fs')
const sbot = require('./sbot')
const log = require('./log')('bop:index')

const old_console_log = console.log
console.log = (...args) => {
  fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', args + '\n')
}

log(`node version ${process.version}`)
log(`process.env.DEBUG ${process.env.DEBUG}`)

let win
app.on('ready', start)

function start() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()))
  win = new BrowserWindow({ width: 800, height: 600 })
  win.on('closed', () => {
    win = null
  })
  win.openDevTools()

  server({}, (err, ssb, config, myid) => {
    if (err) {
      log('sbot failed' + err.message)
    } else {
      log('sbot started')
      win.loadURL(`http://localhost:${config.ws.port}/msg/${encodeURIComponent(config.boot)}`)
    }
  })
}

function server(networks, cb) {
  sbot(networks, (err, ssb, config, myid) => {
    if (err) {
      log(err.message)
      if (!/ENOENT/.test(err.message)) {
        return cb(err)
      }
      return askForNetworks( (err, networks) => {
        if (err) return cb(err)
        return server(networks, cb)
      })
    }
    log(`ssb id ${myid}`)
    cb(null, ssb, config, myid)
  })
}

function askForNetworks(cb) {
  win.loadFile('renderer.html')
  ipcMain.on('networks', (event, err, networks) => {
    if (err) return cb(err)
    cb(err, networks)
  })
}

function menuTemplate() {
  return [
    { label: "Application",
      submenu: [
        { label: "Quit", accelerator: "Command+Q",
          click: () => { app.quit() }
        }
      ]
    },
    { label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]
    }
  ]
}
