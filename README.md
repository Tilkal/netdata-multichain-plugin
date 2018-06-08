# [MultiChain](https://www.multichain.com) netdata plugin

Simple MultiChain netdata plugin that will add some internal info (mempoolinfo, info and liststreams) charts to an netdata instance.

## Installation

First add the configuration file:

`/etc/netdata/node.d/multichain.conf`

you can find and example of it in `multichain.conf.md`

Then copy the plugin file:

`/usr/libexec/netdata/node.d/multichain.node.js`

at last, restart netdata:

`systemctl restart netdata`

do not forget to install [node js](https://nodejs.org/) before installing the plugin.