#rdbhost_emailing

This module adds three methods to the Rdbhost connection objects, 'email' and 'email_host' and 'email_user'.

The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdbhost-emailing.js"></script>

A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdbhost-emailing.js');

To use the rdbhost-emailing module, you need an account on one of the emailing web services.  

Emailing

To send an email, you use the query and one of the email methods. 

Look at an example:

    var spr = Rdbhost.preauth()
          .query("SELECT body FROM lookup.emails; ")
          .email_host({'from': 'David', 'from_email': 'dkeeney@rdbhost.com'});

    spr.then(function(d) {
       alert('email sent successfully');
    })

The server sends one email for each row returned by the query.

These methods return promises. Each promise resolves with a list of rows that indcate SUCCESS or error for each email attempt.

The first time you run this query, the library will have you confirm the white-listing of the query.


