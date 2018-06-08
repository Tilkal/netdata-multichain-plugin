[MultiChain](https://www.multichain.com)

Example netdata configuration for node.d/multichain.conf. Copy this section to multichain.conf and change name/ip.

```json
{
    "enable_autodetect": false,
    "update_every": 5,
    "servers": [
        {
            "name": "multichain-1",
            "hostname": "localhost",
            "port": 6300,
            "username": "username",
            "password": "password",
            "chain": "chain name",
            "update_every": 5,
            "path": "/"
        }
    ]
}
```

The output of / - getinfo looks like this

```json
{
    "version" : "1.0.1",
    "nodeversion" : 10001901,
    "protocolversion" : 10008,
    "chainname" : "chain",
    "description" : "MultiChain hain",
    "protocol" : "multichain",
    "port" : 6301,
    "setupblocks" : 60,
    "nodeaddress" : "chain@ip:port",
    "burnaddress" : "1XXXXXXXXXXXXXXXa4XXXXXXaBXXXXXXWPt8m1",
    "incomingpaused" : false,
    "miningpaused" : false,
    "walletversion" : 60000,
    "balance" : 0.00000000,
    "walletdbversion" : 2,
    "reindex" : false,
    "blocks" : 100733,
    "timeoffset" : -1,
    "connections" : 7,
    "proxy" : "",
    "difficulty" : 0.00000006,
    "testnet" : false,
    "keypoololdest" : 1505983761,
    "keypoolsize" : 2,
    "paytxfee" : 0.00000000,
    "relayfee" : 0.00000000,
    "errors" : ""
}
```

The output of / - getmempoolinfo looks like this

```json
{
    "size" : 0,
    "bytes" : 0
}
```
