const Koa = require('koa');
const NodeCache = require('node-cache');
const Redis = require('@ladjs/redis');
const _ = require('lodash');
const koaCash = require('koa-cash');
const supertest = require('supertest');
const test = require('ava');
const safeStringify = require('fast-safe-stringify');

const CacheResponses = require('..');

test('should expose methods and default options', t => {
  const cacheResponses = new CacheResponses();
  t.deepEqual(cacheResponses.config.pathToRegexp, {
    sensitive: true,
    strict: true
  });
  t.deepEqual(cacheResponses.config.routes, []);
  t.true(_.isFunction(cacheResponses.middleware));
  t.true(_.isFunction(cacheResponses.paired));
});

test('memory cache', async t => {
  const app = new Koa();
  const myCache = new NodeCache();
  app.use(
    koaCash({
      maxAge: 0,
      threshold: 0,
      async get(key) {
        const value = await myCache.get(key);
        return value ? JSON.parse(value) : null;
      },
      set(key, value, maxAge) {
        return myCache.set(key, safeStringify(value), maxAge);
      }
    })
  );
  app.use(
    new CacheResponses({
      routes: ['/']
    }).middleware
  );

  let cachedTime;
  app.use((ctx, next) => {
    const time = Date.now();
    if (!cachedTime) cachedTime = time;
    ctx.body = time;
    return next();
  });

  const server = app.listen();
  const request = supertest(server);

  let { body } = await request.get('/');
  t.is(body, cachedTime);
  t.is(JSON.parse(myCache.get('/')).body, cachedTime.toString());
  ({ body } = await request.get('/'));
  t.is(body, cachedTime);
  t.is(JSON.parse(myCache.get('/')).body, cachedTime.toString());
});

test('redis cache', async t => {
  const app = new Koa();
  const redis = new Redis({
    lazyConnect: true,
    keyPrefix: Date.now().toString()
  });
  await redis.connect();
  app.use(
    koaCash({
      maxAge: 0,
      threshold: 0,
      async get(key) {
        let value;
        try {
          value = await redis.get(key);
          if (value) value = JSON.parse(value);
        } catch (err) {
          console.error(err);
        }

        return value;
      },
      set(key, value, maxAge) {
        if (maxAge <= 0) return redis.set(key, safeStringify(value));
        return redis.set(key, safeStringify(value), 'EX', maxAge);
      }
    })
  );
  app.use(
    new CacheResponses({
      routes: ['/']
    }).middleware
  );

  let cachedTime;
  app.use((ctx, next) => {
    const time = Date.now();
    if (!cachedTime) cachedTime = time;
    ctx.body = time;
    return next();
  });

  const server = app.listen();
  const request = supertest(server);

  let { body } = await request.get('/');
  t.is(body, cachedTime);
  let cached = await redis.get('/');
  t.is(JSON.parse(cached).body, cachedTime.toString());
  ({ body } = await request.get('/'));
  t.is(body, cachedTime);
  cached = await redis.get('/');
  t.is(JSON.parse(cached).body, cachedTime.toString());
});
