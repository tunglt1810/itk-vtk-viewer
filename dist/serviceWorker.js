/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

importScripts("workbox-v4.3.1/workbox-sw.js");
workbox.setConfig({modulePathPrefix: "workbox-v4.3.1"});

importScripts(
  "precache-manifest.870d42406272213b6d5be017dabe759a.js"
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "favicon-32x32.png",
    "revision": "7b1da026f1c9dc9d8caadbe4bdb7b2a8"
  },
  {
    "url": "index.html",
    "revision": "e2b60c475e0003a818a24b0e0b74db1f"
  },
  {
    "url": "itkVtkViewer.js",
    "revision": "6a7d556b93948f63ce47faf32db27aef"
  },
  {
    "url": "itkVtkViewerCDN.js",
    "revision": "c728b4c45e66b08e837d48eaf5a7e2b4"
  },
  {
    "url": "workbox-sw.prod.v2.1.3.js",
    "revision": "a9890beda9e5f17e4c68f42324217941"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

workbox.routing.registerRoute(/\.js|\.png|\.wasm$/, new workbox.strategies.StaleWhileRevalidate({ "cacheName":"itk-vtk-viewer-StaleWhileRevalidate", plugins: [new workbox.expiration.Plugin({ maxEntries: 50, maxAgeSeconds: 1209600, purgeOnQuotaError: false })] }), 'GET');
