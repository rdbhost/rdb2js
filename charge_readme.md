


rdbhost_charge


This module adds two methods to the Rdbhost connection objects,  'charge' and 'refund'.


The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2-charge.js"></script>


A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdb2-charge.js');


To use the rdbhost-charge module, you need an account on Stripe.com.  Use the sandbox codes to 
test your app using the rdbhost-charge.js code.   Go to the Stripe.com website and setup an account.  Have 
the account authorization data available.


To run a charge, you use the .query() and the .charge() methods.   The sql you provide to .query() will provide
the 'amount' and the 'idx' in fields of those names.   The charge method takes paramaters for the credit card data.

Look at an example:

    var spr = Rdbhost.super()
              .query('SELECT .....')
              .charge(cc_num, cc_exp_mon, cc_exp_yr, cc_cvc);
              
              


