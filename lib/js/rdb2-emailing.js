(function(undefined) {

    var html_ok=false,
        host_name,
        host_email,
        service_name;

    function config(_host_name, _host_email, _service, _html_ok) {

        if (! _service)
            throw new Error('badin provide service name to email_config');

        host_name = _host_name;
        host_email = _host_email;
        service_name = _service;
        html_ok = !!_html_ok;

        return this;
    }

    /* email - send request to server, with email elements, to send the email

     @param from - name email is from
     @param from_email - email address of sender
     @param to - name of recipient
     @param to_email - email address of recipient
     @param subject - subject line of email
     @param body - body of email
     @param body_html - html form of email body
     @param attachments - object, where names are filenames, and values are file bodies

     @returns - promise that resolves with third-party service response, or rejects with error
     */
    function email(from, from_email, to, to_email, subject, body, body_html, attachments) {

        function isDef(v) { return typeof(v) !== 'undefined' }
        var masterEmailQuery =
              'SELECT %(_to_email)s AS "To:", \n' +
              (isDef(to)          ? '       %(_to)s AS "ToName:", \n' : '') +
              '       %(_from_email)s AS "From:", \n' +
              (isDef(from)        ? '       %(_from)s AS "FromName:", \n' : '') +
              '       %(_subject)s AS "Subject:",\n' +
              '       %(_body)s AS body,\n' +
              (isDef(body_html)   ? '       %(_body_html)s AS html,\n' : '') +
              (isDef(attachments) ? '       %(_attachmentnames)s::VARCHAR[] AS attachmentnames, \n' : '') +
              (isDef(attachments) ? '       %(_attachmentbodies)s::VARCHAR[] AS attachmentbodies, \n' : '') +
              '       aa.service AS Service,\n' +
              "       aa.apikey AS apikey,\n" +
              "       %(_postcall)s AS postcall, \n"+
              "       %(_errcall)s AS errcall, \n"+
              "       %(_subquery_key)s.idx AS idx\n" +
              "  FROM (SELECT _b.apikey, _b.service FROM ( \n" +
              "      SELECT * FROM ( \n" +
              "          (SELECT apikey, service FROM auth.apikeys aa \n" +
              "                 WHERE service = %(_service)s LIMIT 1) \n" +
              "        UNION \n" +
              "          (SELECT 'na' AS apikey, 'service-not-found' AS service) \n" +
              "       LIMIT 1 ) _a \n" +
              "       UNION \n" +
              "         (SELECT apikey, service FROM auth.apikeys \n" +
              "                WHERE service = %(_service)s OFFSET 1) \n" +
              "   ) _b ) aa  \n" +
              "        RIGHT JOIN %(_sourcequery)s ON 1=1;";

        if (!this.q)
            this.q = 'SELECT 1 AS idx';

        var make_query = function(this_) {

            var attachmentbodies = [], attachmentnames = [];

            var namedParams = this_.finalToSend.namedParams || {},
                postcall = (namedParams.postcall || ''),
                errcall = (namedParams.errcall || '');

            if (this_.finalToSend.hasOwnProperty('q'))
                throw new Error('internal error - listen hook must be called after email hook, if needed');

            // avoid name collisions in aggregate query
            while (this_.q.indexOf(this_.finalToSend.QUERY_KEY) > -1) {
                this_.finalToSend.QUERY_KEY = '_'+this_.finalToSend.QUERY_KEY;
            }

            var subquery = this_.extract_query();

            var sources = {
                '_from': Rdbhost.util.wrap_value(from),
                '_from_email': Rdbhost.util.wrap_value(from_email),
                '_to': Rdbhost.util.wrap_value(to),
                '_to_email': Rdbhost.util.wrap_value(to_email),
                '_subject': Rdbhost.util.wrap_value(subject),
                '_body': Rdbhost.util.wrap_value(body),
                '_body_html': Rdbhost.util.wrap_value(body_html),
                '_service': Rdbhost.util.fixed(service_name),
                '_subquery_key': new Rdbhost.util.Bare_Marker(this_.finalToSend.QUERY_KEY),
                '_attachmentnames': undefined,
                '_attachmentbodies': undefined,

                '_sourcequery': subquery,
                '_postcall': Rdbhost.util.fixed(postcall),
                '_errcall': Rdbhost.util.fixed(errcall)
            };
            if (attachments && Object.keys(attachments).length) {

                _.each(Object.keys(attachments), function(k) {

                    var v = attachments[k];
                    attachmentnames.push(k);
                    attachmentbodies.push(v);
                });

                if (attachments instanceof Rdbhost.util.Fixed_Marker) {

                    sources['_attachmentnames'] =  Rdbhost.util.fixed(attachmentnames);
                    sources['_attachmentbodies'] =  Rdbhost.util.fixed(attachmentbodies);
                }
                else {

                    sources['_attachmentnames'] =  attachmentnames;
                    sources['_attachmentbodies'] =  attachmentbodies;
                }
            }

            this_.finalToSend.q = masterEmailQuery;

            this_.finalToSend.namedParams = sources;

        };

        // Add this function to request-hooks, to be applied just before sending to server\
        this.add_hook_pair(make_query, undefined, 'email', 0.1);

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
                        return Rdbhost.Email.admin.add_table(missing_tablename)
                            .then(function() {
                                    return thisCopy.go();
                                });
                    }
                }
                else if (errCode === 'rdb21' && errMsg.indexOf('service-not-found') >=0) {

                    return Rdbhost.Email.admin.apikey_dialog()
                        .then(Rdbhost.Email.admin.insert_apikey_sql)
                        .then(function() {
                                return thisCopy.go();
                            });
                }

                else {
                    throw e;
                }
            });

    }

    /* email_host - send an email to the host (as recorded in config)

     @param from - name email is from
     @param from_email - email address of sender
     @param subject - subject line of email
     @param body - body of email
     @param body_html - body of email, as html
     @param attachments - object, where names are filenames, and values are file bodies

     @returns - promise that resolves with third-party service response, or rejects with error
     */
    function email_host(from, from_email, subject, body, body_html, attachments) {

        return email.call(this, from, from_email,
            Rdbhost.util.fixed(host_name), Rdbhost.util.fixed(host_email),
            subject, body, body_html, attachments);
    }

    /* email_user - send an email to a user, from host (as recorded in config)

     @param to - name of recipient
     @param to_email - email address of recipient
     @param subject - subject line of email
     @param body - body of email
     @param body_html - html form of email body
     @param attachments - object, where names are filenames, and values are file bodies

     @returns - promise that resolves with third-party service response, or rejects with error
     */
    function email_user(to, to_email, subject, body, body_html, attachments) {

        if (!host_name)
            return Promise.reject(new Error('input no hostname provided in Email.config'));
        if (!host_email)
            return Promise.reject(new Error('input no host-email provided in Email.email_config'));

        return email.call(this,
            Rdbhost.util.fixed(host_name),
            Rdbhost.util.fixed(host_email),
            to, to_email, subject, body, body_html, attachments);
    }

    function add_emailing(o) {
        o.email_user = email_user;
        o.email_host = email_host;
        o.email = email;
        return o;
    }

    /* extend Rdbhost object to include formatting funcs, and request objects to add Email specific functions

     */
    window.Rdbhost.Email = Rdbhost.extendObject(window.Rdbhost, {

        email_config:   config,

        fixed: function(val) { return new Rdbhost.util.Fixed_Marker(val); },
        column:  function (val) { return new Rdbhost.util.Column_Marker(val); },

        // in_test_mode:   false
        preauth: function(rdgw, rdgh) {
            var o = this._parent.preauth(rdgw, rdgh);
            return add_emailing(o);
        },
        auth: function(authcode, rdgw, rdgh) {
            var o = this._parent.auth(authcode, rdgw, rdgh);
            return add_emailing(o);
        },
        reader: function() {
            var o = this._parent.reader(rdgw, rdgh);
            return add_emailing(o);
        },
        super: function(authcode, rdgw, rdgh) {
            var o = this._parent.super(authcode, rdgw, rdgh);
            return add_emailing(o);
        }
    });

})();


(function(window) {


    /* supervisory functions that handle setup
     *
     */

    var createApiKey = '\n\
     CREATE TABLE auth.apikeys ( \n\
       service VARCHAR(10), \n\
       apikey VARCHAR(100), \n\
       webmaster_email VARCHAR(150) NULL, \n\
       account_email VARCHAR(150) \n\
     );\n\
     GRANT SELECT, UPDATE, INSERT ON auth.apikeys TO {0};';

    /* add_apikey_table - create the apikey table
     */
    function add_apikey_table() {

        return Rdbhost.super()
            .query(createApiKey.replace('{0}', Rdbhost.roleid('p')))
            .go();
    }

    var addApiKey = "CREATE FUNCTION pg_temp.t(_service VARCHAR, _apikey VARCHAR, _acct_email VARCHAR) \n\
                 RETURNS void \n\
                     AS $$ \n\
                 BEGIN \n\
                     UPDATE auth.apikeys SET service=_service, apikey=_apikey, webmaster_email='', \n\
                                          account_email=_acct_email \n\
                          WHERE service = 'stripe'; \n\
                     IF NOT FOUND THEN \n\
                         INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \n\
                                          VALUES(_service, _apikey, '', _acct_email); \n\
                     END IF; \n\
                 END; \n\
                 $$ LANGUAGE plpgsql; \n\
                 \n\
                 SELECT pg_temp.t(%(service)s, %(apikey)s, %(account_email)s);";

    /* insert_apikey_sql - insert apikey into apikeys table

     @param parms - 3-array with apikey, account-email (for stripe account), and service-name
     */
    function insert_apikey_sql(parms) {

        var apikey = parms[1], acct_email = parms[2], service = parms[0];

        return Rdbhost.super()
            .query(addApiKey)
            .params({'apikey': apikey, 'service': service, 'account_email': acct_email})
            .go();
    }

    /* apikey_dialog - get api key and stripe account-email from user, with dialog box
     */
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

    var createTemplateTable = " \n\
     CREATE TABLE lookup.templates ( \n\
       name VARCHAR, \n\
       body TEXT \n\
     ); \n\
     GRANT SELECT, UPDATE, INSERT, DELETE ON lookup.templates TO {0}; \n\
     INSERT INTO lookup.templates (name, body) VALUES('welcome.tpl', 'Your password is {{passwd}}. Please login.'); ";

    function add_template_table() {

        return Rdbhost.super()
            .query(createTemplateTable.replace(/\{0\}/g, Rdbhost.roleid('p')))
            .get_data();
    }

    /* extend Rdbhost object to add Email specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.Email.admin = _.extend({}, window.Rdbhost.admin || {}, {

        'add_table': function(tablename) {

            if (tablename === 'auth.apikeys') {
                return add_apikey_table()
                    .then(apikey_dialog)
                    .then(insert_apikey_sql);
            }
            else if (tablename == 'lookup.templates') {

                return add_template_table();
            }
            else {
                throw new Error('42P01 relation "{}" does not exist '.replace('{}', tablename));
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