export type ErrorHandler<Req, Res> = (err: any, req: Req, res: Res) => void;

export type Options<Req, Res> = {
  onError?: ErrorHandler<Req, Res>;
  // onNoMatch?: ErrorHandler<Req, Res>;
};

export type NextHandler<Req, Res> = Handler<Req, Res> | ErrorHandler<Req, Res>;

export type Handler<Req, Res> = (
  req: Req,
  res: Res,
  next?: NextHandler<Req, Res>
) => any | Promise<any>;

export type WrapHandler = (next: any, index: number) => Promise<any>;

export type Method<Req, Res> = (...fns: Handler<Req, Res>[]) => void;

class NextEc<Req, Res> {
  myReq: any;
  myRes: any;
  allStack: Handler<Req, Res>[] = [];
  stack: Handler<Req, Res>[] = [];
  routes: {
    [method: string]: Handler<Req, Res>[];
  } = {};
  result: {
    [method: string]: {
      matched: boolean;
      handler: any;
    };
  } = {};

  onError: ErrorHandler<Req, Res>;
  onNoMatch: ErrorHandler<Req, Res>;
  head = this.initMethod("HEAD");
  get = this.initMethod("GET");
  post = this.initMethod("POST");
  put = this.initMethod("PUT");
  delete = this.initMethod("DELETE");
  patch = this.initMethod("PATCH");
  options = this.initMethod("OPTIONS");
  connect = this.initMethod("CONNECT");
  trace = this.initMethod("TRACE");

  constructor(options?: Options<Req, Res>) {
    if (options) {
      const {onError} = options;
      if (onError) this.onError = onError;
      // if (onNoMatch) this.onNoMatch = onNoMatch;
    }
  }

  initMethod(method: string): Method<Req, Res> {
    this.routes[method] = [];
    this.result[method] = {
      matched: false,
      handler: null,
    };
    return (...handlers: Handler<Req, Res>[]) => {
      if (handlers.length === 0) throw new Error("Need at least a function");
      this.routes[method].push(...handlers);
    };
  }

  all: Method<Req, Res> = (...fns: Handler<Req, Res>[]) => {
    this.allStack.push(...fns);
  };

  use: Method<Req, Res> = (...fns: Handler<Req, Res>[]) => {
    this.stack.push(...fns);
  };

  compose(...handlers: Handler<Req, Res>[]) {
    const wrap =
      (handler: Handler<Req, Res>): WrapHandler =>
      async (next: any, index: number) =>
        handler(this.myReq, this.myRes, next.bind(null, index));

    const run = (index: number, err: any = undefined) => {
      if (err) {
        if (this.onError) this.onError(err, this.myReq, this.myRes);
        return;
      }
      if (index >= handlers.length) return;

      const wHandler = wrap(handlers[index]);
      wHandler(run, index + 1).catch((err) => run(handlers.length, err));
    };

    return async () => run(0);
  }

  build() {
    for (const method in this.routes) {
      const matched = this.routes[method].length !== 0;
      let handlers = [].concat(this.allStack);
      if (matched) handlers = handlers.concat(this.stack, this.routes[method]);
      const composedHandler = this.compose(...handlers);

      this.result[method] = {
        matched,
        handler: composedHandler,
      };
    }
  }

  exec(resolve: any) {
    const {method} = this.myReq;
    const {handler} = this.result[method];
    handler().then(() => resolve());
    // if (!matched && this.onNoMatch)
    //   this.onNoMatch("Not match", this.myReq, this.myRes);
    // return resolve();
  }

  handler() {
    return async (req: any, res: any) => {
      return new Promise((resolve: any, reject: any) => {
        this.myReq = req;
        this.myRes = res;
        this.build();
        this.exec(resolve);
      });
    };
  }

  wrapE(exMiddleware: any, ...options: any[]) {
    return (req: Req, res: Res, next: any) => {
      exMiddleware(...options)(req, res, next);
    };
  }
}

export default NextEc;
