
(function(window) {

    var stripeChargeQuery =
            "-- SELECT necessary elements to do a cc charge through Stripe. \n" +
            "--   \n" +
            "SELECT a.apikey AS apikey, \n"+
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
            "       %(_postcall)s AS postcall, \n"+
            "       %(_errcall)s AS errcall \n"+
            "   FROM %(_sourcequery)s \n"+
            "        LEFT JOIN " +
            "          (SELECT * FROM auth.apikeys WHERE service = 'stripe') AS a ON 1=1",

        postCall =  '-- postcall query to insert cc result into charges table. \n' +
                    'INSERT INTO "charges" (tstamp, idx, id, amount, fee, paid, refunded, last4, error) \n' +
                    '  VALUES(to_timestamp({created}), {idx}, {id}, {amount}, {fee}, {paid}, {refunded}, \n' +
                    '        {card[last4]}, {error}) \n',
        errCall =  postCall;   // update

    var stripeRefundQuery =
            "-- SELECT necessary elements to do a cc refund through Stripe. \n" +
            "--   \n" +
            "SELECT a.apikey AS apikey, \n"+
            "       'stripe' AS service, \n"+
            "       'refund' AS action, \n"+
            "       amount AS amount, \n"+
            "       id as id, \n"+
            "       idx AS idx, \n"+
            "       %(_postcall)s AS postcall, \n"+
            "       %(_errcall)s AS errcall \n"+
            "   FROM %(_sourcequery)s \n"+
            "        LEFT JOIN " +
            "          (SELECT * FROM auth.apikeys WHERE service = 'stripe') AS a ON 1=1",

        postRefundCall =  postCall,
        errRefundCall =  postRefundCall;   // update


    /* runs a charge, through Stripe

      @param cc_num - the credit card number, as string
      @param cc_cvc -  cvc code, as string
      @param cc_exp_mon - 2 digit string with expiration month
      @param cc_exp_yr - 2 or 4 digit string with expiration year
     */
    function charge(cc_num, cc_cvc, cc_exp_mon, cc_exp_yr) {

        function rejected(s) {
            var e = new Error(s);
            return Promise.reject(e);
        }
        if (arguments.length < 4)
            return rejected('too few arguments provided to charge');
        if (!cc_num || cc_num.length < 16)
            return rejected('invalid credit-card number provided to charge');
        if (!cc_exp_mon || cc_exp_mon.length < 2)
            return rejected('invalid month argument provided to charge');
        if (!cc_exp_yr || cc_exp_yr.length < 2)
            return rejected('invalid year argument provided to charge');

        // create request_hook, to create charge query from data query
        //
        var make_query = function(this_) {

            var namedParams = this_.finalToSend.namedParams || {};

            var postcall = (namedParams.postcall || postCall),
                errcall = (namedParams.errcall || errCall);

            var subquery = this_.extract_query();

            this_.finalToSend.q = stripeChargeQuery;
            this_.finalToSend.namedParams = {

                '_sourcequery': subquery,
                '_postcall': Rdbhost.util.fixed(postcall),
                '_errcall': Rdbhost.util.fixed(errcall),

                'cc_num': cc_num,
                'cc_cvc': cc_cvc,
                'cc_exp_mon': cc_exp_mon,
                'cc_exp_yr': cc_exp_yr
            };
        };

        // Add this function to request-hooks, to be applied just
        //  before sending to server
        this.add_hook_pair(make_query, undefined, 'charge', 0.1);

        this.proxy('charge');

        this.finalToSend = Object.create(this);

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
                else if (errCode === 'rdb81') {

                    return Rdbhost.admin.apikey_dialog()
                        .then(Rdbhost.admin.insert_apikey_sql);
                }

                else {
                    throw e;
                }
            });
    }

    /* refunds a charge, through Stripe
         there are no parameters, as the .query() is expected to provide charge id and amount

     */
    function refund() {

        function rejected(s) {
            var e = new Error(s);
            return Promise.reject(e);
        }

        // create request_hook, to create charge query from data query
        //
        var make_query = function(this_) {

            var namedParams = this_.finalToSend.namedParams || {};

            var postcall = (namedParams.postcall || postRefundCall),
                errcall = (namedParams.errcall || errRefundCall);

            var subquery = this_.extract_query();

            this_.finalToSend.q = stripeRefundQuery;

            this_.finalToSend.namedParams = {

                '_sourcequery': subquery,
                '_postcall': Rdbhost.util.fixed(postcall),
                '_errcall': Rdbhost.util.fixed(errcall)
            };
        };

        // Add this function to request-hooks, to be applied just before sending to server
        // this.request_hooks.push(f);
        this.add_hook_pair(make_query, undefined, 'charge', 0.1);

        this.proxy('charge');

        return this.get_data();
    }

    function add_charge_and_refund(ro) {
        ro.charge = charge;
        ro.refund = refund;
        return ro;
    }

    /* extend Rdbhost request objects to add Charge specific functions

     */
    window.Rdbhost.Charge = Rdbhost.extendObject(window.Rdbhost, {

        preauth: function(rdgw, rdgh) {
            var o = this._parent.preauth(rdgw, rdgh);
            return add_charge_and_refund(o);
        },
        auth: function(authcode, rdgw, rdgh) {
            var o = this._parent.auth(authcode, rdgw, rdgh);
            return add_charge_and_refund(o);
        },
        reader: function() {
            var o = this._parent.reader(rdgw, rdgh);
            return add_charge_and_refund(o);
        },
        super: function(authcode, rdgw, rdgh) {
            var o = this._parent.super(authcode, rdgw, rdgh);
            return add_charge_and_refund(o);
        }
    });


}(window));


(function(window) {


    /* supervisory functions that handle setup
     *
     */

    var createApiKey = '\
    -- create table auth.apikeys to hold API keys \n\
    --   \n\
    CREATE TABLE auth.apikeys ( \n\
       service VARCHAR(10), \n\
       apikey VARCHAR(100), \n\
       webmaster_email VARCHAR(150) NULL, \n\
       account_email VARCHAR(150) \n\
    );';

    /* add_apikey_table - create the apikey table
     */
    function add_apikey_table() {

        return Rdbhost.super()
                .query(createApiKey)
                .get_data();
    }

    var createChargesTable = '\
    -- create table to hold result codes of successful \n\
    --  charges \n\
    CREATE TABLE public.charges ( \n\
       tstamp TIMESTAMP WITH TIME ZONE NULL, \n\
       amount DECIMAL, \n\
       idx VARCHAR(10), \n\
       id VARCHAR(100), \n\
       fee DECIMAL, \n\
       paid BOOLEAN, \n\
       refunded BOOLEAN, \n\
       last4 VARCHAR(4), \n\
       error VARCHAR(150) \n\
    );';

    /* create_charges_table - create the charges table, to store successful charges in
     */
    function create_charges_table() {

        return Rdbhost.super()
            .query(createChargesTable)
            .get_data();
    }

    var addApiKey = "\
     -- create and invoke temporary function to add a new API key to \n \
     --  auth.apikeys table. \n \
     CREATE FUNCTION pg_temp.t(_apikey VARCHAR, _acct_email VARCHAR) \n\
     RETURNS void \n\
         AS $$ \n\
     BEGIN \n\
         UPDATE auth.apikeys SET service='stripe', apikey=_apikey, webmaster_email='', \n\
                              account_email=_acct_email \n\
              WHERE service = 'stripe'; \n\
         IF NOT FOUND THEN \n\
             INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \n\
                              VALUES('stripe', _apikey, '', _acct_email); \n\
         END IF; \n\
     END; \n\
     $$ LANGUAGE plpgsql; \n\
     \n\
     SELECT pg_temp.t(%(apikey)s, %(account_email)s);";

    /* insert_apikey_sql - insert apikey into apikeys table

     @param parms - 2-array with apikey and account-email (for stripe account)
     */
    function insert_apikey_sql(parms) {

        var apikey = parms[0], acct_email = parms[1];

        return Rdbhost.super()
            .query(addApiKey)
            .params({'apikey': apikey, 'wm_email': '', 'account_email': acct_email})
            .get_data();
    }

    /* apikey_dialog - get api key and stripe account-email from user, with dialog box
     */
     function apikey_dialog() {

        function on_submit(f, resolve) {
            var eml = f.querySelector("input[name='email']"),
                apikey = f.querySelector("input[name='apikey']");
            resolve([apikey.value, eml.value]);
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