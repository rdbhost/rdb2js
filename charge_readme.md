


rdbhost_charge


This module adds two methods to the Rdbhost connection objects,  'charge' and 'refund'.


The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2-charge.js"></script>


A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdb2-charge.js');


To use the rdbhost-charge module, you need an account on Stripe.com.  Use the sandbox codes to 
test your app using the rdbhost-charge.js code.   Go to the Stripe.com website and setup an account.  
Have the account authorization data available.

##Charges

To run a charge, you use the query and the charge methods.   The sql you provide to .query() will 
provide the 'amount' and the 'idx' in fields of those names.   The charge method takes parameters 
for the credit card data.  The idx value is nominally unique, and is returned in the results.

Look at an example:

    var spr = Rdbhost.preauth()
              .query("SELECT MIN(ordernum) AS idx, SUM(price) AS amount \
                            FROM cart WHERE ordernum = %(order)s; ")
              .params({'order': order_num})
              .charge(cc_num, cc_exp_mon, cc_exp_yr, cc_cvc);
              
    spr.then(function(d) {
       alert('charge complete successfully');
    })
              
              
The server runs charges for each row returned by the query.   

The charge method returns a promise.  The promise resolves with a list of rows that indcate SUCCESS or error 
for each row/charge attempt.

The first time you run this query, the library will have you confirm the white-listing of the query, and
will at some point create a table to hold the Stripe.com API keys, and present a form to you for you to
provide (via cut and paste) the API key for insertion into the new table.

The library will also create a charges table, to receive the details of each charge and refund.   That 
table is like:

    [idx]   [id]    [paid]  [refunded]  [amount]    [last4]
    
    
If you don't like this charge tracking, feel free to create your own system, and use the postcall and 
errcall parameters to specify SQL to handle each record.


    var spr = Rdbhost.preauth()
              .query("SELECT MIN(ordernum) AS idx, SUM(price) AS amount \
                        FROM cart WHERE ordernum = %(order)s; ")
              .params({'order': order_num, 
                       'postcall': 'INSERT INTO chg_table (idx, id) VALUE({idx}, {id});'})
              .charge(cc_num, cc_exp_mon, cc_exp_yr, cc_cvc);


##Refunds

To run a refund, you use the query and the refund methods.   The sql you provide to .query() will 
provide the 'amount' and the 'id' of the charge in fields of those names.   The 
refund method takes parameters for the credit card data.  The idx value is nominally unique, 
and is returned in the results.

Look at an example:
   
    todo - make a query that gets id from charges table, and calculates refund amount
   
    var spr = Rdbhost.preauth()
              .query("SELECT MIN(ordernum) AS idx, SUM(price) AS amount \
                            FROM cart WHERE ordernum = %(order)s; ")
              .params({'order': order_num})
              .refund();
              
    spr.then(function(d) {
       alert('charge complete successfully');
    })
              
              




