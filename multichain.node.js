'use strict'

// This program will connect to one or more multichain servers
// to get their stats

// example configuration in netdata/conf.d/node.d/multichain.conf.md

const netdata = require('netdata')
const http = require('http')
const https = require('https')

netdata.debug(`loaded  ${__filename} plugin`)

netdata.processors.multichainProcessor = {
  name: 'multichain',
  /**
   * Post a json body and parse a json response
   * @param {object} options options to drive the http(s) module
   * @param {string} options.hostname host to call
   * @param {int} options.port host port to call
   * @param {object} options.headers headers to be used by the http request
   * @param {string} options.protocol use 'https:' to send an https request, otherwise http is used
   * @returns {Promise} a Promise to receive the request response or any error. The promise will be resolved with a response object:
   *  - response.body {object} the parsed json result
   *  - response.body.error {object} the detailed error if an error occured
   *  - response.statusCode {int}  the response status code (http status), negative if an error occurred emitting the request
   *  - response.statusMessage {string} the response status message
   *  - response.headers {object} the response headers
   * @see {@link https://nodejs.org/api/http.html}
   */
  post: function (options, data) {
    return new Promise((resolve, reject) => {
      let body = []
      const dataString = JSON.stringify(data)

      options.headers = options.headers || {}
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = Buffer.byteLength(dataString)
      options.method = 'POST'

      const protoRequest = options.protocol === 'https:' ? https : http
      let req = protoRequest.request(options, (res) => {
        let response = {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage || '',
          headers: res.headers
        }

        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body.push(chunk)
        })
        res.on('end', () => {
          try {
            response.body = JSON.parse(body.join(''))
          } catch (error) {
            response.body = { error: error }
          }

          if (res.statusCode < 200 || res.statusCode > 299) {
            // should be an Error
            reject(response)
          } else {
            resolve(response)
          }
        })
      })

      req.on('error', (e) => {
        // should be an Error
        const error = { statusCode: -1, statusMessage: 'Error during call', body: { error: e } }
        reject(error)
      })

      // write data to request body
      req.write(dataString)
      req.end()
    })
  },
  process: function (service, callback) {
    const options = {
      hostname: service.hostname,
      port: service.port,
      auth: `${service.username}:${service.password}`,
      chain: service.chain
    }

    const getinfo = { method: 'getinfo', chain_name: options.chain, id: 1, jsonrpc: '1.0', params: [] }
    const getmempoolinfo = { method: 'getmempoolinfo', chain_name: options.chain, id: 1, jsonrpc: '1.0', params: [] }
    const liststreams = { method: 'liststreams', chain_name: options.chain, id: 1, jsonrpc: '1.0', params: [] }

    let data = {}
    this.post(options, getinfo).then(info => {
      data.blocks = info.body.result.blocks
      data.connections = info.body.result.connections
      return this.post(options, getmempoolinfo)
    }).then(mempoolinfo => {
      data.memSize = mempoolinfo.body.result.size
      data.memBytes = mempoolinfo.body.result.bytes
      return this.post(options, liststreams)
    }).then(streams => {
      data.streams = streams.body.result
      return data
    }).then(callback).catch(error => {
      netdata.debug(JSON.stringify(error))
      callback(null)
    })
  }
}

const multichain = {
  name: 'multichain',
  enable_autodetect: false,
  update_every: 5,
  base_priority: 60000,

  dimensions: {
    blocksSize: {
      size: 'memSize'
    },
    blocksMemory: {
      memory: 'memBytes'
    },
    blocks: {
      blocks: 'blocks'
    },
    connections: {
      connections: 'connections'
    },
    stream: {
      items: {
        confirmed: 'confirmed',
        unconfirmed: 'unconfirmed'
      },
      keys: {
        keys: 'keys'
      }
    }
  },
  charts: {},

  createBasicDimension: function (id, name, divisor) {
    return {
      id: id,                                      // the unique id of the dimension
      name: name,                                  // the name of the dimension
      algorithm: netdata.chartAlgorithms.absolute, // the id of the netdata algorithm
      multiplier: 1,                               // the multiplier
      divisor: divisor,                            // the divisor
      hidden: false                                // is hidden (boolean)
    }
  },

  // Gets strem keys chart. Will be created if not existing.
  getStreamKeysChart: function (service, streamName) {
    var id = this.getChartId(service, `stream.${streamName}.key`)
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.stream.keys).forEach(dimension => {
      dim[multichain.dimensions.stream.keys[dimension]] = this.createBasicDimension(multichain.dimensions.stream.keys[dimension], dimension, 1)
    })

    chart = {
      id: id,                                               // the unique id of the chart
      name: '',                                             // the unique name of the chart
      title: `${service.name} stream ${streamName} keys`,   // the title of the chart
      units: 'keys',                                        // the units of the chart dimensions
      family: `stream ${streamName}`,                       // the family of the chart
      context: 'multichain',                                // the context of the chart
      type: netdata.chartTypes.area,                        // the type of the chart
      priority: multichain.base_priority + 1,               // the priority relative to others in the same family
      update_every: service.update_every,                   // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },
  // Gets stream items chart. Will be created if not existing.
  getStreamItemsChart: function (service, streamName) {
    var id = this.getChartId(service, `stream.${streamName}.items`)
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.stream.items).forEach(dimension => {
      dim[multichain.dimensions.stream.items[dimension]] = this.createBasicDimension(multichain.dimensions.stream.items[dimension], dimension, 1)
    })

    chart = {
      id: id,                                               // the unique id of the chart
      name: '',                                             // the unique name of the chart
      title: `${service.name} stream ${streamName} items`,  // the title of the chart
      units: 'items',                                       // the units of the chart dimensions
      family: `stream ${streamName}`,                       // the family of the chart
      context: 'multichain',                                // the context of the chart
      type: netdata.chartTypes.area,                        // the type of the chart
      priority: multichain.base_priority + 1,               // the priority relative to others in the same family
      update_every: service.update_every,                   // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },
  // Gets blocks size. Will be created if not existing.
  getBlocksSizeChart: function (service) {
    var id = this.getChartId(service, 'blocks.size')
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.blocksSize).forEach(dimension => {
      dim[multichain.dimensions.blocksSize[dimension]] = this.createBasicDimension(multichain.dimensions.blocksSize[dimension], dimension, 1)
    })

    chart = {
      id: id,                                         // the unique id of the chart
      name: '',                                       // the unique name of the chart
      title: `${service.name} blocks size`,           // the title of the chart
      units: 'transactions',                          // the units of the chart dimensions
      family: 'blocks',                                // the family of the chart
      context: 'multichain',                          // the context of the chart
      type: netdata.chartTypes.area,                  // the type of the chart
      priority: multichain.base_priority + 1,         // the priority relative to others in the same family
      update_every: service.update_every,             // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },
  // Gets blocks memory chart. Will be created if not existing.
  getBlocksMemoryChart: function (service) {
    var id = this.getChartId(service, 'blocks.memory')
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.blocksMemory).forEach(dimension => {
      dim[multichain.dimensions.blocksMemory[dimension]] = this.createBasicDimension(multichain.dimensions.blocksMemory[dimension], dimension, 1)
    })

    chart = {
      id: id,                                         // the unique id of the chart
      name: '',                                       // the unique name of the chart
      title: `${service.name} blocks memory`,         // the title of the chart
      units: 'bytes',                                 // the units of the chart dimensions
      family: 'blocks',                                // the family of the chart
      context: 'multichain',                          // the context of the chart
      type: netdata.chartTypes.area,                  // the type of the chart
      priority: multichain.base_priority + 1,         // the priority relative to others in the same family
      update_every: service.update_every,             // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },
  // Gets a blocks chart. Will be created if not existing.
  getBlocksChart: function (service) {
    var id = this.getChartId(service, 'blocks.count')
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.blocks).forEach(dimension => {
      dim[multichain.dimensions.blocks[dimension]] = this.createBasicDimension(multichain.dimensions.blocks[dimension], dimension, 1)
    })

    chart = {
      id: id,                                         // the unique id of the chart
      name: '',                                       // the unique name of the chart
      title: `${service.name} blocks`,                // the title of the chart
      units: 'blocks',                              // the units of the chart dimensions
      family: 'blocks',                                  // the family of the chart
      context: 'multichain',                        // the context of the chart
      type: netdata.chartTypes.area,               // the type of the chart
      priority: multichain.base_priority + 1,               // the priority relative to others in the same family
      update_every: service.update_every,             // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },
  // Gets a channel connection chart. Will be created if not existing.
  getConnectionsChart: function (service) {
    var id = this.getChartId(service, 'connections.count')
    var chart = multichain.charts[id]
    if (this.isDefined(chart)) return chart

    var dim = {}
    Object.keys(multichain.dimensions.connections).forEach(dimension => {
      dim[multichain.dimensions.connections[dimension]] = this.createBasicDimension(multichain.dimensions.connections[dimension], dimension, 1)
    })

    chart = {
      id: id,                                         // the unique id of the chart
      name: '',                                       // the unique name of the chart
      title: `${service.name} connections`,       // the title of the chart
      units: 'connections',                              // the units of the chart dimensions
      family: 'connections',                                  // the family of the chart
      context: 'multichain',                        // the context of the chart
      type: netdata.chartTypes.line,                  // the type of the chart
      priority: multichain.base_priority + 1,               // the priority relative to others in the same family
      update_every: service.update_every,             // the expected update frequency of the chart
      dimensions: dim
    }
    chart = service.chart(id, chart)
    multichain.charts[id] = chart

    return chart
  },

  processResponse: function (service, content) {
    const stats = multichain.convertToJson(content)
    if (stats === null) return

    // add the service
    service.commit()

    const charts = multichain.parseCharts(service, stats)
    charts.forEach(chart => {
      service.begin(chart.chart)
      chart.dimensions.forEach(dimension => {
        service.set(dimension.name, dimension.value)
      })
      service.end()
    })
  },

  parseCharts: function (service, stats) {
    const charts = []
    stats.streams.forEach(stream => {
      if (stream.subscribed) {
        charts.push(this.parseStreamItemsChart(service, stream))
        charts.push(this.parseStreamKeysChart(service, stream))
      }
    })
    charts.push(this.parseBlocksSizeChart(service, stats))
    charts.push(this.parseBlocksMemoryChart(service, stats))
    charts.push(this.parseBlocksChart(service, stats))
    charts.push(this.parseConnectionsChart(service, stats))
    return charts
  },

  parseStreamItemsChart: function (service, streamStats) {
    const items = streamStats['items']
    const confirmed = streamStats['confirmed']
    return this.getChart(this.getStreamItemsChart(service, streamStats.name),
      [ this.getDimension('confirmed', streamStats['confirmed']),
        this.getDimension('unconfirmed', items - confirmed)
      ]
    )
  },

  parseStreamKeysChart: function (service, streamStats) {
    return this.getChart(this.getStreamKeysChart(service, streamStats.name),
      Object.keys(multichain.dimensions.stream.keys).map(dimension => this.getDimension(multichain.dimensions.stream.keys[dimension], streamStats[multichain.dimensions.stream.keys[dimension]]))
    )
  },

  parseBlocksSizeChart: function (service, stats) {
    return this.getChart(this.getBlocksSizeChart(service),
      Object.keys(multichain.dimensions.blocksSize).map(dimension => this.getDimension(multichain.dimensions.blocksSize[dimension], stats[multichain.dimensions.blocksSize[dimension]]))
    )
  },
  parseBlocksMemoryChart: function (service, stats) {
    return this.getChart(this.getBlocksMemoryChart(service),
      Object.keys(multichain.dimensions.blocksMemory).map(dimension => this.getDimension(multichain.dimensions.blocksMemory[dimension], stats[multichain.dimensions.blocksMemory[dimension]]))
    )
  },
  parseBlocksChart: function (service, stats) {
    return this.getChart(this.getBlocksChart(service),
      Object.keys(multichain.dimensions.blocks).map(dimension => this.getDimension(multichain.dimensions.blocks[dimension], stats[multichain.dimensions.blocks[dimension]]))
    )
  },
  parseConnectionsChart: function (service, stats) {
    return this.getChart(this.getConnectionsChart(service),
      Object.keys(multichain.dimensions.connections).map(dimension => this.getDimension(multichain.dimensions.connections[dimension], stats[multichain.dimensions.connections[dimension]]))
    )
  },

  getDimension: function (name, value) {
    return { name, value }
  },

  getChart: function (chart, dimensions) {
    return { chart, dimensions }
  },

  getChartId: function (service, suffix) {
    return `${service.name}.${suffix}`
  },

  convertToJson: function (content) {
    if (content === null) return null
    var json = content
    // can't parse if it's already a json object,
    // the check enables easier testing if the content is already valid JSON.
    if (typeof content !== 'object') {
      try {
        json = JSON.parse(content)
      } catch (error) {
        netdata.error(`multichain: Got a response, but it is not valid JSON. Ignoring. Error: ${error.message}`)
        return null
      }
    }
    return this.isResponseValid(json) ? json : null
  },

  // some basic validation
  isResponseValid: function (json) {
    if (this.isUndefined(json.blocks)) return false
    return this.isDefined(json.connections)
  },

  // module.serviceExecute()
  // this function is called only from this module
  // its purpose is to prepare the request and call
  // netdata.serviceExecute()
  serviceExecute: function (server) {
    netdata.debug(`${this.name}: ${server.name}: url: ${server.hostname}:${server.port}${server.path}, update_every: ${server.updateEvery}`)

    const service = netdata.service({
      name: server.name,
      update_every: server.updateEvery,
      hostname: server.hostname,
      port: server.port,
      username: server.username,
      password: server.password,
      chain: server.chain,
      processor: netdata.processors.multichainProcessor,
      module: this
    })
    service.execute(this.processResponse)
  },

  configure: function (config) {
    if (this.isUndefined(config.servers)) return 0
    var added = 0
    config.servers.forEach(server => {
      if (this.isUndefined(server.update_every)) server.update_every = this.update_every
      if (this.areUndefined([server.name, server.hostname, server.port, server.username, server.password, server.chain, server.path])) { } else {
        this.serviceExecute(server)
        added++
      }
    })
    return added
  },

  // module.update()
  // this is called repeatedly to collect data, by calling
  // netdata.serviceExecute()
  update: function (service, callback) {
    service.execute(function (serv, data) {
      service.module.processResponse(serv, data)
      callback()
    })
  },

  isUndefined: function (value) {
    return typeof value === 'undefined'
  },

  areUndefined: function (values) {
    return values.find(value => this.isUndefined(value))
  },

  isDefined: function (value) {
    return typeof value !== 'undefined'
  }
}

module.exports = multichain
