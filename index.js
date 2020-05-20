const { pathToRegexp } = require('path-to-regexp');
const _ = require('lodash');

class CacheResponses {
  constructor(config = {}) {
    this.config = {
      pathToRegexp: { sensitive: true, strict: true },
      routes: [],
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
    const cashed = await ctx.cashed();
    if (cashed) return;
    return next();
  }

  paired(route, path) {
    return pathToRegexp(route, [], this.config.pathToRegexp).exec(path);
  }
}
module.exports = CacheResponses;
