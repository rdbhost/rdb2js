
(function(window) {

    var stripeQuery =   "SELECT a.apikey AS apikey, \n"+
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
                        "   FROM auth.apis a, ({{sourcequery}}) AS _sq \n"+
                        "  WHERE a.service = 'stripe';",

        postCall =  'INSERT INTO "charges" (idx, id, user, amt) VALUES({idx}, {id}, {user}, {amt})', // update
        errCall =  'INSERT INTO "charges" (idx, id, user, code) VALUES({idx}, 0, {user}, {code})';   // update


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

            var postcall = this_.namedParams.postcall || postCall,
                errcall = this_.namedParams.errcall || errCall;
            delete this_.namedParams.postcall;
            delete this_.namedParams.errcall;
            this_.q = this_.q.replace(/;$/, '');

            this_.qPlus = stripeQuery.replace('{{postcall}}', postcall).replace('{{errcall}}', errcall)
                                .replace('{{sourcequery}}', this_.q);
            /*var fD = this_.formData;
            fD.append('arg:cc_num', cc_num);
            fD.append('arg:cc_cvc', cc_cvc);
            fD.append('arg:cc_exp_mon', cc_exp_mon);
            fD.append('arg:cc_exp_yr', cc_exp_yr);
            */
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

        this.proxy('charge');

        var p = this.go();
        return p.then(function (d) {
                return d;
            })
            .catch(function (e) {
                if (e.message.substr(0, 5) === '42P01') {
                    var m = /relation "([^"]+)" does not exist/.exec(e.message.substr(6));
                    if (m) {
                        var missing_tablename = m[1];
                        return Rdbhost.admin.add_table(missing_tablename);
                    }
                }
            });
    }

    /* refunds a charge, through Stripe

     */
    function refund(cc_num, cc_cvc, cc_exp_mon, cc_exp_yr, user_key) {

    }


    /* extend Rdbhost request object to add Charge specific functions

     */
    window.Rdbhost.extend_request_prototype({

        charge: charge,
        refund: refund

    });


}(window));


(function(window) {

    /* supervisory functions that handle setup
     *
     */
    function add_apikey_table() {
        null === null;
    }

    /* extend Rdbhost object to add Charge specific functions

     */
    window.Rdbhost = window.Rdbhost || {};
    window.Rdbhost.admin = _.extend(window.Rdbhost.admin || {}, {

        'add_table': function(tablename) {
                if (tablename === 'auth.apis') {
                    return add_apikey_table()
                }
                else {
                    throw new Error('unrecognized tablename passed to add_table ~1'.replace('~1', tablename));
                }
            }
    })

}(window));