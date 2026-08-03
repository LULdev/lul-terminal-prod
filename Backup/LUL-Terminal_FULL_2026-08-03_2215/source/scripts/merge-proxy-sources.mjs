/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * One-off merge helper — also used by seed-proxy-sources.mjs EXTRA_URLS block.
 */

export const EXTRA_PROXY_URLS = [
  ['https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text', 'ProxyScrape API', 'http'],
  ['https://freeproxy24.com/free-proxy-list', 'freeproxy24.com', 'http'],
  ['https://geonode.com/free-proxy-list', 'geonode.com', 'http'],
  ['https://databay.com/free-proxy-list', 'databay.com · all', 'http'],
  ['https://databay.com/free-proxy-list/socks5', 'databay.com · socks5', 'socks5'],
  ['https://free-proxy-list.net/en/socks-proxy.html', 'free-proxy-list.net · socks', 'socks5'],
  ['https://www.freeproxy.world/?type=socks5', 'freeproxy.world · socks5', 'socks5'],
  ['https://freeproxyupdate.com/download-txt', 'freeproxyupdate.com', 'http'],
  ['https://sockslist.us', 'sockslist.us', 'socks5'],
  ['https://spys.one/en/socks-proxy-list/', 'spys.one · socks', 'socks5'],
  ['https://openproxylist.com/proxy/', 'openproxylist.com · proxy', 'http'],
  ['https://openproxylist.com/', 'openproxylist.com', 'http'],
  ['https://www.openproxylist.xyz/', 'openproxylist.xyz', 'http'],
  ['https://www.proxy-list.download/', 'proxy-list.download', 'http'],
  ['https://www.proxyscan.io/', 'proxyscan.io', 'http'],
  ['https://www.proxydocker.com/', 'proxydocker.com', 'http'],
  ['https://megaproxylist.net/', 'megaproxylist.net', 'http'],
  ['https://proxy-daily.com/', 'proxy-daily.com', 'http'],
  ['http://free-proxy.cz/en/', 'free-proxy.cz', 'http'],
  ['https://www.proxynova.com/', 'proxynova.com', 'http'],
  ['https://hidemy.name/', 'hidemy.name', 'http'],
  ['https://openproxy.space/', 'openproxy.space', 'http'],
  ['https://www.sslproxies.org/', 'sslproxies.org', 'https'],
  ['https://www.us-proxy.org/', 'us-proxy.org', 'http'],
  ['https://www.socks-proxy.net/', 'socks-proxy.net', 'socks5'],
  ['https://webscraping.ai/', 'webscraping.ai', 'http'],
  ['https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt', 'jsdelivr · proxifly · all', 'http'],
  ['https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt', 'jsdelivr · proxifly · http', 'http'],
  ['https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks4/data.txt', 'jsdelivr · proxifly · socks4', 'socks4'],
  ['https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt', 'jsdelivr · proxifly · socks5', 'socks5'],
  ['https://github.com/proxifly/free-proxy-list', 'github · proxifly/free-proxy-list', 'http'],
  ['https://github.com/iplocate/free-proxy-list', 'github · iplocate/free-proxy-list', 'http'],
  ['https://github.com/r00tee/Proxy-List', 'github · r00tee/Proxy-List', 'http'],
  ['https://github.com/Jakee8718/Free-Proxies', 'github · Jakee8718/Free-Proxies', 'http'],
  ['https://github.com/gfpcom/free-proxy-list', 'github · gfpcom/free-proxy-list', 'http'],
  ['https://github.com/proxygenerator1/ProxyGenerator', 'github · proxygenerator1/ProxyGenerator', 'http'],
  ['https://github.com/TheSpeedX/PROXY-List', 'github · TheSpeedX/PROXY-List', 'http'],
  ['https://github.com/ShiftyTR/Proxy-List', 'github · ShiftyTR/Proxy-List', 'http'],
  ['https://github.com/hookzof/socks5_list', 'github · hookzof/socks5_list', 'socks5'],
  ['https://github.com/prxchk/proxy-list', 'github · prxchk/proxy-list', 'http'],
  ['https://github.com/vakhov/fresh-proxy-list', 'github · vakhov/fresh-proxy-list', 'http'],
  ['https://github.com/rxyzqc/SOCKS5-Proxy-Gen', 'github · rxyzqc/SOCKS5-Proxy-Gen', 'socks5'],
  ['https://raw.githubusercontent.com/r00tee/Proxy-List/main/Https.txt', 'r00tee/Proxy-List · Https.txt', 'https'],
  ['https://raw.githubusercontent.com/r00tee/Proxy-List/main/Socks4.txt', 'r00tee/Proxy-List · Socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/r00tee/Proxy-List/main/Socks5.txt', 'r00tee/Proxy-List · Socks5.txt', 'socks5'],
  ['https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt', 'TheSpeedX/PROXY-List · http.txt', 'http'],
  ['https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt', 'TheSpeedX/PROXY-List · socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt', 'TheSpeedX/PROXY-List · socks5.txt', 'socks5'],
  ['https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', 'TheSpeedX/SOCKS-List · http.txt', 'http'],
  ['https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt', 'TheSpeedX/SOCKS-List · socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt', 'TheSpeedX/SOCKS-List · socks5.txt', 'socks5'],
  ['https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt', 'hookzof/socks5_list · proxy.txt', 'socks5'],
  ['https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt', 'prxchk/proxy-list · http.txt', 'http'],
  ['https://raw.githubusercontent.com/prxchk/proxy-list/main/socks4.txt', 'prxchk/proxy-list · socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt', 'prxchk/proxy-list · socks5.txt', 'socks5'],
  ['https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt', 'monosans/proxy-list · proxies/http.txt', 'http'],
  ['https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt', 'monosans/proxy-list · proxies_anonymous/http.txt', 'http'],
  ['https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt', 'monosans/proxy-list · proxies/socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/socks4.txt', 'monosans/proxy-list · proxies_anonymous/socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt', 'jetkai/proxy-list · main · http', 'http'],
  ['https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt', 'jetkai/proxy-list · main · socks4', 'socks4'],
  ['https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt', 'mertguvencli/http-proxy-list', 'http'],
  ['https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt', 'MuRongPIG/Proxy-Master · http.txt', 'http'],
  ['https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt', 'proxylist-to/proxy-list · http.txt', 'http'],
  ['https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks4.txt', 'MuRongPIG/Proxy-Master · socks4.txt', 'socks4'],
  ['https://raw.githubusercontent.com/proxylist-to/proxy-list/main/socks4.txt', 'proxylist-to/proxy-list · socks4.txt', 'socks4'],
  ['https://checkerproxy.net/', 'checkerproxy.net', 'http'],
  ['https://premproxy.com/list/', 'premproxy.com', 'http'],
  ['https://api.openproxylist.xyz/proxy.txt', 'openproxylist.xyz API', 'http'],
  ['https://www.proxydocker.com/en/proxylist/download?format=txt&type=http', 'proxydocker.com · txt', 'http'],
  ['https://github.com/roundproxies/free-proxy-list', 'github · roundproxies/free-proxy-list', 'http'],
  ['https://github.com/jetkai/proxy-list', 'github · jetkai/proxy-list', 'http'],
  ['https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt', 'iplocate · all-proxies.txt', 'http'],
];

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function mergeExtraSources(baseSources, extraUrls = EXTRA_PROXY_URLS) {
  const seen = new Set(baseSources.map((s) => s.url));
  const ids = new Set(baseSources.map((s) => s.id));
  const merged = [...baseSources];
  let added = 0;
  let skipped = 0;

  for (const [url, name, type] of extraUrls) {
    if (seen.has(url)) {
      skipped++;
      continue;
    }
    seen.add(url);

    let id = slugify(`extra-${name}`);
    let n = 2;
    while (ids.has(id)) id = `${id}-${n++}`;
    ids.add(id);

    merged.push({
      id,
      name,
      url,
      type,
      repo: 'custom',
    });
    added++;
  }

  return { sources: merged, added, skipped };
}