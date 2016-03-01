
(function(window) {

    var stripeChargeQuery =   "SELECT a.apikey AS apikey, \n"+
                        "       'stripe' AS service, \n"+
                        "       'charge' AS action, \n"+
                        "       amount AS amount, \n"+
                        "       %(cc_num)s AS cc_num, \n"+
                        "       %(cc_cvc)s AS cc_cvc, \n"+
                        "       %(cc_exp_mon)s AS cc_exp_mon, \n"+
                        "       %(cc_exp_yr)s AS cc_exp_yr, \n"+
                        "       'usd' AS currency, \n"+
                        "       description as description, \n"+
                        "       idx AS idx, \n"+
                        "       '{{postcall}}' AS postcall, \n"+
                        "       '{{errcall}}' AS errcall \n"+
                        "   FROM ({{sourcequery}}) AS _sq \n"+
                        "        LEFT JOIN " +
                        "          (SELECT * FROM auth.apikeys WHERE service = 'stripe') AS a ON 1=1",

        postCall =  'INSERT INTO "charges" (idx, id, amount, code) VALUES({idx}, {id}, {amount}, NULL)', // update
        errCall =  'INSERT INTO "charges" (idx, id, amount, code) VALUES({idx}, 0, 0, {error})';   // update

    var stripeRefundQuery = "SELECT a.apikey AS apikey, \n"+
                            "       'stripe' AS service, \n"+
                            "       'refund' AS action, \n"+
                            "       amount AS amount, \n"+
                            "       id as id, \n"+
                            "       idx AS idx, \n"+
                            "       '{{postcall}}' AS postcall, \n"+
                            "       '{{errcall}}' AS errcall \n"+
                            "   FROM ({{sourcequery}}) AS _sq \n"+
                            "        LEFT JOIN " +
                            "          (SELECT * FROM auth.apikeys WHERE service = 'stripe') AS a ON 1=1",

        postRefundCall =  'INSERT INTO "charges" (idx, id, amount, code) VALUES({idx}, {id}, -1*{amount}, NULL)', // update
        errRefundCall =  'INSERT INTO "charges" (idx, id, amount, code) VALUES({idx}, 0, 0, {error})';   // update


    /* runs a charge, through Stripe

     */
    function charge(cc_num, cc_cvc, cc_exp_mon, cc_exp_yr) {

        if (arguments.length < 4)
            throw new Error('too few arguments provided to charge');
        if (!cc_num || cc_num.length < 16)
            throw new Error('invalid credit-card number provided to charge');
        if (!cc_exp_mon || cc_exp_mon.length < 2)
            throw new Error('invalid month argument provided to charge');
        if (!cc_exp_yr || cc_exp_yr.length < 2)
            throw new Error('invalid month argument provided to charge');

        // create request_hook, to create charge query from data query
        //
        var f = function(this_) {

            if (this_.qPlus)
                throw new Error('listen() method must be called after charge(), if needed');
            this_.namedParams = this_.namedParams || {};

            var postcall = (this_.namedParams.postcall || postCall).replace("'", "\\\'"),
                errcall = (this_.namedParams.errcall || errCall).replace("'", "\\\'");
            delete this_.namedParams.postcall;
            delete this_.namedParams.errcall;
            this_.q = this_.q.replace(/;$/, '');

            this_.qPlus = stripeChargeQuery.replace('{{postcall}}', postcall).replace('{{errcall}}', errcall)
                                .replace('{{sourcequery}}', this_.q);
            _.extend(this_.namedParams, {
                'cc_num': cc_num,
                'cc_cvc': cc_cvc,
                'cc_exp_mon': cc_exp_mon,
                'cc_exp_yr': cc_exp_yr
            });

        };
        f.label = 'charge';

        // Add this function to request-hooks, to be applied just
        //  before sending to server
        this.request_hooks.push(f);
        var lsnPos = _.findIndex(this.request_hooks, function(f) { return f.label === 'listen'; });
        if (lsnPos >=0) {
            var tmpLsn = this.request_hooks.splice(lsnPos, 1);
            this.request_hooks.push(tmpLsn);
        }

        this.proxy('charge');

        var p = this.go();
        return p.then(function (d) {
                return d;
            })
            .catch(function (e) {
                var _splitPt = e.message.indexOf(' '),
                    splitPt = _splitPt >= 0 ? _splitPt : e.message.length,
                    errCode = e.message.substr(0, splitPt), errMsg = e.message.substr(splitPt+1);

                if (errCode === '42P01') {

                    var m = /relation "([^"]+)" does not exist/.exec(errMsg);
                    if (m) {
                        var missing_tablename = m[1];
                        return Rdbhost.admin.add_table(missing_tablename);
                    }
                }
                else if (errCode == 'rdb80') {

                    return Rdbhost.admin.apikey_dialog()
                        .then(Rdbhost.admin.insert_apikey_sql);
                }

                else {
                    throw e;
                }
            });
    }

    /* refunds a charge, through Stripe

     */
    function refund() {

        // create request_hook, to create charge query from data query
        //
        var f = function(this_) {

            if (this_.qPlus)
                throw new Error('listen() method must be called after charge(), if needed');
            this_.namedParams = this_.namedParams || {};

            var postcall = this_.namedParams.postcall || postRefundCall,
                errcall = this_.namedParams.errcall || errRefundCall;
            delete this_.namedParams.postcall;
            delete this_.namedParams.errcall;
            this_.q = this_.q.replace(/;$/, '');

            this_.qPlus = stripeRefundQuery.replace('{{postcall}}', postcall).replace('{{errcall}}', errcall)
                .replace('{{sourcequery}}', this_.q);

        };
        f.label = 'charge';

        // Add this function to request-hooks, to be applied just before sending to server
        this.request_hooks.push(f);
        var lsnPos = _.findIndex(this.request_hooks, function(f) { return f.label === 'listen'; });
        if (lsnPos >=0) {
            var tmpLsn = this.request_hooks.splice(lsnPos, 1);
            this.request_hooks.push(tmpLsn);
        }

        this.proxy('charge');

        return this.get_data();
    }


    /* extend Rdbhost request object to add Charge specific functions

     */
    window.Rdbhost.extend_request_prototype({

        extended: 'charge',

        charge: charge,
        refund: refund

    });


}(window));


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

    var createChargesTable = 'CREATE TABLE public.charges ( \
                          idx VARCHAR(10), \
                          id VARCHAR(100), \
                          amount DECIMAL, \
                          code VARCHAR(50) \
                        );';

    function create_charges_table() {

        return Rdbhost.super()
            .query(createChargesTable)
            .go();
    }

    var addApiKey = "CREATE FUNCTION pg_temp.t(_apikey VARCHAR, _acct_email VARCHAR) \
                RETURNS void \
                    AS $$ \
                BEGIN \
                    UPDATE auth.apikeys SET service='stripe', apikey=_apikey, webmaster_email='', \
                                         account_email=_acct_email \
                         WHERE service = 'stripe'; \
                    IF NOT FOUND THEN \
                        INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \
                                         VALUES('stripe', _apikey, '', _acct_email); \
                    END IF; \
                END; \
                $$ LANGUAGE plpgsql; \
                \
                SELECT pg_temp.t(%(apikey)s, %(account_email)s);";

    function insert_apikey_sql(parms) {

        var apikey = parms[0], acct_email = parms[1];

        return Rdbhost.super()
            .query(addApiKey)
            .params({'apikey': apikey, 'wm_email': '', 'account_email': acct_email})
            .go();
    }

    function apikey_dialog() {

        function on_submit(f, resolve) {
            var eml = f.querySelector("input[name='email']"),
                apikey = f.querySelector("input[name='apikey']");
            resolve([apikey, eml]);
            return true;
        }
        function populate_form(f, kws) {
            return undefined;
        }
        return Rdbhost.show_form('apikey', on_submit, populate_form, {});
    }

    /* extend Rdbhost object to add Charge specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.admin = _.extend(window.Rdbhost.admin || {}, {

        'add_table': function(tablename) {

                if (tablename === 'auth.apikeys') {
                    return add_apikey_table()
                           .then(apikey_dialog)
                           .then(insert_apikey_sql);
                }
                else if (tablename === 'charges') {

                    return create_charges_table();
                }

                else {
                    throw new Error('unrecognized tablename passed to add_table ~1'.replace('~1', tablename));
                }
           },

        'insert_apikey_sql': function(parms) {

                if (parms.length === 0) {
                    parms = ['', ''];
                }
                return insert_apikey_sql(parms);
           },

        'apikey_dialog': function(parms) {

            return apikey_dialog(parms);
        }
    })

}(window));