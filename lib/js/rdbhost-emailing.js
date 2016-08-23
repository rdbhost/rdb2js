(function(undefined) {

    var query_key = '_q_',
        html_ok=false,
        host_name,
        host_email,
        service_name;

    function _fixed_wrapper(val) {

        // todo - handle arrays as param
        this.val = val;
    }
    function _column_wrapper(val) {

        // todo - handle arrays as param

        if (val.indexOf('"') > -1)
            throw new Error('rdb-- column names cannot contain dbl quotes');
        this.val = val;
    }

    function fixed_wrapper(val) {
        return new _fixed_wrapper(val);
    }
    function column_wrapper(val) {
        return new _column_wrapper(val);
    }

    function config(_host_name, _host_email, _service, _html_ok) {

        host_name = _host_name;
        host_email = _host_email;
        service_name = _service;
        html_ok = _html_ok ? true : false;

        return this;
    }

    function email(from, from_email, to, to_email, subject, body, body_html, attachments) {

        function representation(param) {

            if (typeof param === 'undefined') {

                return ['NULL', undefined];
            }
            else if (param instanceof _fixed_wrapper) {

                return ["'@'".replace('@', param.val.replace("'", "''")), undefined];
            }
            else if (param instanceof _column_wrapper) {

                return ['"#"."@"'.replace('#', query_key).replace('@', param.val), undefined];
            }

            return ['%s', param];
        }

        function isDef(v) { return typeof(v) !== 'undefined' }
        var masterEmailQuery =
              'SELECT {{to_email}} AS "To:", \n' +
              (isDef(to)          ? '       {{to}} AS "ToName:", \n' : '') +
              '       {{from_email}} AS "From:", \n' +
              (isDef(from)        ? '       {{from}} AS "FromName:", \n' : '') +
              '       {{subject}} AS "Subject:",\n' +
              '       {{body}} AS body,\n' +
              (isDef(body_html)   ? '       {{body_html}} AS html,\n' : '') +
              (isDef(attachments) ? '       {{attachmentnames}} AS attachmentnames, \n' : '') +
              (isDef(attachments) ? '       {{attachmentbodies}} AS attachmentbodies, \n' : '') +
              '       aa.service AS Service,\n' +
              "       aa.apikey AS apikey,\n" +
              "       {{query_key}}.idx AS idx\n" +
              "  FROM (SELECT _b.apikey, _b.service FROM ( \n" +
              "      SELECT * FROM ( \n" +
              "          (SELECT apikey, service FROM auth.apikeys aa \n" +
              "                 WHERE service = {{service}} LIMIT 1) \n" +
              "        UNION \n" +
              "          (SELECT 'na' AS apikey, 'service-not-found' AS service) \n" +
              "       LIMIT 1 ) _a \n" +
              "       UNION \n" +
              "         (SELECT apikey, service FROM auth.apikeys \n" +
              "                WHERE service = {{service}} OFFSET 1) \n" +
              "   ) _b ) aa  \n" +
              "        RIGHT JOIN ({{q}}) AS {{query_key}} ON 1=1;";

        var f = function(this_) {

            var params = [],
                _attachmentbodies = [], _attachmentnames = [],
                t;
            function handle_param(v) {
                var t = representation(v);

                if (typeof t[1] !== 'undefined')
                    params.push(t[1]);

                return t[0];
            }

            if (this_.qPlus)
                throw new Error('internal error - listen hook must be called after email hook, if needed');
            this_.namedParams = this_.namedParams || {};

            if (!this_.q)
                this_.q = 'SELECT 1 AS idx';
            this_.q = this_.q.replace(/;$/, ''); // trim trailing ';' if any

            // avoid name collisions in aggregate query
            while (this_.q.indexOf(query_key) > -1) {
                query_key = '_'+query_key;
            }

            var _from, _from_email, _to, _to_email, _subject, _body, _body_html, _service;

            _to_email = handle_param(to_email);
            _to = handle_param(to);
            _from_email = handle_param(from_email);
            _from = handle_param(from);
            _subject = handle_param(subject);
            _body = handle_param(body);
            _body_html = handle_param(body_html);
            _service = handle_param(service_name); // called twice, ..
            _service = handle_param(service_name);

            if (attachments && attachments.length) {

                for (var k in Object.keys(attachments)) {

                    var v = attachments[k];
                    _attachmentnames.push(k);
                    _attachmentbodies.push(v);
                }

                if (attachments instanceof _fixed_wrapper) {

                    _attachmentnames =  fixed_wrapper(_attachmentnames);
                    _attachmentbodies =  fixed_wrapper(_attachmentbodies);
                }
                else if (attachments instanceof _column_wrapper) {

                    _attachmentnames =  column_wrapper(_attachmentnames);
                    _attachmentbodies =  column_wrapper(_attachmentbodies);
                }
                // else just leave arrays as arrays

            }

            // todo - rewrite to handle 'handle_param' step iteratively, as each token is found in
            // todo -  the query (so param list is created in right order)

            this_.qPlus = masterEmailQuery.replace('{{to_email}}', _to_email).replace('{{to}}', _to)
                .replace('{{from_email}}', _from_email).replace('{{from}}', _from)
                .replace('{{subject}}', _subject)
                .replace('{{body}}', _body).replace('{{body_html}}', _body_html)
                .replace('{{attachmentnames}}', _attachmentnames).replace('{{attachmentbodies}}', _attachmentbodies)
                .replace('{{q}}', this_.q).replace('{{query_key}}', query_key).replace('{{query_key}}', query_key)
                .replace('{{service}}', _service).replace('{{service}}', _service);

            this_.params(params); // array of params

        };
        f.label = 'email';

        // Add this function to request-hooks, to be applied just before sending to server
        this.request_hooks.push(f);
        // move listen hook to end
        var lsnPos = _.findIndex(this.request_hooks, function(f) { return f.label === 'listen'; });
        if (lsnPos >=0) {
            var tmpLsn = this.request_hooks.splice(lsnPos, 1);
            this.request_hooks.push(tmpLsn);
        }

        if (!this.q)
            this.q = 'SELECT 1 AS idx';

        this.proxy('email');

        var _this = this;

        var p = this.go();
        return p.then(function (d) {

                return d;
            })
            .catch(function (e) {
                var _splitPt = e.message.indexOf(' '),
                    splitPt = _splitPt >= 0 ? _splitPt : e.message.length,
                    errCode = e.message.substr(0, splitPt), errMsg = e.message.substr(splitPt+1);

                var thisCopy = _this.clone();

                if (errCode === '42P01') {

                    var m = /relation "([^"]+)" does not exist/.exec(errMsg);
                    if (m) {
                        var missing_tablename = m[1];
                        return Rdbhost.admin.add_table(missing_tablename)
                            .then(function() {
                                    return thisCopy.go();
                                });
                    }
                }
                else if (errCode === 'rdb21' && errMsg.indexOf('service-not-found') >=0) {

                    return Rdbhost.admin.apikey_dialog()
                        .then(Rdbhost.admin.insert_apikey_sql)
                        .then(function() {
                                return thisCopy.go();
                            });
                }

                else {
                    throw e;
                }
            });

    }

    var f = fixed_wrapper,
        q = column_wrapper;

    function email_host(from, from_email, subject, body, attachments) {

        return email(from, from_email, f(host_name), f(host_email), subject, body, attachments);
    }

    function email_user(to, to_email, subject, body, attachments) {

        return email(f(host_name), f(host_email), to, to_email, subject, body, attachments);

    }

    /* extend Rdbhost object to add Emailing specific functions

     */
    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        email_config:   config,

        fixed_wrapper: fixed_wrapper,
        column_wrapper: column_wrapper,

        in_test_mode:   false
    });

    /* extend Rdbhost request object to add Email specific functions

     */
    window.Rdbhost.extend_request_prototype({

        extended: 'email',

        email_user:   email_user,
        email_host:   email_host,
        email:        email

    });

})();


(function(window) {


    /* supervisory functions that handle setup
     *
     */

    var createApiKey = 'CREATE TABLE auth.apikeys ( \
                          service VARCHAR(10), \
                          apikey VARCHAR(100), \
                          webmaster_email VARCHAR(150) NULL, \
                          account_email VARCHAR(150) \
                        );';

    function add_apikey_table() {

        return Rdbhost.super()
            .query(createApiKey)
            .go();
    }

    var addApiKey = "CREATE FUNCTION pg_temp.t(_service VARCHAR, _apikey VARCHAR, _acct_email VARCHAR) \
                RETURNS void \
                    AS $$ \
                BEGIN \
                    UPDATE auth.apikeys SET service=_service, apikey=_apikey, webmaster_email='', \
                                         account_email=_acct_email \
                         WHERE service = 'stripe'; \
                    IF NOT FOUND THEN \
                        INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \
                                         VALUES(_service, _apikey, '', _acct_email); \
                    END IF; \
                END; \
                $$ LANGUAGE plpgsql; \
                \
                SELECT pg_temp.t(%(service)s, %(apikey)s, %(account_email)s);";

    function insert_apikey_sql(parms) {

        var apikey = parms[1], acct_email = parms[2], service = parms[0];

        return Rdbhost.super()
            .query(addApiKey)
            .params({'apikey': apikey, 'service': service, 'account_email': acct_email})
            .go();
    }

    function apikey_dialog() {

        function on_submit(f, resolve) {
            var eml = f.querySelector("input[name='account_email']"),
                apikey = f.querySelector("input[name='apikey']"),
                service = f.querySelector("select[name='service']");
            resolve([service.value, apikey.value, eml.value]);
            return true;
        }
        function populate_form(f, kws) {
            return undefined;
        }
        return Rdbhost.show_form('service', on_submit, populate_form, {});
    }

    /* extend Rdbhost object to add Email specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.admin = _.extend(window.Rdbhost.admin || {}, {

        'add_table': function(tablename) {

            if (tablename === 'auth.apikeys') {
                return add_apikey_table()
                    .then(apikey_dialog)
                    .then(insert_apikey_sql);
            }

            else {
                throw new Error('unrecognized tablename passed to add_table ~1'.replace('~1', tablename));
            }
        },

        'insert_apikey_sql': function(parms) {

            if (parms.length === 0) {
                parms = ['', '', ''];
            }
            return insert_apikey_sql(parms);
        },

        'apikey_dialog': function(parms) {

            return apikey_dialog(parms);
        }
    })

}(window));


// *