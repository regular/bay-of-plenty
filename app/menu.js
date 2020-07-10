module.exports = function menuTemplate(app, tabs) {
  return [
    { label: "Application",
      submenu: [
        { label: "Quit", accelerator: "Command+Q",
          click: app.quit
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
        { label: "Toogle Developer Tools", accelerator: "CmdOrCtrl+D", click: ()=> tabs.currentView().webContents.openDevTools() },
        { label: "Toggle Fullscreen", accelerator: "CmdOrCtrl+F", role: "toggleFullscreen" },
        { type: "separator" },
        { label: "Reload", accelerator: "CmdOrCtrl+r", click: ()=>tabs.currentView().webContents.reload()}
      ]
    },
    { label: "Tabs",
      id: 'tabs',
      submenu: [
        { label: "New Tab", accelerator: "CmdOrCtrl+T", click: ()=> tabs.newTab() },
        { label: "Close Tab", accelerator: "CmdOrCtrl+W", click: ()=> tabs.closeTab() },
        { label: "Next Tab", accelerator: "Alt+CmdOrCtrl+Right", click: ()=> tabs.nextTab() },
        { label: "Previous Tab", accelerator: "Alt+CmdOrCtrl+Left", click: ()=> tabs.previousTab() }
      ]
    }
  ]
}

