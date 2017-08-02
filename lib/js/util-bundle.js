/* minimal subset of underscore, containing only what rdbhost.js needs.

   see http://underscorejs.org for full library

 */

(function(window, undefined) {

    window._ = {};
    var toString = ({}).toString,
        nativeKeys = Object.keys,
        hasEnumBug = !{toString: null}.propertyIsEnumerable('toString'),
        nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                              'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];


    var property = _.property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });
        return results;
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object.
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = Array.isArray || function(obj) {
            return toString.call(obj) === '[object Array]';
    };
    // Is a given variable an object?
    _.isObject = function(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };
    // Is a given variable a number
    _.isNumber = function(obj) {
        return toString.call(obj) === '[object Number]';
    };
    // Is a given variable a function?
    _.isFunction = function(obj) {
        var type = typeof obj;
        return toString.call(obj) === '[object Function]';
    };

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _.each = _.forEach = function(obj, iteratee) {
        var i, length;
        if (isArrayLike(obj)) {
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    _.map = _.collect = function(obj, iteratee, context) {
       //  iteratee = cb(iteratee, context);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length,
            results = Array(length);
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    _.pluck = function(obj, key) {
        return _.map(obj, _.property(key));
    };

    _.sortBy = function(obj, iteratee, context) {
        // iteratee = cb(iteratee, context);
        return _.pluck(_.map(obj, function(value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iteratee(value, index, list)
            };
        }).sort(function(left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index - right.index;
        }), 'value');
    };

    // An internal function for creating assigner functions.
    var createAssigner = function(keysFunc, defaults) {
        return function(obj) {
            var length = arguments.length;
            if (defaults) obj = Object(obj);
            if (length < 2 || obj == null) return obj;
            for (var index = 1; index < length; index++) {
                var source = arguments[index],
                    keys = keysFunc(source),
                    l = keys.length;
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    if (!defaults || obj[key] === void 0) obj[key] = source[key];
                }
            }
            return obj;
        };
    };

    function collectNonEnumProps(obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

        var prop = 'constructor';
        if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

        while (nonEnumIdx--) {
            prop = nonEnumerableProps[nonEnumIdx];
            if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
                keys.push(prop);
            }
        }
    }

    _.keys = function(obj) {
        if (!_.isObject(obj)) return [];
        if (nativeKeys) return nativeKeys(obj);
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys.push(key);

        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // Retrieve all the property names of an object.
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) return [];
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = createAssigner(_.allKeys);

    // IndexFinder creator function
    function createPredicateIndexFinder(dir) {
        return function(array, predicate) {
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            for (; index >= 0 && index < length; index += dir) {
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    }

    // find position of given element in array
    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

})(window);


(function(window) {

    function hasPromises() {
        var e = window;
        return "Promise" in e &&
            "resolve" in e.Promise && "reject" in e.Promise &&
            "all" in e.Promise && "race" in e.Promise &&
            function () {
                var n;
                new e.Promise(function (e) {
                    n = e
                });
                return "function" == typeof n;
            }()
    }

    function hasFetch() {
        return "fetch" in window;
    }


    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        featuredetects: {
            hasPromises: hasPromises,
            hasFetch: hasFetch
        }
    })
})(window);

(function () {

    if ( typeof window.CustomEvent === "function" ) return false;

    function CustomEvent ( event, params ) {
        params = params || { bubbles: false, cancelable: false, detail: undefined };
        var evt = document.createEvent( 'CustomEvent' );
        evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
        return evt;
    }

    CustomEvent.prototype = window.Event.prototype;

    window.CustomEvent = CustomEvent;
})();

(function(factory, global) {
    if (typeof define === 'function' && define.amd) {
        define(function() {
            return factory(global, navigator)
        })
    } else if (typeof exports === 'object' && typeof module === 'object') {
        module.exports = factory(global, navigator)
    } else {
        // mock the navigator object when under test since `navigator.onLine` is read only
        global.RobustWebSocket = factory(global, typeof Mocha !== 'undefined' ? Mocha : navigator)
    }
})(function(global, navigator) {

    var Obj = Object.create(Object);

    (function () {

        if ( typeof window.CustomEvent !== "function" ) {}

        function CustomEvent ( event, params ) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent( 'CustomEvent' );
            evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
            return evt;
        }

        CustomEvent.prototype = window.Event.prototype;

        window.CustomEvent = CustomEvent;
    })();

    if (typeof Obj.assign != 'function') {
        Obj.assign = function(target, varArgs) { // .length of function is 2
            'use strict';
            if (target == null) { // TypeError if undefined or null
                throw new TypeError('Cannot convert undefined or null to object');
            }

            var to = Object(target);

            for (var index = 1; index < arguments.length; index++) {
                var nextSource = arguments[index];

                if (nextSource != null) { // Skip over if undefined or null
                    for (var nextKey in nextSource) {
                        // Avoid bugs when hasOwnProperty is shadowed
                        if (Obj.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                            to[nextKey] = nextSource[nextKey];
                        }
                    }
                }
            }
            return to;
        };
    }

    var RobustWebSocket = function(url, protocols, userOptions) {
        var realWs = { close: function() {} },
            connectTimeout,
            self = this,
            attempts = 0,
            reconnects = -1,
            reconnectWhenOnlineAgain = false,
            explicitlyClosed = false,
            pendingReconnect,
            opts = Obj.assign({},
                RobustWebSocket.defaultOptions,
                typeof userOptions === 'function' ? { shouldReconnect: userOptions } : userOptions
            );

        if (typeof opts.timeout !== 'number') {
            throw new Error('timeout must be the number of milliseconds to timeout a connection attempt')
        }

        if (typeof opts.shouldReconnect !== 'function') {
            throw new Error('shouldReconnect must be a function that returns the number of milliseconds to wait for a reconnect attempt, or null or undefined to not reconnect.')
        }

        ['bufferedAmount', 'url', 'readyState', 'protocol', 'extensions'].forEach(function(readOnlyProp) {
            Obj.defineProperty(self, readOnlyProp, {
                get: function() { return realWs[readOnlyProp] }
            })
        });

        function clearPendingReconnectIfNeeded() {
            if (pendingReconnect) {
                clearTimeout(pendingReconnect);
                pendingReconnect = null
            }
        }

        var ononline = function(event) {
                if (reconnectWhenOnlineAgain) {
                    clearPendingReconnectIfNeeded();
                    reconnect(event)
                }
            },
            onoffline = function() {
                reconnectWhenOnlineAgain = true;
                realWs.close(1000)
            },
            connectivityEventsAttached = false;

        function detachConnectivityEvents() {
            if (connectivityEventsAttached) {
                global.removeEventListener('online', ononline);
                global.removeEventListener('offline', onoffline);
                connectivityEventsAttached = false
            }
        }

        function attachConnectivityEvents() {
            if (!connectivityEventsAttached) {
                global.addEventListener('online', ononline);
                global.addEventListener('offline', onoffline);
                connectivityEventsAttached = true
            }
        }

        self.send = function() {
            return realWs.send.apply(realWs, arguments)
        };

        self.close = function(code, reason) {
            if (typeof code !== 'number') {
                reason = code;
                code = 1000
            }

            clearPendingReconnectIfNeeded();
            reconnectWhenOnlineAgain = false;
            explicitlyClosed = true;
            detachConnectivityEvents();

            return realWs.close(code, reason)
        };

        self.open = function() {
            if (realWs.readyState !== WebSocket.OPEN && realWs.readyState !== WebSocket.CONNECTING) {
                clearPendingReconnectIfNeeded();
                reconnectWhenOnlineAgain = false;
                explicitlyClosed = false;

                newWebSocket()
            }
        };

        function reconnect(event) {
            if (event.code === 1000 || explicitlyClosed) {
                attempts = 0;
                return
            }
            if (navigator.onLine === false) {
                reconnectWhenOnlineAgain = true;
                return
            }

            var delay = opts.shouldReconnect(event, self);
            if (typeof delay === 'number') {
                pendingReconnect = setTimeout(newWebSocket, delay)
            }
        }

        Obj.defineProperty(self, 'listeners', {
            value: {
                open: [function(event) {
                    if (connectTimeout) {
                        clearTimeout(connectTimeout);
                        connectTimeout = null
                    }
                    event.reconnects = ++reconnects;
                    event.attempts = attempts;
                    attempts = 0;
                    reconnectWhenOnlineAgain = false
                }],
                close: [reconnect]
            }
        });

        Obj.defineProperty(self, 'attempts', {
            get: function() { return attempts },
            enumerable: true
        });

        Obj.defineProperty(self, 'reconnects', {
            get: function() { return reconnects },
            enumerable: true
        });

        function newWebSocket() {
            pendingReconnect = null;
            realWs = new WebSocket(url, protocols);
            realWs.binaryType = self.binaryType;

            attempts++;
            self.dispatchEvent(Obj.assign(new CustomEvent('connecting'), {
                attempts: attempts,
                reconnects: reconnects
            }));

            connectTimeout = setTimeout(function() {
                connectTimeout = null;
                detachConnectivityEvents();
                self.dispatchEvent(Obj.assign(new CustomEvent('timeout'), {
                    attempts: attempts,
                    reconnects: reconnects
                }))
            }, opts.timeout)

            ;['open', 'close', 'message', 'error'].forEach(function(stdEvent) {
                realWs.addEventListener(stdEvent, function(event) {
                    self.dispatchEvent(event);

                    var cb = self['on' + stdEvent];
                    if (typeof cb === 'function') {
                        return cb.apply(self, arguments)
                    }
                })
            });

            attachConnectivityEvents()
        }

        if (opts.automaticOpen) {
            newWebSocket()
        }
    };

    RobustWebSocket.defaultOptions = {
        // the time to wait before a successful connection
        // before the attempt is considered to have timed out
        timeout: 4000,
        // Given a CloseEvent or OnlineEvent and the RobustWebSocket state,
        // should a reconnect be attempted? Return the number of milliseconds to wait
        // to reconnect (or null or undefined to not), rather than true or false
        shouldReconnect: function(event, ws) {
            if (event.code === 1008 || event.code === 1011) return;
            return [0, 3000, 10000][ws.attempts]
        },

        // Create and connect the WebSocket when the instance is instantiated.
        // Defaults to true to match standard WebSocket behavior
        automaticOpen: true
    };

    RobustWebSocket.prototype.binaryType = 'blob';

    // Taken from MDN https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
    RobustWebSocket.prototype.addEventListener = function(type, callback) {
        if (!(type in this.listeners)) {
            this.listeners[type] = []
        }
        this.listeners[type].push(callback)
    };

    RobustWebSocket.prototype.removeEventListener = function(type, callback) {
        if (!(type in this.listeners)) {
            return
        }
        var stack = this.listeners[type];
        for (var i = 0, l = stack.length; i < l; i++) {
            if (stack[i] === callback) {
                stack.splice(i, 1);
                return
            }
        }
    };

    RobustWebSocket.prototype.dispatchEvent = function(event) {
        if (!(event.type in this.listeners)) {
            return
        }
        var stack = this.listeners[event.type];
        for (var i = 0, l = stack.length; i < l; i++) {
            stack[i].call(this, event)
        }
    };

    return RobustWebSocket
}, typeof window != 'undefined' ? window : (typeof global != 'undefined' ? global : this));(function(window) {
  function E () {
    // Keep this empty so it's easier to inherit from
    // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
  }

  E.prototype = {
    on: function (name, callback, ctx) {
      var e = this.e || (this.e = {});

      (e[name] || (e[name] = [])).push({
        fn: callback,
        ctx: ctx
      });

      return this;
    },

    once: function (name, callback, ctx) {
      var self = this;
      function listener () {
        self.off(name, listener);
        callback.apply(ctx, arguments);
      }

      listener._ = callback;
      return this.on(name, listener, ctx);
    },

    emit: function (name) {
      var data = [].slice.call(arguments, 1);
      var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
      var i = 0;
      var len = evtArr.length;

      for (i; i < len; i++) {
        evtArr[i].fn.apply(evtArr[i].ctx, data);
      }

      return this;
    },

    off: function (name, callback) {
      var e = this.e || (this.e = {});
      var evts = e[name];
      var liveEvents = [];

      if (evts && callback) {
        for (var i = 0, len = evts.length; i < len; i++) {
          if (evts[i].fn !== callback && evts[i].fn._ !== callback)
            liveEvents.push(evts[i]);
        }
      }

      // Remove event from queue to prevent memory leak
      // Suggested by https://github.com/lazd
      // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

      (liveEvents.length)
          ? e[name] = liveEvents
          : delete e[name];

      return this;
    }
  };

  window.TinyEmitter = E;

})(window);

