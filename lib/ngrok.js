const http = require('http');

function getNgrokStatus(config) {
  return new Promise((resolve) => {
    const apiUrl = config.ngrok?.apiUrl || 'http://127.0.0.1:4040/api/tunnels';
    let url;
    try {
      url = new URL(apiUrl);
    } catch {
      return resolve({
        connected: false,
        publicUrl: null,
        displayUrl: `localhost:${config.server?.port || 3000}`,
        statusText: 'offline'
      });
    }

    const req = http.request(
      url,
      { method: 'GET', timeout: 1500 },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const body = JSON.parse(data);
            const tunnels = body.tunnels || [];
            if (tunnels.length > 0) {
              const primaryTunnel = tunnels.find(t => t.proto === 'https') || tunnels[0];
              const publicUrl = primaryTunnel.public_url || '';
              const displayUrl = publicUrl.replace(/^https?:\/\//, '');
              return resolve({
                connected: true,
                publicUrl,
                displayUrl,
                statusText: 'connected',
                tunnels: tunnels.map(t => ({
                  name: t.name,
                  publicUrl: t.public_url,
                  proto: t.proto
                }))
              });
            }
            resolve({
              connected: false,
              publicUrl: null,
              displayUrl: `localhost:${config.server?.port || 3000}`,
              statusText: 'no active tunnels'
            });
          } catch {
            resolve({
              connected: false,
              publicUrl: null,
              displayUrl: `localhost:${config.server?.port || 3000}`,
              statusText: 'offline'
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        connected: false,
        publicUrl: null,
        displayUrl: `localhost:${config.server?.port || 3000}`,
        statusText: 'offline'
      });
    });

    req.on('error', () => {
      resolve({
        connected: false,
        publicUrl: null,
        displayUrl: `localhost:${config.server?.port || 3000}`,
        statusText: 'offline'
      });
    });

    req.end();
  });
}

module.exports = {
  getNgrokStatus
};
