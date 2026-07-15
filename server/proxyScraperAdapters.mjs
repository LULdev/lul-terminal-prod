/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Domain-specific URL expansion — APIs, pagination, mirror endpoints.
 */

export function expandSourceUrls(source) {
  const primary = source.url;
  const extra = [];
  const u = primary.toLowerCase();

  if (u.includes('geonode.com')) {
    for (let page = 1; page <= 15; page++) {
      extra.push(`https://proxylist.geonode.com/api/proxy-list?limit=500&page=${page}&sort_by=lastChecked&sort_type=desc&protocols=http,https,socks4,socks5`);
    }
  }

  if (u.includes('proxy-list.download')) {
    for (const type of ['http', 'https', 'socks4', 'socks5']) {
      extra.push(`https://www.proxy-list.download/api/v1/get?type=${type}`);
    }
  }

  if (u.includes('sslproxies.org') || u.includes('socks-proxy.net') || u.includes('us-proxy.org') || u.includes('free-proxy-list.net')) {
    extra.push('https://www.proxy-list.download/api/v1/get?type=http');
    extra.push('https://www.proxy-list.download/api/v1/get?type=https');
    extra.push('https://www.proxy-list.download/api/v1/get?type=socks4');
    extra.push('https://www.proxy-list.download/api/v1/get?type=socks5');
  }

  if (u.includes('proxynova.com')) {
    extra.push('https://api.proxynova.com/proxy');
  }

  if (u.includes('spys.one')) {
    extra.push('https://spys.me/socks.txt');
    extra.push('https://spys.me/proxy.txt');
  }

  if (u.includes('openproxy.space')) {
    extra.push('https://api.openproxy.space/lists/socks5');
    extra.push('https://api.openproxy.space/lists/socks4');
    extra.push('https://api.openproxy.space/lists/http');
  }

  if (u.includes('github.com/') && !u.includes('raw.githubusercontent.com')) {
    const m = primary.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) {
      const [, owner, repo] = m;
      const branch = 'main';
      for (const file of [
        'http.txt', 'https.txt', 'socks4.txt', 'socks5.txt', 'proxy.txt', 'proxies.txt', 'all.txt',
        'proxies/http.txt', 'proxies/https.txt', 'proxies/socks4.txt', 'proxies/socks5.txt',
        'proxy-list/data.txt', 'list.txt',
      ]) {
        extra.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`);
        extra.push(`https://raw.githubusercontent.com/${owner}/${repo}/master/${file}`);
      }
    }
  }

  if (u.includes('proxyscrape.com') && !u.includes('format=text')) {
    extra.push('https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text');
    extra.push('https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=ipport&format=text');
  }

  if (u.includes('hidemy.name')) {
    extra.push('https://hidemy.name/en/proxy-list/?type=h&export=txt');
    extra.push('https://hidemy.name/en/proxy-list/?type=5&export=txt');
    extra.push('https://hidemy.name/en/proxy-list/?type=4&export=txt');
  }

  if (u.includes('proxyscan.io')) {
    for (const type of ['http', 'https', 'socks4', 'socks5']) {
      extra.push(`https://www.proxyscan.io/download?type=${type}`);
      extra.push(`https://www.proxyscan.io/api/proxy?limit=100&format=txt&type=${type}`);
    }
  }

  if (u.includes('free-proxy.cz')) {
    extra.push('http://free-proxy.cz/en/proxy-standard/list.csv');
    extra.push('http://free-proxy.cz/en/proxy-standard/list.txt');
  }

  if (u.includes('freeproxy24.com')) {
    extra.push('https://freeproxy24.com/api/proxyList');
  }

  if (u.includes('databay.com')) {
    extra.push('https://databay.com/api/v1/proxies?limit=500');
    for (const proto of ['http', 'https', 'socks4', 'socks5']) {
      extra.push(`https://databay.com/api/v1/proxies?limit=500&protocol=${proto}`);
    }
  }

  if (u.includes('proxifly') || u.includes('jsdelivr.net/gh/proxifly')) {
    const base = 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies';
    for (const path of [
      'all/data.txt',
      'protocols/http/data.txt',
      'protocols/https/data.txt',
      'protocols/socks4/data.txt',
      'protocols/socks5/data.txt',
      'countries/US/data.txt',
      'countries/DE/data.txt',
    ]) {
      extra.push(`${base}/${path}`);
    }
  }

  if (u.includes('checkerproxy.net')) {
    for (const proto of ['http', 'https', 'socks4', 'socks5']) {
      extra.push(`https://checkerproxy.net/api/v1/landing/export/txt/${proto}`);
    }
  }

  if (u.includes('premproxy.com')) {
    extra.push('https://premproxy.com/list/txt/');
    extra.push('https://premproxy.com/list/txt/socks.txt');
  }

  if (u.includes('pubproxy.io')) {
    extra.push('http://pubproxy.com/api/proxy?limit=20&format=txt&type=http');
    extra.push('http://pubproxy.com/api/proxy?limit=20&format=txt&type=socks5');
  }

  if (u.includes('proxydocker.com')) {
    extra.push('https://www.proxydocker.com/en/proxylist/download?format=txt&type=http');
    extra.push('https://www.proxydocker.com/en/proxylist/download?format=txt&type=socks5');
  }

  if (u.includes('megaproxylist.net')) {
    extra.push('https://megaproxylist.net/api/proxylist');
  }

  if (u.includes('proxy-daily.com')) {
    extra.push('https://proxy-daily.com/api/proxylist');
  }

  if (u.includes('freeproxy.world')) {
    for (const t of ['http', 'https', 'socks4', 'socks5']) {
      extra.push(`https://www.freeproxy.world/?type=${t}&anonymity=&country=&speed=&port=&page=1&format=txt`);
    }
  }

  if (u.includes('openproxylist.com') || u.includes('openproxylist.xyz')) {
    extra.push('https://api.openproxylist.xyz/proxy.txt');
    extra.push('https://api.openproxylist.xyz/socks4.txt');
    extra.push('https://api.openproxylist.xyz/socks5.txt');
  }

  if (u.includes('getproxylist.com')) {
    extra.push('https://api.getproxylist.com/proxy?protocol[]=http&protocol[]=https&protocol[]=socks4&protocol[]=socks5&allowsUserAgentHeader=1&allowsCustomHeaders=1&allowsCookies=1&allowsPost=1&allowsRefererHeader=1&allows302=1');
  }

  if (u.includes('jetkai') && u.includes('github.com')) {
    const m = primary.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) {
      const [, owner, repo] = m;
      for (const branch of ['main', 'master']) {
        for (const file of [
          'online-proxies/txt/proxies-http.txt',
          'online-proxies/txt/proxies-https.txt',
          'online-proxies/txt/proxies-socks4.txt',
          'online-proxies/txt/proxies-socks5.txt',
          'archive/txt/proxies-http.txt',
          'archive/txt/proxies-socks5.txt',
        ]) {
          extra.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`);
        }
      }
    }
  }

  if (u.includes('roundproxies') && u.includes('github.com')) {
    const m = primary.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) {
      const [, owner, repo] = m;
      for (const file of ['http.txt', 'https.txt', 'socks4.txt', 'socks5.txt', 'all.txt']) {
        extra.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/${file}`);
      }
    }
  }

  if (u.includes('free-proxy-list.net')) {
    extra.push('https://www.proxy-list.download/api/v1/get?type=http');
    extra.push('https://www.proxy-list.download/api/v1/get?type=https');
    extra.push('https://www.proxy-list.download/api/v1/get?type=socks4');
    extra.push('https://www.proxy-list.download/api/v1/get?type=socks5');
  }

  const all = [primary, ...extra];
  return [...new Set(all)];
}