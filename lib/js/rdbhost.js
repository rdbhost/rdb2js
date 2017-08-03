/*

 RdbHost API module, version 2

 Facilitates accessing Rdbhost hosted databases and related services from JavaScript in the browser.

 */


(function (window, undefined) {

    "use strict";

    var __version__ = '2.2';
    var __release__ = '2.2.1';

    var DEBUG_SOCKET = true;

    var events, conns, requestId, requestTracker, partialCache, dialogDisplayed, loader, HOST, ACCT, PAGE_URL;
    var flds = ['q', 'repeat', 'mode', 'authcode', 'super-authcode', 'kw', 'args', 'namedParams', 'request-id'];


    /* encode_list - escapes quotes in items, and joins into one string

     @param vals - list of values to encode, each is possibly quoted
     */
    function encode_list(vals) {

        var v, vs = [];
        _.each(vals, function(v) {
            v = v.replace(/"/g, '\"');
            v = v.replace(/}/g, '\}');
            vs.push('"'+v+'"');
        });

        return "{"+vs.join(',')+"}";
    }

    /* value wrapping classes, used to mark arguments as having specific meaning
     */
    function Wrapper() {}

    function Fixed_Wrapper(val) {

        this.inline_plus_params = function() {

            var t = _.isArray(val) ? encode_list(val) : val.toString();
            return ["'@'".replace('@', t.replace("'", "''")), undefined, undefined];
        };
    }
    function Column_Wrapper(val) {

        if (val.indexOf('"') > -1)
            throw new Error('rdb-- column names cannot contain dbl quotes');

        this.inline_plus_params = function(QUERY_KEY) {
            return ['"#"."@"'.replace('#', QUERY_KEY).replace('@', val), undefined, undefined];
        }
    }
    function Null_Wrapper() {

        this.inline_plus_params = function() {
            return ['NULL', undefined, undefined];
        }
    }
//     function Literal_Wrapper(val) {
//
//         this.inline_plus_params = function() {
//
//             var t = _.isArray(val) ? encode_list(val) : val;
//             return ['%s', [t], undefined];
//         }
//     }
    function Bare_Wrapper(val) {

        this.inline_plus_params = function() {
            return [val, undefined, undefined];
        }
    }
    function Subquery_Wrapper(this_, val) {
        var np = _.extend({}, this_.namedParams || {}),
            a = this_.args ? this_.args.slice(0) : [];

        this.inline_plus_params = function() {
            return [val, a, np];
        }
    }

    function wrapped_val(param) {

        if (typeof param === 'undefined') {
            return new Null_Wrapper(param);
        }
        else if ((param instanceof Fixed_Wrapper) || (param instanceof Column_Wrapper)) {
            return param;
        }
        return param;
    }

    function process_wrapped_vals(q0, args0, namedParams0, QUERY_KEY) {

        var args = [], named_params = {},
            q, idx, ipp, ippCall, subres;

        var namedParmsTokenRe = new RegExp('%s|%\\((\\S+)\\)s', 'g');

        idx = 0;
        q = q0.replace(namedParmsTokenRe, function(match, nm, pos) {

            //if (pos < offset)
            //    return match;

            if (match === '%s') {
                ippCall = args0[idx];
                ipp = [match, [ippCall], undefined];
                idx += 1;
            }
            else {
                ippCall = namedParams0[nm];
                var _t = {}; _t[nm] = ippCall;
                ipp = [match, undefined, _t];
            }

            if (ippCall && ippCall.inline_plus_params) {

                if (ippCall instanceof Rdbhost.util.Column_Wrapper)
                    ipp = ippCall.inline_plus_params(QUERY_KEY);

                else if (ippCall instanceof Rdbhost.util.Subquery_Wrapper) {
                    subres = ippCall.inline_plus_params();
                    ipp = process_wrapped_vals(subres[0], subres[1], subres[2]);
                    ipp[0] = ipp[0].replace(/;$/, ''); // trim trailing ';' if any
                    ipp[0] = '(' + ipp[0].replace(/;$/, '') + ') AS ' + QUERY_KEY
                }
                else
                    ipp = ippCall.inline_plus_params();
            }

            if (typeof ipp[1] !== 'undefined')
                args.push.apply(args, ipp[1]);

            if (typeof ipp[2] !== 'undefined')
                _.extend(named_params, ipp[2]);

            // offset = pos+ipp[0].length;

            return ipp[0];
        });

        return [q, args, named_params];
    }

    // getter and setter for credentials cache
    //
    function get_credentials_cache() {
        var cc = sessionStorage.getItem('RDBHOST_CREDENTIALS_CACHE');
        return cc ? JSON.parse(cc) : {};
    }
    function save_credentials_cache(cc) {
        var jsn = JSON.stringify(cc);
        sessionStorage.setItem('RDBHOST_CREDENTIALS_CACHE', jsn);
    }

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


    /* inline_sql - checks for data inline in page, handles it

       @returns - promise that resolves with data, or rejects with error
     */
    function inline_sql() {

        function get_data_for_inline() {

            var q = sqlinc.getAttribute('data-sql'),
                role = sqlinc.getAttribute('data-role'),
                p;
            if ( role.substr(0,1) === 'p' )
                p = Rdbhost.preauth();
            else if ( role.substr(0,1) === 'r' )
                p = Rdbhost.reader();
            else
                return Promise.reject(new Error('bad role {} for inline sql'.replace('{}', role)));

            return p.query(q).go();
        }

        var sqlinc = document.getElementById('RDBHOST-SQL-INLINE-ID'),
            jsn, body;
        if ( !sqlinc.textContent || !/\S/.test(sqlinc.textContent) ) {
            jsn = {status: ['error', 'no-data'], error: ['no-data', 'no-data']};
        }

        try {
            body = sqlinc.textContent;
            jsn = JSON.parse(body);
        }
        catch(e) {
            console.log('inline_sql error '+ e.message);
            return Promise.reject(e);
        }

        if ( jsn.status[1] == 'OK' ) {
            return Promise.resolve(jsn);
        }

        if ( jsn.error[0] === 'rdb10' )
            return get_data_for_inline();
        else if ( jsn.error[0] === 'no-data' )
            return get_data_for_inline();
        else
            return Promise.reject(new Error(jsn.error.join(' ')));
    }


    /* use_labjs_loader - creates loader function that uses LABJS

      @param $L - LAB.JS object
     */
    function use_labjs_loader($L) {
        Rdbhost.loader = loader = function(nm, f) {
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
        setElement("input[name='code']", '');
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
            password = (_f = form.querySelector("input[name='password']")) ? _f.value : '',
            twofactor = (_f = form.querySelector("input[name='code']")) ? _f.value : '';

        if ( ! email.length && ! role.length ) {

            setElement("span.error", 'provide an email address');
            return false;
        }
        else if ( ! password.length ) {

            setElement("span.error", 'provide a password');
            return false;
        }
        else {

            var cc = get_credentials_cache();
            if ( email ) {
                cc['email'] = email;
            }
            if ( role ) {
                cc['role'] = role;
            }
            save_credentials_cache(cc);
            resolve([email || role, password, twofactor]);

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

        var nomore = form.getElementsByTagName('form')[0].elements['no_more'];
        if (nomore.checked) {
            Rdbhost.paranoid_confirm = false;
            paranoid_check(false);
        }
        resolve();
        return true;
    }

    /* show_auth_form - adds form to document, attaches click handlers that resolve/reject promise

     @param onSubmit - function that handles data from form  -> signature onSubmit(form, resolve)
          onSubmit returns - true if success, false otherwise.  can change form in response to
          input validation.  on returning false, form will be redisplayed

     @param formText - body of form, as text
     @param populate_form - function that populates form before display  -> signature populate_form(form, parms)
     @param parms - object { 'error' text, 'sql' text of query to approve, 'notice' text for dialog subtitle }
     */

    function show_auth_form(onSubmit, formText, populate_form, parms) {

        var cc = get_credentials_cache();
        var p = _.extend({}, parms, {'email': cc['email'],
                                     'role': cc['role']});
        return _show_text_form(onSubmit, formText, populate_form, p);
    }
    
    
    function _show_text_form(onSubmit, formText, populate_form, parms) {

        // grab individual elements from parms hash
        var error = parms['error'], sql = parms['sql'], notice=parms['notice'];

        // if the form has already been displayed, (by a different caller, presumably),
        //   then return a promise that waits for that form to clear, then shows this form.
        if ( dialogDisplayed ) {
            return new Promise(function(resolve, revoke) {

                events.once(EVENT_NAMES.formcleared, function() {
                    resolve(_show_text_form(onSubmit, formText, populate_form, parms));
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

        var form = document.getElementById(id);
        populate_form(form, parms);

        dialogDisplayed = true;

        // emit event that form has been displayed
        events.emit(EVENT_NAMES.formdisplayed, [parms['notice']]);

        document.body.addEventListener('click', modal_force, true);

        // return promise that resolves when form submitted
        //
        return new Promise(function(resolve, reject) {

            /* _onSubmit - submit handler for form    */
            function _onSubmit(evt) {

                evt.stopPropagation();
                evt.preventDefault();

                if ( onSubmit(form, resolve) ) {

                    document.body.removeChild(el);
                    document.head.removeChild(elCss);
                    document.body.removeEventListener('click', modal_force, true);

                    dialogDisplayed = false;
                    events.emit(EVENT_NAMES.formcleared, parms['notice']);
                }
            }

            /* _onCancel - cancel-button [x] handler for form    */
            function _onCancel(evt) {

                evt.stopPropagation();
                evt.preventDefault();

                document.body.removeChild(el);
                document.head.removeChild(elCss);
                document.body.removeEventListener('click', modal_force, true);

                dialogDisplayed = false;
                events.emit(EVENT_NAMES.formcleared, parms['notice']);

                reject(new Error('authorization dialog cancelled'));
            }

            // install event handlers
            form.querySelector("form").addEventListener('submit', _onSubmit);
            form.querySelector('.cancel').addEventListener('click', _onCancel);
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


    /* paranoid-check - record whether to show confirm dialogs

     @param yn - show paranoid dialogs?   true | false
     */
    function paranoid_check(yn) {

        var cc = get_credentials_cache(),
            authCache = cc.authorization_cache || {};

        var ret = authCache['paranoid_check'];

        if (typeof(yn) !== 'undefined') {

            authCache['paranoid_check'] = yn;
            cc.authorization_cache = authCache;
            save_credentials_cache(cc);
        }

        return ret;
    }

    /* save_authcode - saves an authcode to cache for reuse

     @param key - 'super' or 'preauth' or 'auth'
     @param authcode - the authcode to save
     */
    function save_authcode(key, authcode) {

        var cc = get_credentials_cache(),
            authorizationCache = cc.authorization_cache || {};

        function delItems(key) {
            delete authorizationCache[key];
            delete authorizationCache[key+'_to'];
            cc.authorization_cache = authorizationCache;
            save_credentials_cache(cc);
        }
        function saveItem(key, authcode) {
            authorizationCache[key] = authcode;
            authorizationCache[key+'_to'] = to;
            cc.authorization_cache = authorizationCache;
            save_credentials_cache(cc);
        }

        delItems(key);

        var to = setTimeout(function() {
            delItems(key);
        }, 45*60*1000);

        if (authcode) {
            saveItem(key, authcode);
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

        // conns[role] =  new ReconnectingWebSocket('wss://'+HOST+'/wsdb/'+roleid, null, {debug: DEBUG_SOCKET});
        conns[role] =  new RobustWebSocket('wss://'+HOST+'/wsdb/'+roleid, undefined, {
            shouldReconnect: function(event, ws) {
                return Math.pow(1.5, ws.attempts) * 500;
            }
        });

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
    }

    /* handle_message

     @param role - which role-connection received msg
     @param json - payload of message, as string
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
                run_response_hooks.call(req, data);
                // _.each(req.result_hooks, function(f) {
                //     f(data);
                // });
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
     @returns - undefined
     */
    function fix_record_sets(data) {

        // if data already has record_sets, return
        if ( data.result_sets )
            return;
        if ( !data.records )
            return;

        data.result_sets = [{'records': data.records, 'row_count': data.row_count, 'status': data.status}];
        delete data.records;
    }

    /* show_named_form - gets form from server, adds it to document, attaches click handlers that resolve/reject promise

     @param formName - name of form
     @param onSubmit - function that handles data from form  -> signature onSubmit(form, resolve)
     @param popForm - function that populates form
     @param kws - object { 'error' text, 'sql' text of query to approve, 'notice' text for dialog subtitle }
     */
    function show_named_form(formName, onSubmit, popForm, kws){

        // var error = kws['error'], sql=kws['sql'], notice=kws['notice'];
        var pgPromise = html_partial_getter_ws(formName);

        return pgPromise.then(function(form) {

            // append form to body and show it.
            //  returns a promise, resolved by form submission, or rejected by cancel
            return _show_text_form(onSubmit, form, popForm, kws);
        })
    }

    /* get_authcode_from_user - generic operation for role-specific authcode
     retrieval

     @param role - 'preauth', 'super', etc
     @param error - error string to put in dialog
     @param sql - query to show in dialog
     @param notice - notice string to put in dialog
     */
    function get_authcode_from_user(role, error, sql, notice) {

        var this_ = this,
            pgPromise = html_partial_getter_ws(role + '_auth');

        return pgPromise.then(function(form) {

                // append form to body and show it.
                //  returns a promise, resolved by form submission, or rejected by cancel
                return show_auth_form(on_authorize_submit, form, populate_form, {'error': error, 'sql': sql, 'notice': notice});
            })
            .catch(function(e) {
                throw e;
            })
            .then(function(eml_pass) {

                // get authcode using email and password
                var email = eml_pass[0], password = eml_pass[1], twofactor = eml_pass[2];
                var pr_gs = role === 'auth' ? get_authrole_authcode(ACCT, role, password)
                    : get_superrole_authcode(ACCT, email, password, twofactor);

                return pr_gs.catch(function(e) {

                    if ( e.message.substr(0,11) === 'bad input. ' )
                        return get_authcode_from_user.call(this_, role, 'fix input', sql, notice);
                    if ( e.message.substr(0,11) === 'bad email/p' )
                        return get_authcode_from_user.call(this_, role, 'bad email/pass combo', sql, notice);
                    if ( e.message.substr(0,11) === 'two factor ' )
                        return get_authcode_from_user.call(this_, role, 'bad two factor code', sql, notice);

                    throw e;
                })
            });
    }


    /* add_hook_pair - adds a pair of hooks to hooks list

     @param label: string identifying hook pair
     @param orderkey: 0-1 , key for sorting, prior to execution (default 0.5)
     @param request: function to run on request object, prior to sending
     @param response: function to run on response object, upon receipt.
     */
    function add_hook_pair(request, response, label, order_key) {
        var o = {
            label: label || '-',
            orderkey: order_key || 0.5,
            request_handler: request,
            response_handler: response
        };
        this.hooks.push(o);
    }

    /* run_request_hooks - runs request hooks on request object.
     must be provided request as `this`

     @returns: undefined
     */
    function run_request_hooks() {

        var finalToSend = this.finalToSend;

        // sort hooks by order_key
        finalToSend.hooks = _.sortBy(this.hooks, function(itm) { return itm.order_key; });

        // get position of 'listen' request hooks, use to check listen against repeat
        var lsnPos = _.findIndex(this.hooks, function(itm) { return itm.label === 'listen'; });
        if ( lsnPos >= 0 && this.repeatCt && this.repeatCt > 1 ) {
            throw new Error('listen and repeat cannot be used on same request');
        }

        // apply each request hook to result data
        _.each(finalToSend.hooks, function(hook) {
            if (hook.request_handler)
                hook.request_handler(finalToSend);
        });
    }

    /* run_response_hooks - runs response hooks on returned data
     must be provided request as `this`

     @returns: undefined
     */
    function run_response_hooks(data) {

        var rev_hooks = this.finalToSend.hooks.reverse();

        // apply each response hook to result data
        _.each(rev_hooks, function(hook) {
            if (hook.response_handler)
                hook.response_handler(data);
        });
    }

    /* prepare_formdata - processes request data into a FormData object.
     must be bound to a request to work

     @param auth_cache - cache of credentials
     @returns - 2-tuple [url, formData]
     */
    function prepare_formdata(auth_cache) {

        this.finalToSend = Object.create(this);
        run_request_hooks.call(this);

        var formData = this.finalToSend.formData;
        auth_cache = auth_cache || {};

        formData.append('q', this.finalToSend.q);
        if (this.hasOwnProperty('repeatCt'))
            formData.append('repeat', this.repeatCt);
        if (this.hasOwnProperty('mode'))
            formData.append('mode', this.mode);
        if (this.role === 'super' && auth_cache['super'])
            formData.append('authcode', auth_cache['super']);
        if (this.role === 'preauth' && auth_cache['preauth'])
            formData.append('super-authcode', auth_cache['preauth']);
        if (this.role === 'auth' && auth_cache['preauth']) {
            formData.append('super-authcode', auth_cache['preauth']);
            formData.append('authcode', auth_cache['auth']);
        }
        formData.append('format', 'json-easy');

        var roleid = make_roleid(this.role, ACCT),
            url = 'https://'+HOST+'/db/'+roleid;

        return [url, formData];
    }

    /* prepare_json - processes request data into json string.
     must be bound to a request to work

     @param auth_cache - cache of credentials
     @returns - json string
     */
    function prepare_json(auth_cache) {

        auth_cache = auth_cache || {};
        this.finalToSend = Object.create(this);
        run_request_hooks.call(this);

        // assemble data to send to server
        if (this.hasOwnProperty('repeatCt'))
            this.finalToSend.repeat = this.repeatCt;
        if (this.hasOwnProperty('mode'))
            this.finalToSend.mode = this.mode;
        if (this.role === 'super')
            this.finalToSend.authcode = auth_cache['super'];
        else if (this.role === 'preauth') {

            this.finalToSend['super-authcode'] = auth_cache['preauth'];
            this.finalToSend['authcode'] = '-';
        }
        else if (this.role === 'auth') {

            this.finalToSend['super-authcode'] = auth_cache['preauth'];
            this.finalToSend['authcode'] = auth_cache['auth'];
        }
        else {

            this.finalToSend['super-authcode'] = undefined;
            this.finalToSend['authcode'] = undefined;
        }

        // convert data to json format
        var d = {}, this_ = this;
        _.each(flds, function(f) {
            d[f] = this_.finalToSend[f];
        });
        return JSON.stringify(d);
    }

    /* have_authcodes_for_role - does request have its necessary authcodes?

     @returns - true | false
     */
    function have_authcodes_for_role() {

        var auth_cache = get_credentials_cache().authorization_cache || {};

        if (this.role === 'super')
            return !! auth_cache['super'];
        if (this.role === 'preauth')
            return !! auth_cache['preauth'];
        if (this.role === 'auth')
            return !! (auth_cache['preauth'] && auth_cache['auth']);

        return false;
    }

    /* html_partial_getter_ws - retrieves raw html files from server, caching same

     @param name - stub-name of template file to retrieve
     @returns - promise resolving with body of template, after caching it
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
     @param auth_cache - cache of credentials
     @returns - promise resolving with body of template, after caching it
     */
    function raw_data_getter_http(data_extractor, auth_cache) {

        var this_ = this;

        // client does not want response headers, just body
        //   so we keep the initial fetch promise, and resolve
        //   with the body (json) promise.
        return new Promise(function(resolve, reject) {

            var url_formdata = data_extractor.call(this_, auth_cache),
                url = url_formdata[0],
                formData = url_formdata[1];

            // resolve and reject here provide 2nd promise (p) results
            //   to first promise `then`s
            var p = fetch(url, {method: 'post', body: formData});
            return p.then(function(resp) {

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
                                run_response_hooks.call(this_, data);
                                // _.each(this_.result_hooks, function(f) {
                                //     f(data);
                                // });
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

     @param json_getter - function that gets json string with complete request
     @param auth_cache - cache object with credentials
     @returns - promise resolving with body of template, after caching it
     */
    function raw_data_getter_ws(json_getter, auth_cache) {

        var this_ = this;

        function get() {

            var json = json_getter.call(this_, auth_cache);

            // returns promise, and track promise by
            return new Promise(function(resolve, reject) {

                // send the request to the server
                this_.conn.send(json);

                // add promise handlers to tracker, for use by socket message-handler
                requestTracker[this_['request-id']] = [resolve, reject, this_];
            });

        }

        // if socket ready to go
        if ( conns[this_.role] && conns[this_.role].readyState === WebSocket.OPEN ) {

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

    /* go - sends request to server, returns promise to be resolved with received data.
     will be bound, with both parameters curried, so callable will be only (optional) auth_cache param

     @returns promise
     */
    function go(https_go, ws_go) {

        var this_ = this;

        if ( !this_.q ) throw new Error('no query was provided');
        if ( this_.isDone ) throw new Error('request has already been run. use clone to rerun it.');

        // test for formData element, and use go_http if found,
        if ( this_.formData ) {

            return https_go.call(this_);
        }

        // else use _go_websocket
        return ws_go.call(this_);
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
            this['request-id'] = role + (requestId++);
            this.isDone = false;

            this.conn = conns[role] || make_connection(role);

            this.hooks = [];
            add_hook_pair.call(this, null, fix_record_sets, 'fixrecsets', 0.2);

            function interpolate_wrapped(this_) {

                var q_ = this_.finalToSend.q,
                    args_ = this_.finalToSend.args,
                    named_params = this_.finalToSend.namedParams,
                    has_wrapped = false;
             
                _.each(named_params, function(itm) {
                  if (itm && itm.inline_plus_params)
                     has_wrapped = true;
                     return false;
                });
                _.each(args_, function(itm) {
                    if (itm && itm.inline_plus_params)
                        has_wrapped = true;
                    return false;
                });
                if (!has_wrapped)
                   return;
                if (this_.repeatCt)
                    throw new Error('repeat-ct cannot be used with wrapped values');
             
                var res = process_wrapped_vals(q_, args_, named_params, this_.finalToSend.QUERY_KEY);
                this_.finalToSend.q = res[0];
                this_.finalToSend.args = res[1];
                this_.finalToSend.namedParams = res[2];
            }

            add_hook_pair.call(this, interpolate_wrapped, null, 'unwrap', 0.2);

            this.finalToSend = null;

            this.QUERY_KEY = '_q_';

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

            /* strip_listen - if request was made with LISTEN sql added, then results will have extra record_sets.
             Those record sets get stripped by this function, so client gets predictable set of record_sets.

             @param data - data from server
             */
            function strip_listen(data) {

                var rs = data.result_sets;
                if ( rs.length < 2 )
                    throw new Error('invalid result set collection provided to strip_listen');

                rs.splice(0, 1);
                rs.splice(rs.length-2, 2);
            }

            function add_listen(this_) {

                var q0 = this_.finalToSend.q;
                var qParts = ['LISTEN "~1"'.replace('~1', channel), // todo - parametrize this
                               q0,
                               'COMMIT; BEGIN;' ];
                this_.finalToSend['q'] = qParts.join(';\n');
            }

            // Add this function to request-hooks, to be applied just
            //  before sending to server
            add_hook_pair.call(this, add_listen, strip_listen, 'listen', 0.1);

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

        /* get_data - send request to server, return promise for data

        @returns - promise for data
         */
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
                    || ['request-id', 'conn', 'role', 'isDone'].indexOf(k) >= 0
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


    /* get_confirmation - shows confirmation dialog box to user, gets response, handles saving
      no-nagging checkbox if set, throws error on cancel. returns Promise

     @returns - promise for true | false
     */
    function get_confirmation() {

        var this_ = this,
            pgPromise = html_partial_getter_ws('any_confirm'),
            capitalizedRole = this_.role.substr(0,1).toUpperCase() + this_.role.substr(1),
            sql = this_.finalToSend ? this_.finalToSend.q : this_.q;

        return pgPromise.then(function(form) {

            // append form to body and show it.
            //  returns a promise, resolved by form submission, or rejected by cancel
            return show_auth_form(on_confirm_submit, form, populate_form,
                {'error': '', 'sql': sql, 'notice': capitalizedRole});
        })
    }

    /* get_superrole_authcode - logs in to server, gets authcodes, provides super-authcode to caller
     via promise.

     @param acctnum - numeric or string account number
     @param email - email address for account
     @param passwd - password provided by user
     @param twofactor - 2-factor auth code from Google Authenticator (optional)
     */
    function get_superrole_authcode(acctnum, email, passwd, twofactor) {

        var url = 'https://' + HOST + '/acct/login/0' + make_roleid('reader', acctnum).substr(1),
            formData = new FormData();

        formData.append('arg:email', email);
        formData.append('arg:password', passwd);
        formData.append('arg:twofactor', twofactor);

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
     @param twofactor - 2-factor auth code from Google Authenticator (optional)
     */
    function get_authrole_authcode(acctnum, role, passwd, twofactor) {

        var roleid = make_roleid('auth', acctnum),
            url = 'https://' + HOST + '/acct/authlogin/0' + roleid.substr(1),
            formData = new FormData();

        formData.append('arg:role', roleid);
        formData.append('arg:password', passwd);
        formData.append('arg:twofactor', twofactor);

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

    var go_methods = {};

    /* go_methods[super] - function that runs query as super, getting authcode interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    go_methods['super'] = function(raw_getter, req_preparer) {

        var this_ = this, p;
        var auth_cache = get_credentials_cache().authorization_cache;

        function try_on_unproven_auth() {

            if (auth_cache && auth_cache.super && Rdbhost.paranoid_confirm) {

                return get_confirmation.call(this_)
                    .catch(function(e) {
                        throw e;
                    })
                    .then(function() {
                        return raw_getter.call(this_, req_preparer, auth_cache);
                    })
            }

            else if (auth_cache && auth_cache.super) {
                // try raw_data_getter again
                return raw_getter.call(this_, req_preparer, auth_cache);
            }

            else {
                var sql = this_.finalToSend ? this_.finalToSend.q : this_.q;

                return get_authcode_from_user.call(this, 'super', '', sql, 'Approve Super Query')
                    .then(function(d) {

                        // add authcode to request, and
                        save_authcode('super', d.authcode);
                        auth_cache = get_credentials_cache().authorization_cache || {};

                        // try raw_data_getter again
                        return raw_getter.call(this_, req_preparer, auth_cache);
                    });
            }
        }

        p = try_on_unproven_auth();

        return p.catch(function(e) {

            if ( e.message.substr(0, 5) === 'rdb12' ) {

                return try_on_unproven_auth();
            }
            else
                throw e;
        })
    };


    /* go_methods[reader] - function that runs query as reader
     should be bound to a request object first, with raw_getter req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    go_methods['reader'] = function(raw_getter, req_preparer) {
        return raw_getter.call(this, req_preparer);
    };

    /* go_methods[preauth] - function that runs query as preauth, getting super-authcode interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    go_methods['preauth'] = function(raw_getter, req_preparer) {

        var this_ = this;

        function _do(auth_cache) {

            var p = raw_getter.call(this_, req_preparer, auth_cache);

            return p.catch(function(e) {

                auth_cache = get_credentials_cache().authorization_cache;
                if (e.message.substr(0, 5) === 'rdb10') {

                    if (auth_cache && auth_cache['preauth'] && Rdbhost.paranoid_confirm) {

                        return get_confirmation.call(this_)
                            .then(function() {

                                return _do(auth_cache);
                            })
                    }
                    else if (auth_cache && auth_cache['preauth']) {

                        return _do(auth_cache);
                    }
                    else {
                        var  sql = this_.finalToSend ? this_.finalToSend.q : this_.q;;

                        return get_authcode_from_user.call(this, 'preauth', '', sql, 'Authorize Whitelisting of Query')
                            .then(function(d) {

                                // add authcode to request, and
                                save_authcode('preauth', d.authcode);

                                // try raw_data_getter again
                                auth_cache = get_credentials_cache().authorization_cache;
                                return _do(auth_cache);
                            });
                    }
                }
                else {
                    throw e;
                }
            })
        }

        return _do();
    };


    /* go_methods[auth] - function that runs query as auth role, getting super-authcode and auth-authcodes
     interactively as necessary
     should be bound to a request object first, with raw_getter and req_preparer curried

     @param raw_getter - function that gets data, returning a promise
     @param req_preparer - function that prepares request for sending to server

     final bound signature would have no parameters
     */
    go_methods['auth'] = function(raw_getter, req_preparer) {

        var this_ = this,
            should_confirm_auth = false, // Rdbhost.paranoid_confirm,
            should_confirm_preauth = Rdbhost.paranoid_confirm;

        function _do() {

            var auth_cache = get_credentials_cache().authorization_cache,
                sql = this_.finalToSend ? this_.finalToSend.q : this_.q;


            if (!auth_cache || !auth_cache['auth']) {
                return get_authcode_from_user.call(this, 'auth', '', sql, 'Approve Auth Query')
                    .then(function (d) {

                        // add authcode to request, and
                        save_authcode('auth', d.authcode);

                        // try agaian
                        return _do();
                    })
            }

            if (auth_cache && auth_cache['auth'] && should_confirm_auth) {

                should_confirm_auth  = false;
                return get_confirmation.call(this_)
                    .then(function () {

                        return _do();
                    })
            }

            var args = {'auth': auth_cache['auth']};
            if (!should_confirm_preauth)
                args['preauth'] = auth_cache['preauth'];

            var p = raw_getter.call(this_, req_preparer, args);

            return p.catch(function(e) {

                var sql = this_.finalToSend ? this_.finalToSend.q : this_.q;

                // if authorization fail, password must be bad
                if (e.message.substr(0, 5) === 'rdb12') {

                    return get_authcode_from_user.call(this, 'auth', '', sql, 'Approve Auth Query')
                        .then(function (d) {

                            // add authcode to request, and
                            save_authcode('auth', d.authcode);

                            // try agaian
                            return _do();
                        })
                }
                if (e.message.substr(0, 5) === 'rdb10') {

                    if (auth_cache && auth_cache.preauth && should_confirm_preauth) {

                        should_confirm_preauth = false;
                        return get_confirmation.call(this_)
                            .then(function () {

                                return _do();
                            })
                    }
                    else if (auth_cache && auth_cache.preauth) {

                        return _do();
                    }
                    else {

                        return get_authcode_from_user.call(this, 'preauth', '', sql, 'Authorize Whitelisting of Query')
                            .then(function (d) {

                                should_confirm_preauth = false;
                                // add authcode to request, and
                                save_authcode('preauth', d.authcode);

                                // try again
                                return _do();
                            });
                    }
                }
                else
                    throw e;
            })
        }

        return _do();
    };


    /* ===================================================

     this factory function creates request objects for specific roles

     @param rolename - 'preauth', 'super', etc.
     @param authcode - authcode for role (optional)
     @param rdgw - websocket getter (optional)
     @param rdgh - html getter (optional)
     */

    function connection_constructor(rolename, authcode, rdgw, rdgh) {

        rdgw = rdgw || raw_data_getter_ws;
        rdgh = rdgh || raw_data_getter_http;

        var req = Object.create(requestObjectPrototype);
        var _go_websocket = go_methods[rolename].bind(req, rdgw, prepare_json);
        var _go_https = go_methods[rolename].bind(req, rdgh, prepare_formdata);
        req.go = go.bind(req, _go_https, _go_websocket);
        if ( authcode )
            save_authcode(rolename, authcode);

        return req.init(rolename);
    }


    /* reset - clears most state from module - useful for testing

        @param cb - callback called when done
        @param clean - true | false - should credentials be cleared
     */
    function reset(cb, clean) {

        if (conns)
            close_connections(1000, 'reset');
        conns = {};

        requestId = 1;
        requestTracker = {};
        partialCache = {};
        dialogDisplayed = false;
        loader = function(nm, f) { throw new Error('no loader defined'); };
        HOST = ACCT = PAGE_URL = undefined;

        events = new TinyEmitter;
        window.Rdbhost = _.extend(window.Rdbhost, {

            // export event methods
            on: events.on.bind(events),
            off: events.off.bind(events),
            once: events.once.bind(events)
        });

        // clean up caches - useful for testing purposes
        if (clean) {
            save_credentials_cache({});
        }

        // help with diagnosing cors errors
        //
        events.on(EVENT_NAMES.connectionopenfail, function(evt) {

            var p = fetch('//'+HOST+'/acct/corstest/'+ACCT);
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

        if (cb)
            return cb();
    }

    var _pc = paranoid_check();

    // export Rdbhost object with necessary methods
    //
    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        // initial method
        connect: connect,
        disconnect: close_connections,

        // request factories
        preauth: function(rdgw, rdgh) { return connection_constructor('preauth', null, rdgw, rdgh) },
        auth: function(authcode, rdgw, rdgh) { return connection_constructor('auth', authcode, rdgw, rdgh) },
        super: function(authcode, rdgw, rdgh) { return connection_constructor('super', authcode, rdgw, rdgh) },
        reader: function(rdgw, rdgh) { return connection_constructor('reader', null, rdgw, rdgh) },

        // inline-sql handler
        inline_sql: inline_sql,

        // create loader with LAB.js object
        use_labjs_loader: use_labjs_loader,
        
        // the loader (default throws exception)
        loader: loader,

        // extend self
        extendObject: function(obj, ext) {

            var o = Object.create(obj);
            o._parent = obj;
            for ( var _i in ext ) {
                if ( !ext.hasOwnProperty(_i) )
                    continue;
                o[_i] = ext[_i];
            }

            return o;
        },

        version: __version__,
        account_number: function() { return ACCT; },
        roleid: function (role) {
            var acctStr = '000000000' + ACCT;
            return role.substr(0,1).toLowerCase() + acctStr.substr(acctStr.length-10,10);
        },
        host: function() { return HOST; },

        // does client want dialog to confirm when authcode already available
        paranoid_confirm: typeof(_pc)  === 'undefined' ? true : _pc,

        show_form: show_named_form,

        // useful for testing
        reset_rdbhost: reset,

        // add a pair of hooks, for pre-request and post-response
        add_hook_pair: add_hook_pair,

        util: {
            Null_Wrapper: Null_Wrapper,
            Fixed_Wrapper: Fixed_Wrapper,
            Column_Wrapper: Column_Wrapper,
            Bare_Wrapper: Bare_Wrapper,
            Subquery_Wrapper: Subquery_Wrapper,

            fixed: function(v) {return new Fixed_Wrapper(v)},
            column: function(v) {return new Column_Wrapper(v)},
            null: function(v) {return new Null_Wrapper()},

            wrap_value: wrapped_val
        }

    });

    reset(undefined, false);

})(window);
