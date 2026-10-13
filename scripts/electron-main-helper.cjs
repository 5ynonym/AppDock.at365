const net = require('node:net');
const electronExpression =
  "process.getBuiltinModule('module').createRequire(process.resourcesPath + '/app.asar/package.json')('electron')";
async function freePort() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
async function inspect(port, expression) {
  const contexts = await (
    await fetch('http://127.0.0.1:' + port + '/json/list', {
      signal: AbortSignal.timeout(4000),
      headers: { Connection: 'close' },
    })
  ).json();
  const ws = new WebSocket(contexts[0].webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  const response = new Promise((r, j) => {
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1)
        d.result?.exceptionDetails ? j(Error(JSON.stringify(d))) : r(d.result.result.value);
    };
  });
  ws.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true },
    }),
  );
  let timer;
  try {
    return await Promise.race([
      response,
      new Promise((_, j) => (timer = setTimeout(() => j(Error('Main inspector timeout')), 6000))),
    ]);
  } finally {
    clearTimeout(timer);
    ws.close();
  }
}
module.exports = { freePort, inspect, electronExpression };
