const _ = require('lodash');
const ms = require('ms');
const { pathToRegexp } = require('path-to-regexp');

class CacheResponses {
  constructor(config = {}) {
    this.config = {
      pathToRegexp: { sensitive: true, strict: true },
      routes: [],
      // <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control>
      // <https://web.dev/uses-long-cache-ttl/?utm_source=lighthouse&utm_medium=unknown>
      cacheControl: ['public', `max-age=${ms('1y') / 1000}`],
      ...config
    };

    this.middleware = this.middleware.bind(this);
    this.paired = this.paired.bind(this);
  }

  async middleware(ctx, next) {
    if (!_.isFunction(ctx.cashed))
      throw new Error(
        'Please ensure you have set up `koa-cash` properly, see https://github.com/koajs/cash for more info.'
      );

    const { path } = ctx.request;

    let match = false;

    for (let i = 0; i < this.config.routes.length; i++) {
      let route = this.config.routes[i];
      if (_.isObject(this.config.routes[i])) route = this.config.routes[i].path;

      if (this.paired(route, path)) {
        match = true;
        break;
      }
    }

    if (!match) return next();

    // inspired by @redpill-paris/koa-cache-control
    // <https://github.com/RedPillGroup/koa-cache-control>
    if (
      Array.isArray(this.config.cacheControl) &&
      this.config.cacheControl.length > 0
    )
      ctx.set('Cache-Control', this.config.cacheControl.join(', '));

    const cashed = await ctx.cashed();
    if (cashed) return;
    return next();
  }

  paired(route, path) {
    return pathToRegexp(route, [], this.config.pathToRegexp).exec(path);
  }
}
module.exports = CacheResponses;
