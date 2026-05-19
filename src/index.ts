import Fetch from "./fetch";

function createInstance(defaultConfig: any) {
  const context = new Fetch(defaultConfig);
  const instance: any = context.request.bind(context);

  Object.getOwnPropertyNames(Fetch.prototype).forEach((key) => {
    if (key !== "constructor" && key !== "request" && key !== "dispatchRequest") {
      instance[key] = (Fetch.prototype as any)[key].bind(context);
    }
  });

  instance.interceptors = context.interceptors;
  instance.defaults = context.defaults;

  return instance;
}

const fetch = createInstance({});

fetch.create = (config: any) => createInstance(config);

export default fetch;
