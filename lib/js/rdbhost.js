/*

 RdbHost API module, version 2

 Facilitates accessing Rdbhost hosted databases and related services from JavaScript in the browser.

 */


(function (window, undefined) {

    "use strict";

    var __version__ = 'latest';

    var DEBUG_SOCKET = true;

    var events = new TinyEmitter,
        conns = {},
        requestId = 1,
        requestTracker = {},
        partialCache = {},
        credentialsCache = {},
        dialogDisplayed = false,
        loader = function(nm, f) { throw new Error('no loader defined'); },
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
        connectionopenfail: 'connection-open-failed',

        databaseerror: 'database-error',
        databaseusererror: 'database-user-error',

        notifyreceived: 'notify-received',
        reloadrequest: 'reload-request',

        formdisplayed: 'form-displayed',
        formcleared: 'form-cleared'
    };


    /* handle_inline_sql - checks for data inline in page, handles it

       @returns - promise that resolves with data, or rejected with error
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


    /* use_labjs_loader - creates loader function that uses LABJS

      @param $L - LAB.JS object
     */
    function use_labjs_loader($L) {
        loader = function(nm, f) {
            $L.script(nm).wait(function() {
                f();
            })
        }
    }


    /* _setElement - sets form element to given value

     @param form - the form
     @param sel - text selector to id part
     @param msg - text to put in id

     should be bound to (null , form) to create function
     */
    function _setElement(form, sel, msg) {
        var el = form.querySelector(sel);
        if (!el) return;

        if (~sel.indexOf('span.')) {
            el.textContent = msg || '';
        }
        else {
            el.value = msg || '';
        }
    }

    /* populate_form - puts data in form for display

     @param form - the form
     @param kws - object containing { 'error' phrase, or undefined or '',
                                      'notice' subtitle for dialog box,
                                      'sql' the sql to approve for execution or white-listing,
                                      'email' the user's email address,
                                      'role' the user's role }
     */
    function populate_form(form, kws) {

        var error = kws['error'], notice = kws['notice'], sql = kws['sql'],
            email = kws['email'], role = kws['role'];

        var setElement = _setElement.bind(null, form);
        // clear form
        setElement("span.error", error || '');
        setElement("span.notice", notice || '');
        setElement("span.sql", sql || '');
        setElement("input[name='password']", '');
        setElement("input[name='role']", role || '');
        setElement("input[name='email']", email || '');
    }

    /* on_authorize_submit - submit button handler for dialogs
     that provide role or email and password

     @param form - the form
     @param resolve - the Promise's resolve function
     */
    function on_authorize_submit(form, resolve) {

        var _f,
            setElement = _setElement.bind(null, form),
            email = (_f = form.querySelector("input[name='email']")) ? _f.value : '',
            role = (_f = form.querySelector("input[name='role']")) ? _f.value : '',
            password = (_f = form.querySelector("input[name='password']")) ? _f.value : '';

        if ( ! email.length && ! role.length ) {

            setElement("span.error", 'provide an email address');
            return false;
        }
        else if ( ! password.length ) {

            setElement("span.error", 'provide a password');
            return false;
        }
        else {

            if ( email )
                credentialsCache['email'] = email;
            if ( role )
                credentialsCache['role'] = role;
            resolve([email || role, password]);

            return true;
        }
    }

    /* on_confirm_submit - submit button handler for submit button on confirm dialog

     @param form - the form (optional)
     @param resolve - the Promise's resolve function

     @returns - true if success, false otherwise.  can change form in response to input
         validation.   on returning false, form will be redisplayed

     cancelled dialogs do not invoke this function
     */
    function on_confirm_submit(form, resolve) {
        resolve();
        return true;
    }

    /* show_form - adds form to document, attaches click handlers that resolve/reject promise

     @param onSubmit - function that handles data from form  -> signature onSubmit(form, resolve)
          onSubmit returns - true if success, false otherwise.  can change form in response to
          input validation.  on returning false, form will be redisplayed

     @param formText - body of form, as text
     @param populate_form - function that populates form before display  -> signature populate_form(form, parms)
     @param parms - object { 'error' text, 'sql' text of query to approve, 'notice' text for dialog subtitle }
     */
    function show_form(onSubmit, formText, populate_form, parms) {

        // grab individual elements from parms hash
        var error = parms['error'], sql = parms['sql'], notice=parms['notice'];

        // if the form has already been displayed, (by a different caller, presumably),
        //   then return a promise that waits for that form to clear, then shows this form.
        if ( dialogDisplayed ) {
            return new Promise(function(resolve, revoke) {

                events.once(EVENT_NAMES.formcleared, function() {
                    resolve(show_form(onSubmit, formText, populate_form,
                                      {'error': error, 'sql': sql, 'notice': notice}));
                })
            })
        }

        // convert formText to dom-element, and read id
        //
        var el = document.createElement('div');
        el.innerHTML = formText;
        var id = el.firstElementChild.attributes['id'].value;
        var elCss = el.getElementsByTagName('style')[0];
        elCss.parentNode.removeChild(elCss);

        // modal_force - handler that stops clicks outside dialog
        //
        function modal_force(evt) {

            if (!el.contains(evt.target)) {
                evt.stopImmediatePropagation();
                evt.stopPropagation();
                evt.preventDefault();

                return false;
            }
            return true;
        }

        // add element to document body
        //
        if (document.getElementById(id))
            throw new Error('Element ~i in dom already'.replace('~i', id));
        document.body.appendChild(el);
        document.head.appendChild(elCss);
        dialogDisplayed = true;

        // emit event that form has been displayed
        events.emit(EVENT_NAMES.formdisplayed, [notice]);

        document.body.addEventListener('click', modal_force, true);

        // return promise that resolves when form submitted
        //
        return new Promise(function(resolve, reject) {

            var form = document.getElementById(id);

            populate_form(form, {'error': error, 'notice': notice, 'sql': sql,
                                 'email': credentialsCache['email'],
                                 'role': credentialsCache['role']});

            /* _onSubmit - submit handler for form    */
            function _onSubmit(evt) {

                evt.stopPropagation();
                evt.preventDefault();

                if ( onSubmit(form, resolve) ) {

                    document.body.removeChild(el);
                    document.head.removeChild(elCss);
                    document.body.removeEventListener('click', modal_force, true);

                    dialogDisplayed = false;
                    events.emit(EVENT_NAMES.formcleared, notice);
                }
            }

            /* onCancel - cancel-button [x] handler for form    */
            function onCancel(evt) {

                evt.stopPropagation();
                evt.preventDefault();

                document.body.removeChild(el);
                document.head.removeChild(elCss);
                document.body.removeEventListener('click', modal_force, true);

                dialogDisplayed = false;
                events.emit(EVENT_NAMES.formcleared, notice);

                reject(new Error('authorization dialog cancelled'));
            }

            // install event handlers
            form.querySelector("form").addEventListener('submit', _onSubmit);
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

     @param host - domain of server (optional)
     @param acct - account number to connect to
     @param template_path - url-stem for templates (optional)
     */
    function connect(host, acct, template_path) {
        var acctGood = acct && _.isNumber(acct);
        HOST = acctGood ? host : 'www.rdbhost.com';
        ACCT = acctGood ? acct : host;
        PAGE_URL = (acctGood ? template_path : acct) || 'https://'+HOST+'/vendor/rdbhost/'+Rdbhost.version+'/lib/partials/';
    }

    /* make_connection - makes new web-socket connection to server, using given role

     @param role - "super", "auth", "preauth" or "role"
     */
    function make_connection(role) {

        if ( !ACCT ) throw new Error('account not set with connect method');
        if ( conns[role] ) throw new Error('connection already established for '+role);

        var roleid = make_roleid(role, ACCT),
            firstConnOpenedOK = false;

        conns[role] =  new ReconnectingWebSocket('wss://'+HOST+'/wsdb/'+roleid, null, {debug: DEBUG_SOCKET});

        // announce connection-complete, via events
        conns[role].onopen = function() {
            firstConnOpenedOK = true;
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
            if (firstConnOpenedOK) {
                events.emit(EVENT_NAMES.connectionerror, role, ACCT);
                events.emit(EVENT_NAMES.connectionerror+':'+role, role, ACCT);
            }
            else {
                events.emit(EVENT_NAMES.connectionopenfail, role, ACCT);
            }
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

        // clean up caches - useful for testing purposes
        requestObjectPrototype.authorization_cache = {};
        partialCache = {};
        credentialsCache = {};
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
                reject(new Error('~1 ~2'.replace('~1', data.error[0]).replace('~2', data.error[1])));
            }
            else {

                // apply each result hook to result data, in place
                _.each(req.result_hooks, function(f) {
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
                if (channel.substr(0,19) === 'rdbhost_ftp_channel') {

                    events.emit(EVENT_NAMES.reloadrequest, channel, payload);
                    events.emit(EVENT_NAMES.reloadrequest+':'+channel, channel, payload);
                }
                // other events get a 'notify-received' event
                else{

                    events.emit(EVENT_NAMES.notifyreceived, channel, payload);
                    events.emit(EVENT_NAMES.notifyreceived+':'+channel, channel, payload);
                }
            }
            else if ( data.status[0] === 'keep-alive' ) {

                console.log('keep-alive received')
            }
        }

        else {

            console.log('Bad message request-id '+reqId);
        }
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

    /* emit_user_db_error_events - emits a set of events for database errors that are
      not handled by rdbhost.js module.

     'database-user-error' for all errors, and 'database-user-error:<5-digit-code>' for each,
     and finally 'database-user-error:<2-digit-code-prefix>' for each.
     client can subscribe to all, to specific errors, or to groups by 2-digit prefix.

     @param dError - 2-tuple with error-code and error-text, as delivered by server
     */
    function emit_user_db_error_events(dError) {
        var errCode = dError[0], errText = dError[1];
        // each database error is published, i) generically, ii) with full 5-digit error,
        //    and iii) with 2-digit error prefix
        events.emit(EVENT_NAMES.databaseusererror, errCode, errText);
        events.emit(EVENT_NAMES.databaseusererror+':'+errCode, errCode, errText);
        events.emit(EVENT_NAMES.databaseusererror+':'+errCode.substr(0,2), errCode, errText);
    }

    /* fix_record_sets - if record set has 'records' element in lieu of 'record_sets' element
     replace 'records' with 'record_sets' with same data.  This is used as result_hook

     @param data - the data from server
     */
    function fix_record_sets(data) {

        // if data already has record_sets, return
        if ( data.result_sets )
            return;
        if ( !data.records )
            return;

        var recs = data.records;
        data.result_sets = [recs];
        delete data.records;
    }

    /* strip_listen - if request was made with LISTEN sql added, then results will have extra record_sets.
     Those record sets get stripped by this function, so client gets predictable set of record_sets.
     added by listen() method to result_hooks.

     @param data - data from server
     */
    function strip_listen(data) {

        var rs = data.result_sets;
        if ( rs.length < 2 )
            throw new Error('invalid result set collection provided to strip_listen');

        rs.splice(0, 1);
        rs.splice(rs.length-2, 2);
    }

    /* show_named_form - gets form from server, adds it to document, attaches click handlers that resolve/reject promise

     @param form - name of form
     @param onSubmit - function that handles data from form  -> signature onSubmit(form, resolve)
     @param popForm - function that populates form
     @param error - error text
     @param sql - text of query to approve
     @param notice - text for dialog subtitle
     */
    function show_named_form(formName, onSubmit, popForm, kws){

        // var error = kws['error'], sql=kws['sql'], notice=kws['notice'];
        var pgPromise = html_partial_getter_ws(formName);

        return pgPromise.then(function(form) {

            // append form to body and show it.
            //  returns a promise, resolved by form submission, or rejected by cancel
            return show_form(onSubmit, form, popForm, kws);
        })
    }

    /* get_authcode_from_user - generic operation for role-specific authcode
     retrieval

     @param tpl_name - name of template to use
     @param error - error string to put in dialog
     @param notice - notice string to put in dialog
     */
    function get_authcode_from_user(role, error, sql, notice) {

        var this_ = this,
            pgPromise = html_partial_getter_ws(role + '_auth');

        return pgPromise.then(function(form) {

                // append form to body and show it.
                //  returns a promise, resolved by form submission, or rejected by cancel
                return show_form(on_authorize_submit, form, populate_form, {'error': error, 'sql': sql, 'notice': notice});
            })
            .catch(function(e) {
                throw e;
            })
            .then(function(eml_pass) {

                // get authcode using email and password
                var email = eml_pass[0], password = eml_pass[1];
                var pr_gs = role === 'auth' ? get_authrole_authcode(acct_number, role, password)
                    : get_superrole_authcode(acct_number, email, password);

                return pr_gs.catch(function(e) {

                    if ( e.message.substr(0,11) === 'bad input. ' )
                        return get_authcode_from_user.call(this_, role, 'fix input', sql, notice);
                    if ( e.message.substr(0,11) === 'bad email/p' )
                        return get_authcode_from_user.call(this_, role, 'bad email/pass combo', sql, notice);

                    throw e;
                })
            });
    }

    /* get_superauth_from_user - two step authorization involving showing form to user
     and getting email address and password, then submitting those to server for authcode.

     @param error -  string with error message
     @param notice - notice to add to dialog
     */
    var get_superauth_from_user = function(sql, notice) {
        return get_authcode_from_user.call(this, 'super', '', sql, notice);
    };

    /* get_preauthorization_from_user - two step authorization involving showing form to user
     and getting email address and password, then submitting those to server for authcode.

     @param error -  string with error message
     @param notice - notice to add to dialog
     */
    var get_preauthorization_from_user = function(sql, notice) {
        return get_authcode_from_user.call(this, 'preauth', '', sql, notice);
    };

    /* get_auth_authcode_from_user - two step authorization involving showing form to user
     and getting role and password, then submitting those to server for authcode.

     @param error -  string with error message
     @param notice - notice to add to dialog
     */
    var get_auth_authcode_from_user = function(sql, notice) {
        return get_authcode_from_user.call(this, 'auth', '', sql, notice);
    };


    /* run_request_hooks - runs request hooks on request object.
     must be provided request as `this`

     */
    function run_request_hooks() {

        // get position of 'listen' request hooks, use to check listen against repeat
        var lsnPos = _.findIndex(this.request_hooks, function(f) { return f.label === 'listen'; });
        if ( lsnPos >= 0 && this.repeatCt && this.repeatCt > 1 ) {
            throw new Error('listen and repeat cannot be used on same request');
        }

        // apply each request hook to result data
        var this_ = this;
        _.each( this.request_hooks, function(f) {
            f(this_);
        });
    }

    /* prepare_formData - processes request data into a FormData object.
     must be bound to a request to work

     @returns - 2-tupe [url, formData]
     */
    function prepare_formdata() {

        run_request_hooks.call(this);

        var formData = this.formData;

        formData.append('q', this.qPlus || this.q);
        delete this.qPlus;
        if (this.hasOwnProperty('repeatCt'))
            formData.append('repeat', this.repeatCt);
        if (this.hasOwnProperty('mode'))
            formData.append('mode', this.mode);
        if (this.role === 'super' && this.authorization_cache['super'])
            formData.append('authcode', this.authorization_cache['super']);
        if (this.role === 'preauth' && this.authorization_cache['preauth'])
            formData.append('super-authcode', this.authorization_cache['preauth']);
        if (this.role === 'auth' && this.authorization_cache['preauth']) {
            formData.append('super-authcode', this.authorization_cache['preauth']);
            formData.append('authcode', this.authorization_cache['auth']);
        }
        formData.append('format', 'json-easy');

        var roleid = make_roleid(this.role, ACCT),
            url = 'https://'+HOST+'/db/'+roleid;

        return [url, formData];
    }

    /* prepare_json - processes request data into json string.
     must be bound to a request to work

     @returns - json string
     */
    function prepare_json() {

        run_request_hooks.call(this);

        // assemble data to send to server
        var d = {
            q: this.qPlus || this.q ,
            args: this.args,
            namedParams: this.namedParams,
            'request-id': this.reqId
        };
        delete this.qPlus;
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
    }

    /* have_authcodes_for_role - does request have its necessary authcodes?

     */
    function have_authcodes_for_role() {

        if (this.role === 'super')
            return !! this.authorization_cache['super'];
        if (this.role === 'preauth')
            return !! this.authorization_cache['preauth'];
        if (this.role === 'auth')
            return !! (this.authorization_cache['preauth'] && this.authorization_cache['auth']);

        return false;
    }

    /* html_partial_getter_ws - retrieves raw html files from server, caching same

     @param name - stub-name of template file to retrieve
     */
    function html_partial_getter_ws(name) {

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
    }

    /* raw_data_getter_http - takes request as url & FormData object, uses it
     to make 'fetch' request to server, and returns a promise that
     resolves with the data eventually returned.

     @param data_extractor - function that returns 2-tuple (url, formData)
     */
    function raw_data_getter_http(data_extractor) {

        var this_ = this;

        // client does not want response headers, just body
        //   so we keep the initial fetch promise, and resolve
        //   with the body (json) promise.
        return new Promise(function(resolve, reject) {

            var url_formdata = data_extractor.call(this_),
                url = url_formdata[0],
                formData = url_formdata[1];

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

                                reject(new Error('~1 ~2'.replace('~1', data.error[0])
                                                        .replace('~2', data.error[1])));
                            }
                            else {

                                // apply each result hook to result data
                                //
                                _.each(this_.result_hooks, function(f) {
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
    }

    /* raw_data_getter_ws - takes request in json form, sends it over the websocket,
     registers response handler to process the response when it arrives, and
     returns a promise that resolves with the data eventually returned.

     @param json - json string with complete request
     */
    function raw_data_getter_ws(data_getter) {

        var this_ = this;

        function get() {

            var json = data_getter.call(this_);

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

            return get();
        }
        // else wait for socket to become ready
        else {

            return new Promise(function(resolve, reject) {

                events.once(EVENT_NAMES.connectionmade+':'+this_.role, function() {

                    resolve(get());
                });
            });
        }
    }

    /* go - sends request to server, returns promise to be resolved with received data
     will be bound, with both parameters curried, so callable will be no-params

     @returns promise
     */
    function go(https_go, ws_go) {

        var this_ = this;

        function _go() {

            if ( !this_.q ) throw new Error('no query was provided');
            if ( this_.isDone ) throw new Error('request has already been run. use clone to rerun it.');

            // test for formData element, and use go_http if found,
            if ( this_.formData ) {

                return https_go.call(this_);
            }

            // else use _go_websocket
            return ws_go.call(this_);
        }

        if (Rdbhost.paranoidConfirm && have_authcodes_for_role.call(this)) {

            var pgPromise = html_partial_getter_ws(this_.role + '_confirm');

            return pgPromise.then(function(form) {

                    // append form to body and show it.
                    //  returns a promise, resolved by form submission, or rejected by cancel
                    return show_form(on_confirm_submit, form, populate_form,
                                     {'error': '', 'sql': this_.q, 'notice': ''});
                })
                .catch(function(e) {
                    throw e;
                })
                .then(function() {
                    return _go();
                })
        }
        else {

            return _go()
        }
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
         formData: undefined,

         reqId: undefined,
         role: undefined,
         */
        authorization_cache: {},

        // connection for this request
        conn: undefined,

        /* init function to setup connection and other request

         @param role - name of role 'reader', etc..
         @returns - this, suitable for chaining
         */
        init: function(role) {

            if ( ['preauth', 'auth', 'reader', 'super'].indexOf(role) < 0 )
                throw new Error('invalid role '+role+' provided to init');

            this.role = role;
            this.reqId = role + (requestId++);
            this.isDone = false;

            this.conn = conns[role] || make_connection(role);
            this.result_hooks = [fix_record_sets];
            this.request_hooks = [];

            return this;
        },

        /* proxy sets mode of request

         @param mode - mode of request ('email', 'credit', 'proxy')
         @returns - this, suitable for chaining
         */
        proxy: function(mode) {
            this.mode = mode;
            return this;
        },

        /* query - sets sql query of request

         @param q - query string
         @returns - this, suitable for chaining
         */
        query: function(q) {
            this.q = q;
            return this;
        },

        /* params - sets params value

         @param params0 - parameter set to store.  can be an object or an array
         @param params1 - parameter set to store.
               params0 and params1 can be one of each type (object and array)
         @returns - this, suitable for chaining
         */
        params: function(params0, params1) {

            delete this.args;
            delete this.namedParams;

            if ( !params0 && !params1 )
                return this;

            if ( typeof params0 !== 'object' )
                throw new Error('params must be object or array');
            if ( params1 && typeof params1 !== 'object' )
                throw new Error('params must be object or array');
            if ( this.formData )
                throw new Error('params and FormData cannot be used both in one request');

            if ( typeof params0.length === 'number' )
                this.args = params0;
            else
                this.namedParams = params0;

            if ( params1 ) {

                if ( typeof params1.length === 'number' ) {
                    if ('args' in this)
                        throw new Error('two arrays were provided to params');
                    this.args = params1;
                }
                else {
                    if ('namedParams' in this)
                        throw new Error('two objects were provided to params');
                    this.namedParams = params1;
                }
            }
            return this;
        },

        /* form_data - sets formData on request.  cannot be used on same request as params method.

         @param formData - formData object
         @returns - this, suitable for chaining
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
         @returns - this, suitable for chaining
         */
        listen: function(channel) {

            if ( channel.indexOf('"') > -1 )
                throw new Error('channel name cannot include quotes');

            var f = function(this_) {

                var q0 = this_.qPlus || this_.q;
                var qParts = ['LISTEN "~1"'.replace('~1', channel),
                               q0,
                               'COMMIT; BEGIN;' ];
                this_.qPlus = qParts.join(';\n');
            };
            f.label = 'listen';

            // Add this function to request-hooks, to be applied just
            //  before sending to server
            this.request_hooks.push(f);

            // Listen code adds some empty record sets to the result data,
            //   so add a result_hook to strip them back off
            this.result_hooks.push(strip_listen);

            return this;
        },

        /* repeat - adds repeat paramter to request.

         @param repCt - number of repetitions required
         @returns - this, suitable for chaining
         */
        repeat: function(repCt) {

            try {
                repCt = Number(repCt);
            }
            catch (e) {
                throw new Error('provide number value to repeat method.');
            }
            this.repeatCt = 1;
            if ( repCt > 1 )
                this.repeatCt = repCt;
            return this;
        },

        get_data:  function() {

            return this.go().catch(function(e) {

                var _splitPt = e.message.indexOf(' '),
                    splitPt = _splitPt >= 0 ? _splitPt : e.message.length,
                    errCode = e.message.substr(0, splitPt), errMsg = e.message.substr(splitPt+1);

                emit_user_db_error_events([errCode, errMsg]);

                throw e;
            })
        },

        /* clone - return copy of request object

         @returns - copy of request object, with different request-id
         */
        clone: function() {

            var c = Rdbhost[this.role]();
            for (var k in this) {
                if ( !this.hasOwnProperty(k)
                    || ['reqId', 'conn', 'role', 'isDone', 'qPlus'].indexOf(k) >= 0
                    || ( typeof this[k] === 'function' ) )
                    continue;

                if ( _.isArray(this[k]) )
                    c[k] = this[k].slice(0);
                else if ( _.isObject(this[k] ) )
                    c[k] = _.extend({}, this[k]);
                else
                    c[k] = this[k];
            }
            return c;
        }
    };


    /* extendRequestObjectPrototype
     *
     *  extends requestObjectPrototype by adding methods/attributes from ext
     *
     *  @param ext - object containing attributes/methods to add
     */
    function extendRequestObjectPrototype(ext) {

        _.extend(requestObjectPrototype, ext);
    }

    /* get_superrole_authcode - logs in to server, gets authcodes, provides super-authcode to caller
     via promise.

     @param acctnum - numeric or string account number
     @param email - email address for account
     @param passwd - password provided by user
     */
    function get_superrole_authcode(acctnum, email, passwd) {

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

    /* get_authrole_authcode - logs in to server using an auth-role and auth-role password,
     provides authcode-authcode to caller via promise.

     @param acctnum - numeric or string account number
     @param role - role address for account
     @param passwd - password provided by user
     */
    function get_authrole_authcode(acctnum, role, passwd) {

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
            p = raw_getter.call(this_, req_preparer);

        return p.catch(function(e) {

            if ( e.message.substr(0, 5) === 'rdb12' ) {

                return get_superauth_from_user.call(this_, this_.q, 'Approve Super Query')
                    .then(function(d) {

                        // add authcode to request, and
                        save_authcode('super', d.authcode);

                        // try raw_data_getter again
                        return raw_getter.call(this_, req_preparer);
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
        return raw_getter.call(this, req_preparer);
    }

    /* go_preauth - function that runs query as preauth, getting super-authcode interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    function go_preauth(raw_getter, req_preparer) {

        var this_ = this,
            p = raw_getter.call(this_, req_preparer);

        return p.catch(function(e) {

            if ( e.message.substr(0, 5) === 'rdb10' ) {

                return get_preauthorization_from_user.call(this_, this_.q, 'Authorize Whitelisting of Query')
                    .then(function(d) {

                        // add authcode to request, and
                        save_authcode('preauth', d.authcode);

                        // try raw_data_getter again
                        return raw_getter.call(this_, req_preparer);
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
            p = raw_getter.call(this_, req_preparer);

        return p.catch(function(e) {

            if ( e.message.substr(0, 5) === 'rdb12' ) {

                return get_auth_authcode_from_user.call(this_, this_.q, 'Approve Auth Query')
                    .then(function(d) {

                        // add authcode to request, and
                        save_authcode('auth', d.authcode);

                        // try raw_data_getter again
                        return raw_getter.call(this_, req_preparer);
                    })
                    .catch(function(e) {

                        if ( e.message.substr(0, 5) === 'rdb10' ) {

                            return get_preauthorization_from_user.call(this_, this_.q,
                                                     'Authorize Whitelisting of Query')
                                .then(function(d) {

                                    // add authcode to request, and
                                    save_authcode('preauth', d.authcode);

                                    // try raw_data_getter again
                                    return raw_getter.call(this_, req_preparer);
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
        var _go_websocket = go_preauth.bind(req, raw_data_getter_ws, prepare_json);
        var _go_https = go_preauth.bind(req, raw_data_getter_http, prepare_formdata);
        req.go = go.bind(req, _go_https, _go_websocket);
        return req.init('preauth');
    }

    function Auth(authcode) {
        var req = Object.create(requestObjectPrototype);
        var _go_websocket = go_auth.bind(req, raw_data_getter_ws, prepare_json);
        var _go_https = go_auth.bind(req, raw_data_getter_http, prepare_formdata);
        req.go = go.bind(req, _go_https, _go_websocket);
        if ( authcode )
            save_authcode('auth', authcode);
        return req.init('auth');
    }

    function Super(authcode) {
        var req = Object.create(requestObjectPrototype);
        var _go_websocket = go_super.bind(req, raw_data_getter_ws, prepare_json);
        var _go_https = go_super.bind(req, raw_data_getter_http, prepare_formdata);
        req.go = go.bind(req, _go_https, _go_websocket);
        if ( authcode )
            save_authcode('super', authcode);
        return req.init('super');
    }

    function Reader() {
        var req = Object.create(requestObjectPrototype);
        var _go_websocket = go_reader.bind(req, raw_data_getter_ws, prepare_json);
        var _go_https = go_reader.bind(req, raw_data_getter_http, prepare_formdata);
        req.go = go.bind(req, _go_https, _go_websocket);
        return req.init('reader');
    }


    // help with diagnosing cors errors
    //
    events.on(EVENT_NAMES.connectionopenfail, function(evt) {

        var p = fetch('http://'+HOST+'/acct/corstest/'+ACCT);
        p.then(function(j) {
            j.json().then(function(d) {
                if (d.status === 'not-ok') {
                    console.log('This origin ('+window.location.origin+
                        ') is not a CORS-allowed origin for account '+ACCT + '.');
                    console.log('Allowed origins (obscured) are '+ d.origins.join(', '));
                }
                else {
                    console.log('Your connection failed, but your domain is CORS-allowed.');
                }
            });
        });
    });


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
        inline_sql: handle_inline_sql,

        // create loader with LAB.js object
        use_labjs_loader: use_labjs_loader,

        // extend_request_prototype
        extend_request_prototype: extendRequestObjectPrototype,

        version: __version__,

        // does client want dialog to confirm when authcode already available
        paranoidConfirm: false,

        show_form: show_named_form

    });

})(window);