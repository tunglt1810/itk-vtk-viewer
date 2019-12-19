importScripts('workbox-sw.prod.v2.1.2.js');

const workboxSW = new self.WorkboxSW({clientsClaim: true})
workboxSW.precache([
  {
    "url": "favicon-32x32.png",
    "revision": "7b1da026f1c9dc9d8caadbe4bdb7b2a8"
  },
  {
    "url": "index.html",
    "revision": "d1d5f607ea6fc73d941e3c3b54e003b3"
  },
  {
    "url": "itkVtkViewer.js",
    "revision": "31a2d5ea439b0a5b27916fd8eeb6661c"
  },
  {
    "url": "itkVtkViewerCDN.js",
    "revision": "5e6d8772702e923b79072a4145d99680"
  },
  {
    "url": "test.html",
    "revision": "7ae13ed21ff30dda487760df4b24897c"
  },
  {
    "url": "workbox-sw.prod.v2.1.3.js",
    "revision": "a9890beda9e5f17e4c68f42324217941"
  }
])

workboxSW.router.registerRoute(
  /\.js|\.png|\.wasm$/,
  workboxSW.strategies.staleWhileRevalidate({
  cacheName: 'staleWhileRevalidateContent',
  cacheExpiration: {
    maxEntries: 50,
    maxAgeSeconds: 7 * 24 * 60 * 60 * 26,
    }
  })
);
