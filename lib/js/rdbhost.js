/*

  RdbHost API module, version 2

  Facilitates accessing Rdbhost hosted databases and related services from JavaScript in the browser.

 */

(function (window, undefined) {

    "use strict";

    var events = new EventEmitter(),
        conns = {},
        requestId = 1,
        requestTracker = {},
        partialCache = {},
        HOST, ACCT, PAGE_URL;

    var SOCKET_STATUS = {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
    };

    var EVENT_NAMES = {
        connectionmade: 'connection-opened',
        connectionclosed: 'connection-closed',
        connectionerror: 'connection-error',

        databaseerror: 'database-error',

        notifyreceived: 'notify-received',
        reloadrequest: 'reload-request'
    };


    /* handle_inline_sql - checks

     */
    function handle_inline_sql() {

        return new Promise(function(resolve, reject) {

            var sqlinc = document.getElementById('RDBHOST-SQL-INLINE-ID');
            if ( !sqlinc ) {
                return reject(new Error('no inline sql found'));
            }

            try {
                var body = sqlinc.textContent,
                    jsn = JSON.parse(body);
            }
            catch(e) {
                console.log('handle_inline_sql error '+ e.message);
                return reject(e);
            }

            if ( jsn.status[1] == 'OK' ) {
                return resolve(jsn);
            }

            if ( jsn.error[0] === 'rdb10' ) {

                var q = sqlinc.getAttribute('data-sql'),
                    role = sqlinc.getAttribute('data-role');
                if ( role.substr(0,1) === 'p' ) {

                    var p = Preauth()
                        .query(q)
                        .go();

                    p.then(function(d) {
                            resolve(d);
                        })
                        .catch(function(e) {
                            reject(e);
                        })
                }
            }
            else {
                reject(new Error(jsn.error.join(' ')));
            }
        })
    }

    /* show_form - adds form to document, attaches click handlers that resolve/reject promise

        param formText - body of form, as text
     */
    function show_form(formText, error, sql, notice) {

        // convert formText to dom-element, and read id
        //
        var el = document.createElement('div');
        el.innerHTML = formText;
        var id = el.firstElementChild.attributes['id'].value;

        // if id not in document body, add it
        //
        if ( ! document.getElementById(id) ) {
            document.body.appendChild(el);
        }

        // return promise that resolves when form submitted
        //
        return new Promise(function(resolve, reject) {

            var form = document.getElementById(id);

            function setElement(sel, msg) {
                var el = form.querySelector(sel);
                if (!el) return;

                if (~sel.indexOf('span.')) {
                    el.textContent = msg || '';
                }
                else {
                    el.value = msg || '';
                }
            }
            // clear form
            setElement("span.error", error || '');
            setElement("span.notice", notice || '');
            setElement("span.sql", sql || '');
            setElement("input[name='email']", '');
            setElement("input[name='password']", '');
            setElement("input[name='role']", '');

            /* onSubmit - submit handler for form    */
            function onSubmit(evt) {

                var _f;
                evt.stopPropagation();
                evt.preventDefault();

                var email = (_f = form.querySelector("input[name='email']")) ? _f.value : '',
                    role = (_f = form.querySelector("input[name='role']")) ? _f.value : '',
                    password = (_f = form.querySelector("input[name='password']")) ? _f.value : '';

                if ( ! email.length && ! role.length )
                    setElement("span.error", 'provide an email address');
                else if ( ! password.length )
                    setElement("span.error", 'provide a password');

                else {
                    document.body.removeChild(el);
                    resolve([email || role, password]);
                }
            }

            /* onCancel - cancel-button [x] handler for form    */
            function onCancel(evt) {

                evt.stopPropagation();
                evt.preventDefault();

                document.body.removeChild(el);
                reject(new Error('authorization dialog cancelled'));
            }

            // install event handlers
            form.querySelector("form").addEventListener('submit', onSubmit);
            form.querySelector('.cancel').addEventListener('click', onCancel);

        });
    }

    /* make_roleid - generate 10-digit account-specific role identifier

        @param role - the role (reader, super, preauth, auth)
        @param acct - account number
     */
    function make_roleid(role, acct) {
        var acctStr = '000000000' + acct;
        return role.substr(0,1).toLowerCase() + acctStr.substr(acctStr.length-10,10);
    }

    /* save_authcode - saves an authcode to cache for reuse

        @param key - 'super' or 'preauth' or 'auth'
        @param authcode - the authcode to save
     */
    function save_authcode(key, authcode) {

        var authorizationCache = requestObjectPrototype.authorization_cache;

        function delItems(key) {
            delete authorizationCache[key];
            delete authorizationCache[key+'_to'];
        }

        if (key+'_to' in authorizationCache)
            delItems(key);

        var to = setTimeout(function() {
            delItems(key);
        }, 45*60*1000);

        if (authcode) {
            authorizationCache[key] = authcode;
            authorizationCache[key+'_to'] = to;
        }
        else
            delItems(key);
    }

    /* connect - stores websocket connection information for later use.

        @param host: domain of server (optional)
        @param acct: account number to connect to
     */
    function connect(host, acct) {
        HOST = acct ? host : 'www.rdbhost.com';
        ACCT = acct ? acct : host;
        PAGE_URL = 'http://devdemos.noservercoding.com/rdb2js/lib/'; // todo - update this
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
        conns[role].onopen = function() {
            events.emit(EVENT_NAMES.connectionmade, role, ACCT);
            events.emit(EVENT_NAMES.connectionmade+':'+role, role, ACCT);
        };
        // announce connection-closed, via events
        conns[role].onclose = function() {
            events.emit(EVENT_NAMES.connectionclosed, role, ACCT);
            events.emit(EVENT_NAMES.connectionclosed+':'+role, role, ACCT);
        };
        // announce connection-error, via events
        conns[role].onerror = function() {
            events.emit(EVENT_NAMES.connectionerror, role, ACCT);
            events.emit(EVENT_NAMES.connectionerror+':'+role, role, ACCT);
        };

        // handle message received
        conns[role].onmessage = function(evt) {
            handle_message(role, evt.data);
        };

        return conns[role];
    }

    /* close_connections

        @param code - close code for all connections
        @param reason - close reason for all connections
     */
    function close_connections(code, reason) {
        for (var r in conns) {
            if ( conns.hasOwnProperty(r) ) {
                conns[r].close(code, reason);
                delete conns[r];
            }
        }
        requestObjectPrototype.authorization_cache = {};
    }

    /* handle_message

       @param role - which role-connection received msg
       @param data - payload of message
     */
    function handle_message(role, json) {

        var data = JSON.parse(json),
            reqId = data['request-id'],
            responder = requestTracker[reqId],
            resolve, reject, req;

        if ( reqId && role !== reqId.substr(0,role.length) )
            throw new Error('inconsistency between role ~r and reqId ~i'.replace('~r',role).replace('~i',reqId));

        if ( responder ) {
            resolve = responder[0];
            reject = responder[1];
            req = responder[2];

            if ( data.status[0] === 'error' ) {

                emit_database_error_events(data.error);
                reject(new Error('error ~1 ~2'.replace('~1', data.error[0]).replace('~2', data.error[1])));
            }
            else {

                // apply each result hook to result data, in place
                _.forEach(req.result_hooks, function(f) {
                   f(data);
                });
                // use Promise.resolve here to ensure that resolved value is always a promise
                resolve(Promise.resolve(data));
            }

            // remove resolved or rejected promise from tracker
            delete requestTracker[reqId];
        }

        // handle live-reload content here
        else if ( !reqId ) {

            if ( data.status[0] === 'notify' ) {

                var payload = data.payload,
                    channel = data.channel;

                // handle ftp events by emitting new 'reload-request' event
                if (channel === 'rdbhost_ftp_channel') {

                    events.emit(EVENT_NAMES.reloadrequest, channel, payload);
                    events.emit(EVENT_NAMES.reloadrequest+':'+channel, channel, payload);
                }
                // other events get a 'notify-received' event
                else{

                    events.emit(EVENT_NAMES.notifyreceived, channel, payload);
                    events.emit(EVENT_NAMES.notifyreceived+':'+channel, channel, payload);
                }
            }
        }

        else {

            console.log('Bad message request-id '+reqId);
        }
        // window.console.log(data);
    }


    /* emit_database_error_events - emits a set of events for database errors
        'database-error' for all errors, and 'database-error:<5-digit-code>' for each,
        and finally 'database-error:<2-digit-code-prefix>' for each.
        client can subscribe to all, to specific errors, or to groups by 2-digit prefix.

        @param dError - 2-tuple with error-code and error-text, as delivered by server
     */
    function emit_database_error_events(dError) {

        var errCode = dError[0], errText = dError[1];
        // each database error is published, i) generically, ii) with full 5-digit error,
        //    and iii) with 2-digit error prefix
        events.emit(EVENT_NAMES.databaseerror, errCode, errText);
        events.emit(EVENT_NAMES.databaseerror+':'+errCode, errCode, errText);
        events.emit(EVENT_NAMES.databaseerror+':'+errCode.substr(0,2), errCode, errText);
    }


    /* fix_record_sets - if record set has 'records' element in lieu of 'record_sets' element
         replace 'records' with 'record_sets' with same data.  This is used as result_hook

            @param d - the data from server
     */
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

    /* strip_listen - if request was made with LISTEN sql added, then results will have extra record_sets.
           Those record sets get stripped by this function, so client gets predictable set of record_sets.
           added by listen() method to result_hooks.

        @param d - data from server
     */
    function strip_listen(d) {

        var rs = d.result_sets;
        if ( rs.length < 2 )
            throw new Error('invalid result set collection provided to strip_listen');

        rs.splice(0, 1);
        rs.splice(rs.length-2, 2);
    }

    /* get_authcode_from_user - generic operation for role-specific authcode
         retrieval

        @param tpl_name - name of template to use
        @param error - error string to put in dialog
        @param notice - notice string to put in dialog
     */
    function get_authcode_from_user(role, error, notice) {

        var this_ = this,
            pgPromise = this_._html_partial_getter_ws(role + '_auth');

        return pgPromise.then(function(form) {

                // append form to body and show it.
                //  returns a promise, resolved by form submission, or rejected by cancel
                return show_form(form, error, notice);

            })
            .catch(function(e) {
                throw e;
            })
            .then(function(eml_pass) {

                // get authcode using email and password
                var email = eml_pass[0], password = eml_pass[1];
                var pr_gs = role === 'auth' ? get_auth_authcode(acct_number, role, password)
                                            : get_super_authcode(acct_number, email, password);

                return pr_gs.catch(function(e) {

                    if ( e.message.substr(0,11) === 'bad input. ' )
                        return get_authcode_from_user.call(this_, role, 'fix input', notice);
                    if ( e.message.substr(0,11) === 'bad email/p' )
                        return get_authcode_from_user.call(this_, role, 'bad email/pass combo', notice);

                    throw e;
                })
            });
    }

    /* get_superauth_from_user - two step authorization involving showing form to user
     and getting email address and password, then submitting those to server for authcode.

         @param error -  string with error message
         @param notice - notice to add to dialog
     */
    var get_superauth_from_user = function(error, notice) {
        return get_authcode_from_user.call(this, 'super', error, notice);
    };

    /* get_preauthorization_from_user - two step authorization involving showing form to user
    and getting email address and password, then submitting those to server for authcode.

        @param error -  string with error message
        @param notice - notice to add to dialog
    */
    var get_preauthorization_from_user = function(error, notice) {
        return get_authcode_from_user.call(this, 'preauth', error, notice);
    };

    /* get_auth_authcode_from_user - two step authorization involving showing form to user
     and getting role and password, then submitting those to server for authcode.

         @param error -  string with error message
         @param notice - notice to add to dialog
     */
    var get_auth_authcode_from_user = function(error, notice) {
        return get_authcode_from_user.call(this, 'auth', error, notice);
    };


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
        formData: undefined,

        reqId: undefined,
        role: undefined,
*/
        authorization_cache: {},

        // connection for this request
        conn: undefined,

        /* init function to setup connection and other request

            @param role - name of role 'reader', etc..
            @param authcode - authcode for role (optional)
          */
        init: function(role) {

            if ( ['preauth', 'auth', 'reader', 'super'].indexOf(role) < 0 )
                throw new Error('invalid role '+role+' provided to init');

            this.role = role;
            this.reqId = role + (requestId++);

            this.conn = conns[role] || make_connection(role);
            this.result_hooks = [fix_record_sets];

            return this;
        },

        /* proxy sets mode of request

            @param mode - mode of request ('email', 'credit', 'proxy')
         */
        proxy: function(mode) {
            this.mode = mode;
            return this;
        },

        /* query - sets sql query of request

            @param q - query string
         */
        query: function(q) {
            this.q = q;
            return this;
        },

        /* params - sets params value

            @param params - parameter set to store.  can be an object or an array and can be
                called once with each.
         */
        params: function(params) {
            if (typeof params !== 'object')
                throw new Error('params must be object or array');
            if (typeof params.length === 'number')
                this.args = params;
            else
                this.namedParams = params;

            return this;
        },

        /* form_data - sets formData on request.  cannot be used on same request as params method.

            @param formData - formData object
         */
        form_data: function(formData) {

            if ( this.hasOwnProperty('args') && this.args.length > 0 ||
                 this.hasOwnProperty('namedParams') && Object.keys(this.namedParams).length > 0 )
                throw new Error('formData cannot be combined with params in same request.');

            this.formData = formData;

            return this;
        },

        /* listen - adds LISTEN/NOTIFY code to query, so that any notifies emitted by sql on given
               channel will be captured by server and sent to all connected clients.

            @param channel - name of channel to listen to
         */
        listen: function(channel) {

            if ( channel.indexOf('"') > -1 )
                throw new Error('channel name cannot include quotes');

            var q = ['LISTEN "~1"'.replace('~1', channel),
                     this.q,
                     'COMMIT; BEGIN;' ];
            this.q = q.join(';\n');

            // Listen code adds some empty record sets to the result data,
            //   so add a result_hook to strip them back off
            this.result_hooks.push(strip_listen);

            return this;
        },

        /* repeat - adds repeat paramter to request.

            @param repCt - number of repetitions required
         */
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

        _raw_data_getter_http: function(url_formdata) {

            var this_ = this,
                url = url_formdata[0],
                formData = url_formdata[1];

            // client does not want response headers, just body
            //   so we keep the initial fetch promise, and resolve
            //   with the body (json) promise.
            return new Promise(function(resolve, reject) {

                // resolve and reject here provide 2nd promise (p) results
                //   to first promise `then`s
                var p = fetch(url, {method: 'post', body: formData});
                p.then(function(resp) {

                        if ( ! resp.ok ) {
                            reject(new Error('Status: '+resp.status+' '+resp.statusText));
                        }
                        else {
                            var jsonPromise = resp.json();
                            jsonPromise.then(function(data) {

                                if ( data.status[0] === 'error' ) {

                                    // emit events regarding database errors
                                    emit_database_error_events(data.error);

                                    reject(new Error('error ~1 ~2'.replace('~1', data.error[0]).replace('~2', data.error[1])));
                                }
                                else {

                                    // apply each result hook to result data
                                    //
                                    _.forEach(this_.result_hooks, function(f) {
                                        f(data);
                                    });
                                    resolve(data);
                                }

                            })
                        }
                    })
                    .catch(function(e) {

                        // reject with connection error
                        reject(e);
                    })
            })
        },

        _prepare_formdata: function () {

            var formData = this.formData;

            formData.append('q', this.q);
            if ( this.hasOwnProperty('repeatCt') )
                formData.append('repeat', this.repeatCt);
            if ( this.hasOwnProperty('mode') )
                formData.append('mode', this.mode);
            if (this.role === 'super' && this.authorization_cache['super'])
                formData.append('authcode', this.authorization_cache['super']);
            if (this.role === 'preauth' && this.authorization_cache['preauth'])
                formData.append('super-authcode', this.authorization_cache['preauth']);
            formData.append('format', 'json-easy');

            var roleid = make_roleid(this.role, ACCT),
                url = 'https://'+HOST+'/db/'+roleid;

            return [url, formData];
        },

        _html_partial_getter_ws: function(name) {

            if ( name in partialCache )
                return Promise.resolve(partialCache[name]);

            var url = PAGE_URL+name+'.tpl.html';
            var p = fetch(url);

            return p.then(function(r) {
                    if ( !r.ok )
                        throw new Error('page ~p not found.'.replace('~p', url));
                    var p1 = r.text();
                    return p1.then(function(body) {
                        partialCache[name] = body;
                        return partialCache[name];
                    })
                },
                function(e) {
                    throw e;
                });
        },

        _raw_data_getter_ws: function (json) {

            var this_ = this;

            function get(json) {

                // returns promise, and track promise by
                return new Promise(function(resolve, reject) {

                    // send the request to the server
                    this_.conn.send(json);

                    // add promise handlers to tracker, for use by socket message-handler
                    requestTracker[this_.reqId] = [resolve, reject, this_];
                });

            }

            // if socket ready to go
            if ( conns[this_.role] && conns[this_.role].readyState === SOCKET_STATUS.OPEN ) {

                return get(json);
            }
            // else wait for socket to become ready
            else {

                return new Promise(function(resolve, reject) {

                    events.once(EVENT_NAMES.connectionmade+':'+this_.role, function() {

                        resolve(get(json));
                    });
                });
            }
        },

        _prepare_json: function() {

            // assemble data to send to server
            var d = {
                q: this.q,
                args: this.args,
                namedParams: this.namedParams,
                'request-id': this.reqId
            };
            if (this.hasOwnProperty('repeatCt'))
                d.repeat = this.repeatCt;
            if (this.hasOwnProperty('mode'))
                d.mode = this.mode;
            if (this.role === 'super')
                d.authcode = this.authorization_cache['super'];
            else if (this.role === 'preauth') {

                d['super-authcode'] = this.authorization_cache['preauth'];
                d['authcode'] = '-';
            }
            else if (this.role === 'auth') {

                d['super-authcode'] = this.authorization_cache['preauth'];
                d['authcode'] = this.authorization_cache['auth'];
            }

            // convert data to json format
            return JSON.stringify(d);
        },


        /* go - sends request to server, returns promise to be resolved with received data

            @returns promise
         */
        go: function() {

            if ( !this.q ) throw new Error('no query was provided');

            // test for formData element, and use go_http if found,
            if ( this.formData ) {

                return this._go_https();
            }

            // else use _go_websocket
            return this._go_websocket();
        },

        /* copy - return copy of request object

         */
        copy: function() {

            return _.clone(this_);
        }

    };


    /* get_super_authcode - logs in to server, gets authcodes, provides super-authcode to caller
          via promise.

        @param acctnum - numeric or string account number
        @param email - email address for account
        @param passwd - password provided by user
     */
    function get_super_authcode(acctnum, email, passwd) {

        var url = 'https://' + HOST + '/acct/login/0' + make_roleid('reader', acctnum).substr(1),
            formData = new FormData();

        formData.append('arg:email', email);
        formData.append('arg:password', passwd);

        var p = fetch(url, {method: 'post', body: formData} );
        return p.then(function(resp) {
                return resp.json().then(function(d) {

                    if ( d.error )
                        throw new Error(d.error[1]);

                    for ( var i in d.records.rows ) {
                        var row = d.records.rows[i];
                        if ( row.role.substr(0,1) === 's' )
                            return row;

                    }
                    throw new Error('super not found in login records');
                })
            });
    }

    /* get_auth_authcode - logs in to server using an auth-role and auth-role password,
     provides authcode-authcode to caller via promise.

     @param acctnum - numeric or string account number
     @param role - role address for account
     @param passwd - password provided by user
     */
    function get_auth_authcode(acctnum, role, passwd) {

        var roleid = make_roleid('auth', acctnum),
            url = 'https://' + HOST + '/acct/authlogin/0' + roleid.substr(1),
            formData = new FormData();

        formData.append('arg:role', roleid);
        formData.append('arg:password', passwd);

        var p = fetch(url, {method: 'post', body: formData} );
        return p.then(function(resp) {
            return resp.json().then(function(d) {

                if ( d.error )
                    throw new Error(d.error[1]);

                for ( var i in d.records.rows ) {
                    var row = d.records.rows[i];
                    if ( row.role.substr(0,1) === 'a' )
                        return row;

                }
                throw new Error('auth not found in login records');
            })
        });
    }


    /* go_super - function that runs query as super, getting authcode interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    function go_super(raw_getter, req_preparer) {

        var this_ = this,
            reqData = req_preparer.call(this_),
            p = raw_getter.call(this_, reqData);

        return p.catch(function(e) {

                if ( e.message.substr(0, 11) === 'error rdb12' ) {

                    return get_superauth_from_user.call(this_)
                            .then(function(d) {

                                    // add authcode to request, and
                                    save_authcode('super', d.authcode);

                                    // try raw_data_getter again
                                    var reqData = req_preparer.call(this_);
                                    return raw_getter.call(this_, reqData);
                                });
                }
                else {
                    throw e;
                }
            })
    }


    /* go_reader - function that runs query as reader
     should be bound to a request object first, with raw_getter req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    function go_reader(raw_getter, req_preparer) {
        var reqData = req_preparer.call(this);
        return raw_getter.call(this, reqData);
    }

    /* go_preauth - function that runs query as preauth, getting super-authcode interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    function go_preauth(raw_getter, req_preparer) {

        var this_ = this,
            reqData = req_preparer.call(this_),
            p = raw_getter.call(this_, reqData);

        return p.catch(function(e) {

                if ( e.message.substr(0, 11) === 'error rdb10' ) {

                    return get_preauthorization_from_user.call(this_, '')
                        .then(function(d) {

                            // add authcode to request, and
                            save_authcode('preauth', d.authcode);

                            // try raw_data_getter again
                            var reqData = req_preparer.call(this_);
                            return raw_getter.call(this_, reqData);
                        });
                }
                else {
                    throw e;
                }
            })
    }


    /* go_auth - function that runs query as auth role, getting super-authcode and auth-authcodes
             interactively as necessary
              should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    function go_auth(raw_getter, req_preparer) {

        var this_ = this,
            reqData = req_preparer.call(this_),
            p = raw_getter.call(this_, reqData);

        return p.catch(function(e) {

            if ( e.message.substr(0, 11) === 'error rdb12' ) {

                return get_auth_authcode_from_user.call(this_)
                    .then(function(d) {

                        // add authcode to request, and
                        save_authcode('auth', d.authcode);

                        // try raw_data_getter again
                        var reqData = req_preparer.call(this_);
                        return raw_getter.call(this_, reqData);
                    })
                    .catch(function(e) {

                        if ( e.message.substr(0, 11) === 'error rdb10' ) {

                            return get_preauthorization_from_user.call(this_, '')
                                .then(function(d) {

                                    // add authcode to request, and
                                    save_authcode('preauth', d.authcode);

                                    // try raw_data_getter again
                                    var reqData = req_preparer.call(this_);
                                    return raw_getter.call(this_, reqData);
                                });
                        }
                        else
                            throw e;
                    })
            }
            else
                throw e;
        })
    }


    /* ===================================================

      these factory functions create request objects for specific roles

     */
    function Preauth() {
        var req = Object.create(requestObjectPrototype);
        req._go_websocket = go_preauth.bind(req, req._raw_data_getter_ws, req._prepare_json);
        req._go_https = go_preauth.bind(req, req._raw_data_getter_http, req._prepare_formdata);
        return req.init('preauth');
    }

    function Auth(authcode) {
        // if ( !password ) throw new Error('provide password for auth role');
        var req = Object.create(requestObjectPrototype);
        req._go_websocket = go_auth.bind(req, req._raw_data_getter_ws, req._prepare_json);
        req._go_https = go_auth.bind(req, req._raw_data_getter_http, req._prepare_formdata);
        if ( authcode )
            save_authcode('auth', authcode);
        return req.init('auth');
    }

    function Super(authcode) {
        // if ( !authcode ) throw new Error('provide authCode for super role');
        var req = Object.create(requestObjectPrototype);
        req._go_websocket = go_super.bind(req, req._raw_data_getter_ws, req._prepare_json);
        req._go_https = go_super.bind(req, req._raw_data_getter_http, req._prepare_formdata);
        if ( authcode )
            save_authcode('super', authcode);
        return req.init('super');
    }

    function Reader() {
        var req = Object.create(requestObjectPrototype);
        req._go_websocket = go_reader.bind(req, req._raw_data_getter_ws, req._prepare_json);
        req._go_https = go_reader.bind(req, req._raw_data_getter_http, req._prepare_formdata);
        return req.init('reader');
    }


    // export Rdbhost object with necessary methods
    //
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
        reader: Reader,

        // inline-sql handler
        inline_sql: handle_inline_sql
    });

})(window);