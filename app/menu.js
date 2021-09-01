const {EventEmitter} = require('events')

module.exports = function(Menu, MenuItem) {
  return function(win, tabs) {
    const emitter = new EventEmitter()
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(emitter.emit.bind(emitter))))
    emitter.keepInSync = keepInSync
    return emitter

    function keepInSync(tab) {
      const appMenu = Menu.getApplicationMenu()
      const tabMenu = appMenu.getMenuItemById('tabs').submenu
      let label = `Tab ${tab.id}`
      let accelerator = `CmdOrCtrl+${tab.id}`
      if (!tabMenu.getMenuItemById('separator')) {
        tabMenu.append(new MenuItem({
          id: 'separator',
          type: 'separator'
        }))
      }
      tabMenu.append(new MenuItem({
        label,
        accelerator,
        type: 'radio',
        id: label,
        click: ()=>emitter.emit('activate-tab', {id: tab.id})
      }))
      Menu.setApplicationMenu(appMenu)
      Menu.getApplicationMenu().getMenuItemById(label).checked = true

      tab.on('activate-tab', ()=>{
        Menu.getApplicationMenu().getMenuItemById(label).checked = true
      })
      tab.on('close', ()=>{
        // There is no menu.remove() ...
        Menu.getApplicationMenu().getMenuItemById(label).visible = false
      })
    }
  }
}

function menuTemplate(emit) {
  return [
    { label: "Application",
      submenu: [
        { label: "Quit", accelerator: "Command+Q",
          click: ()=>emit('quit') 
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
    },
    { label: "View",
      submenu: [
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "Reset Zoom", accelerator: "CmdOrCtrl+=", role: "resetZoom" }
      ]
    },
    { label: "Tools",
      submenu: [
        { label: "Toogle Developer Tools", accelerator: "CmdOrCtrl+D", click: ()=> emit('toggle-dev-tools')},
        { label: "Toggle Fullscreen", accelerator: "CmdOrCtrl+F", role: "toggleFullscreen" },
        { type: "separator" },
        { label: "Reload", accelerator: "CmdOrCtrl+r", click: ()=> emit('reload')}
      ]
    },
    { label: "Tabs",
      id: 'tabs',
      submenu: [
        { label: "New Tab", accelerator: "CmdOrCtrl+T", click: ()=>emit('new-tab')},
        { label: "Close Tab", accelerator: "CmdOrCtrl+W", click: ()=> emit('close-tab')},
        { label: "Next Tab", accelerator: "Alt+CmdOrCtrl+Right", click: ()=> emit('next-tab')},
        { label: "Previous Tab", accelerator: "Alt+CmdOrCtrl+Left", click: ()=> emit('previous-tab') }
      ]
    }
  ]
}

