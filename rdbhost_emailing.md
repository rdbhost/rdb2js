#rdbhost_emailing

This module adds three methods to the Rdbhost connection objects, 'email' and 'email_host' and 'email_user'.

The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdbhost-emailing.js"></script>

A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdbhost-emailing.js');

To use the rdbhost-emailing module, you need an account on one of the emailing web services.  

Emailing

To run a charge, you use the query and the charge methods. The sql you provide to .query() will provide the 'amount', 'description' and the 'idx' in fields of those names. The charge method takes parameters for the credit card data. The idx value is nominally unique, and is returned in the results.

Look at an example:

    var spr = Rdbhost.preauth()
          .query("SELECT MIN(ordernum) AS idx, SUM(price) AS amount, 'purchase' AS description \
                        FROM cart WHERE ordernum = %(order)s; ")
          .params({'order': order_num})
          .email();

    spr.then(function(d) {
       alert('email sent successfully');
    })

The server sends one email for each row returned by the query.

These methods return promises. Each promise resolves with a list of rows that indcate SUCCESS or error for each row/charge attempt.

The first time you run this query, the library will have you confirm the white-listing of the query, and will at some point create a table to hold the Stripe.com API keys, and present a form to you for you to provide (via cut and paste) the API key for insertion into the new table.


var spr = Rdbhost.preauth()
          .query("SELECT MIN(ordernum) AS idx, SUM(price) AS amount \
                    FROM cart WHERE ordernum = %(order)s; ")
          .params({'order': order_num,
                   'postcall': 'INSERT INTO chg_table (idx, id) VALUE({idx}, {id});'})
          .charge(cc_num, cc_exp_mon, cc_exp_yr, cc_cvc);
