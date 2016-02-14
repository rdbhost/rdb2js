
(function(window) {


    /* Field_wrap just wraps a field-name to make it distinguishable from a literal string
     */
    function Field_wrap(field_name) {

        this.toString = function() {
            return field_name;
        }
    }

    /* field_wrapper - a factory function to wrap a field name
     */
    function field_wrapper(field_name) {

        return new Field_wrap(field_name);
    }

    /* runs a charge, through Stripe

     */
    function charge(cc_num, cc_cvc, cc_exp_mon, cc_exp_yr, user_key) {

        var q = "SELECT keytable.apikey AS apikey, \n"+
                "        'stripe' AS service, \n"+
                "        'charge' AS action, \n"+
                "        amount AS amount, \n"+
                "        %(cc_num)s AS cc_num, \n"+
                "        %(cc_cvc)s AS cc_cvc, \n"+
                "        %(cc_exp_mon)s AS cc_exp_mon, \n"+
                "        %(cc_exp_yr)s AS cc_exp_yr, \n"+
                "        'usd' AS currency, \n"+
                "        idx AS idx, \n"+
                "        'INSERT INTO \"charges\" (idx, id, user, amt) VALUES({idx}, {id}, %(user)s, {amt})' AS postcall, \n"+ // update
                "        'INSERT INTO \"charges\" (idx, id, user, code) VALUES({idx}, 0, %(user)s, {code})' AS errcall \n"+      // update
                "   FROM keytable";

        // this query is joined to another (custom) query to produce complete query

        // the joining is to be in a request-hook
    }

    /* refunds a charge, through Stripe

     */
    function refund(cc_num, cc_cvc, cc_exp_mon, cc_exp_yr, user_key) {

    }


        /* extend Rdbhost request object to add Charge specific functions

         */
    window.Rdbhost.extend_request_prototype({

        charge: charge,
        refund: refund,

        field_wrapper: field_wrapper
    });


}(window));


(function(window) {

    /* supervisory functions that handle setup
     *
     */


    /* extend Rdbhost object to add Charge specific functions

     */
    window.Rdbhost = _.extend(window.Rdbhost || {}, {

    })

}(window));