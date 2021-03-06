const debug = require('debug')

const redis = require('@orbiting/backend-modules-base/lib/redis')

const namespace = 'crowdfundings:cache'

const getRedisKey = ({ prefix, key }) =>
  `${namespace}:${prefix}:${key}`

const createGet = ({ options, redis }) => async function () {
  const payload = await redis.getAsync(getRedisKey(options))
  debug('crowdfundings:cache:get')(
    `${payload ? 'HIT' : 'MISS'} %O`,
    options.key
  )

  return payload
    ? JSON.parse(payload)
    : payload
}

const createSet = ({ options, redis }) => async function (payload) {
  let payloadString

  try {
    payloadString = JSON.stringify(payload)
  } catch (e) {
    console.info(e, options.key)
  }

  if (payloadString) {
    debug('crowdfundings:cache:set')('PUT %O', options.key)
    return redis.setAsync(
      getRedisKey(options),
      payloadString,
      'EX', options.ttl || 60
    )
  }
}

const createCache = () => async function (payloadFunction) {
  debug('crowdfundings:cache')('cache')

  if (typeof payloadFunction !== 'function') {
    throw Error('cache expects function to evaluate payload')
  }

  let data = await this.get()

  if (data) {
    return data.payload
  }

  data = { payload: await payloadFunction() }

  await this.set(data)

  return data.payload
}

const createInvalidate = ({ options, redis }) => async function () {
  debug('crowdfundings:cache')('INVALIDATE')
  await redis
    .evalAsync(
      `return redis.call('del', unpack(redis.call('keys', ARGV[1])))`,
      0,
      `${namespace}:${options.prefix}*`
    )
    .catch(() => {})// fails if no keys are matched
}

module.exports = (options) => ({
  get: createGet({ options, redis }),
  set: createSet({ options, redis }),
  cache: createCache({ options, redis }),
  invalidate: createInvalidate({ options, redis })
})
