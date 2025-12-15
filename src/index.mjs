// mini-axios/index.js
import Axios from "./axios.js";

/**
 * Factory function to create a new Axios instance.
 * @param {object} defaultConfig The default configuration for the instance.
 * @returns {Function} The callable Axios instance (axios(config)).
 */
function createInstance(defaultConfig) {
  const context = new Axios(defaultConfig);

  // The core callable function: axios(config) -> context.request(config)
  const instance = context.request.bind(context);

  // Copy all prototype methods (get, post, put, delete) to the callable instance
  Object.getOwnPropertyNames(Axios.prototype).forEach((key) => {
    if (
      key !== "constructor" &&
      key !== "request" &&
      key !== "dispatchRequest"
    ) {
      instance[key] = Axios.prototype[key].bind(context);
    }
  });

  // Attach interceptors property
  instance.interceptors = context.interceptors;

  // Attach the instance properties (e.g., defaults)
  instance.defaults = context.defaults;

  return instance;
}

// Create the default global instance
const axios = createInstance({});

// Add the factory method to the instance
axios.create = (config) => createInstance(config);

// Export the default instance
export default axios;
