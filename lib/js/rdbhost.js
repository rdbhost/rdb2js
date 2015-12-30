/*

  RdbHost API module, version 2

  Facilitates accessing Rdbhost hosted databases and related services from JavaScript in the browser.

 */

(function (undefined) {

    "use strict";

    var events = new EventEmitter(),
        conns = {},
        requestId = 1,
        requestTracker = {},
        HOST, ACCT;

    var SOCKET_STATUS = {
        OPEN: 1,
        CONNECTING: 0,
        CLOSING: 2,
        CLOSED: 3
    };

    var EVENT_NAMES = {
        connectionmade: 'connection-opened',
        connectionclosed: 'connection-closed',
        connectionerror: 'connection-error'
    };

    function make_roleid(role, acct) {
        var acctStr = '000000000' + acct;
        return role.substr(0,1).toLowerCase() + acctStr.substr(acctStr.length-10,10);
    }

    /* connect - stores connection information for later use.

        @param host: domain of server (optional)
        @param acct: account number to connect to
     */
    function connect(host, acct) {
        HOST = acct ? host : 'www.rdbhost.com';
        ACCT = acct ? acct : host;
    }

    /* make_connection - makes new web-socket connection to server, using given role

        @param role - "super", "auth", "preauth" or "role"
     */
    function make_connection(role) {

        if ( !ACCT ) throw new Error('account not set with connect method');
        if ( conns[role] ) throw new Error('connection already established for '+role);

        var roleid = make_roleid(role, ACCT);

        conns[role] =  new ReconnectingWebSocket('wss://'+HOST+'/wsdb/'+roleid, null, {debug: true});

        // announce connection-complete, via events
        conns[role].onopen = function(evt) {
            events.emit(EVENT_NAMES.connectionmade, role, evt);
            events.emit(EVENT_NAMES.connectionmade+':'+role, role, evt);
        };
        // announce connection-closed, via events
        conns[role].onclose = function(evt) {
            events.emit(EVENT_NAMES.connectionclosed, role, evt);
            events.emit(EVENT_NAMES.connectionclosed+':'+role, role, evt);
        };
        // announce connection-closed, via events
        conns[role].onerror = function(evt) {
            events.emit(EVENT_NAMES.connectionerror, role, evt);
            events.emit(EVENT_NAMES.connectionerror+':'+role, role, evt);
        };

        // handle message received
        conns[role].onmessage = function(evt) {
            handle_message(conns[role], role, evt.data);
        };

        return conns[role];
    }

    /* close_connections

        @param code - close code for all connections
        @param reason - close reason for all connections
     */
    function close_connections(role, reason) {
        for (var r in conns) {
            if ( conns.hasOwnProperty(r) ) {
                conns[r].close(1000, reason);
                delete conns[r];
            }
        }
    }

    /* handle_message

       @param role - which role-connection received msg
       @param data - payload of message
     */
    function handle_message(conn, role, json) {

        var data = JSON.parse(json),
            reqId = data['request-id'],
            responder = requestTracker[reqId],
            resolve, reject, req;

        if ( responder ) {
            resolve = responder[0];
            reject = responder[1];
            req = responder[2];

            if ( data.status[0] === 'error' )
                reject(new Error('error ~1 ~2'.replace('~1', data.error[0]).replace('~2', data.error[1])));
            else {

                // apply each result hook to result data, in place
                _.forEach(req.result_hooks, function(f) {
                   f(data);
                });
                resolve(data);
            }

            // remove resolved or rejected promise from tracker
            delete requestTracker[reqId];
        }

        // handle live-reload content here, maybe

        else if ( !reqId ) {

            // handle broadcast messages here.
        }

        window.console.log(data);
    }


    function fix_record_sets(d) {

        // if data already has record_sets, return
        if ( d.result_sets )
            return;
        if ( !d.records )
            return;

        var recs = d.records;
        d.result_sets = [recs];
        delete d.records;
    }

    function strip_listen(d) {

        var rs = d.result_sets;
        if ( rs.length < 2 )
            throw new Error('invalid result set collection provided to strip_listen');

        rs.splice(0, 1);
        rs.splice(rs.length-2, 2);
    }

    /* requestObjectPrototype

        prototype for request objects; request objects are created with this as prototype,
          so these methods are available.
     */
    var requestObjectPrototype = {

/*
        q: undefined,
        authCode: '-',
        args: [],
        namedParams: {},
        repeatCt: 1,
        mode: '',

        reqId: undefined,
        role: undefined,
*/

        conn: undefined,

        init: function(role, authcode) {

            this.role = role;
            this.reqId = role + (requestId++);
            this.authCode = authcode || '-';

            this.conn = conns[role] || make_connection(role);
            this.result_hooks = [fix_record_sets];

            return this;
        },

        proxy: function(mode, submode) {
            this.mode = mode;
            return this;
        },

        query: function(q) {
            this.q = q;
            return this;
        },

        params: function(params) {
            if (typeof params !== 'object')
                throw new Error('params must be object or array');
            if (typeof params.length === 'number')
                this.args = params;
            else
                this.namedParams = params;

            return this;
        },

        form_data: function(formData) {

        },

        listen: function(channel) {

            if ( channel.indexOf('"') > -1 )
                throw new Error('channel name cannot include quotes');

            var q = ['LISTEN "~1"'.replace('~1', channel),
                     this.q,
                     'COMMIT; BEGIN;' ];
            this.q = q.join(';\n');

            this.result_hooks.push(strip_listen);

            return this;
        },

        repeat: function(repCt) {

            try {
                repCt = Number(repCt);
            }
            catch (e) {
                throw new Error('provide number value to repeat method.');
            }
            this.repeatCt = repCt;
            return this;
        },

        go_http: function () {

        },

        go_websocket: function() {

            // assembla data to send to server
            var d = {
                q: this.q,
                args: this.args,
                namedParams: this.namedParams,
                'request-id': this.reqId
            };
            if ( this.hasOwnProperty('repeatCt') )
                d.repeat = this.repeatCt;
            if ( this.hasOwnProperty('mode') )
                d.mode = this.mode;
            if ( this.authCode )
                d.authcode = this.authCode;

            // convert data to json format
            var json = JSON.stringify(d),
                this_ = this;

            function provide_request_promise() {

                // returns promise, and track promise by
                return new Promise(function(resolve, reject) {

                    // send the request to the server
                    this_.conn.send(json);

                    // add promise handlers to tracker, for use by socket message-handler
                    requestTracker[this_.reqId] = [resolve, reject, this_];
                });
            }

            // if socket ready to go
            if ( conns[this.role].readyState === SOCKET_STATUS.OPEN ) {

                return provide_request_promise();
            }
            // else wait for socket to become ready
            else {

                return new Promise(function(resolve, reject) {

                    events.once(EVENT_NAMES.connectionmade+':'+this_.role, function(evt) {

                        resolve(provide_request_promise());
                    });
                });
            }

        },

        go: function() {

            if ( !this.q ) throw new Error('no query was provided');

            // test for formData element, and use go_http if found,


            // else use go_websocket

            return this.go_websocket();
        },

        // return copy of query object
        copy: function() {

            return _.clone(this_);
        }

    };


    // todo - implement password interaction

    function Preauth() {
        var req = Object.create(requestObjectPrototype);
        return req.init('preauth', undefined);
    }

    function Auth(authcode, password) {
        if ( !authcode && !password ) throw new Error('provide authCode for auth role');
        // todo - add handling for password as alternative to authCode
        var req = Object.create(requestObjectPrototype);
        return req.init('auth', authcode);
    }

    function Super(authcode) {
        if ( !authcode ) throw new Error('provide authCode for auth role');
        var req = Object.create(requestObjectPrototype);
        return req.init('super', authcode);
    }

    function Reader() {
        var req = Object.create(requestObjectPrototype);
        return req.init('reader', undefined);
    }

    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        // export event methods
        on: events.on.bind(events),
        off: events.off.bind(events),
        once: events.once.bind(events),

        // initial method
        connect: connect,
        disconnect: close_connections,

        // request factories
        preauth: Preauth,
        auth: Auth,
        super: Super,
        reader: Reader

    });

})();