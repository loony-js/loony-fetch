import Fetch from "./fetch";

/**
 * Factory function to create a new Axios instance.
 * @param {object} defaultConfig The default configuration for the instance.
 * @returns {Function} The callable Axios instance (axios(config)).
 */
function createInstance(defaultConfig: any) {
  const context: any = new Fetch(defaultConfig);

  // The core callable function: axios(config) -> context.request(config)
  const instance: any = context.request.bind(context);

  // Copy all prototype methods (get, post, put, delete) to the callable instance
  Object.getOwnPropertyNames(Fetch.prototype).forEach((key) => {
    if (
      key !== "constructor" &&
      key !== "request" &&
      key !== "dispatchRequest"
    ) {
      instance[key] = (Fetch.prototype as any)[key].bind(context);
    }
  });

  // Attach interceptors property
  instance.interceptors = context.interceptors;

  // Attach the instance properties (e.g., defaults)
  instance.defaults = context.defaults;

  return instance;
}

// Create the default global instance
const fetch = createInstance({});

// Add the factory method to the instance
fetch.create = (config: any) => createInstance(config);

// Export the default instance
export default fetch;
