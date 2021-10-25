module.exports = 'data:text/html;charset=utf-8,' +
encodeURIComponent(`
  <html>
    <head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'self';">
    </head>
  </html>
`)
