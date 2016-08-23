#rdbhost_emailing

This module adds three methods to the Rdbhost connection objects, 'email' and 'email_host' and 'email_user'.

The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdbhost-emailing.js"></script>

A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdbhost-emailing.js');

To use the rdbhost-emailing module, you need an account on one of the emailing web services.  

Emailing

To send an email, you use one of the email methods, and optionally the query method. The email methods are `email`, 
`email_host`, and `email_user`;


Emailing Methods:

    email(from, from_email, to, to_email, subject, body, body_html, attachments);
    
    email_host(from, from_email, subject, body, body_html, attachments);
    
    email_user(to, to_email, subject, body, body_html, attachments);



These methods are on the connection object.

'attachments' is undefined or an object, where attribute names are file names, and attribute bodies are the file bodies.  The other parameters are strings or undefined.  The 'to_email', 'from_email', 'subject' fields are required.


Configuration Methods:

    email_config(host, host_email, service)
    
'service' is 'postmark', 'sendgrid', or 'mailgun' for the webservice you are using. 
The 'host' and 'host_email' are a name and email-address for the `email_host` method.



Parameter Methods:

    column_wrapper(column_name)
    fixed_wrapper(string)
    
    
Explaining these parameter methods takes some context.  If you just pass strings as parameters to the emailing methods,
the email method creates an SQL query with each value parameterized.  The query gets a token inlined, and the value is passed as an argument.  

Sometimes you want the value itself inlined, so the value becomes part of the whitelisted query.  If you wrap the value in the `fixed_wrapper` method, the value gets interpolated into the query instead of being parameterized.  

Sometimes the values for the fields come from a database, rather than as literals.  The SQL passed in the .query() method will retrieve the values, and each value included in the email using `column_wrapper` method wrapping the column name.

When using the .query() method, the query can return multiple records, which will result in multiple emails.  Each record must include an 'idx' field.  The idx field should be unique per record, so you can identify which result row results from each record.    

Look at an example:

    Rdbhost.email_config('President', 'pres@example.net', 'postmark');
    
    var spr = Rdbhost.preauth()
          .query("SELECT 1 AS idx, body FROM lookup.emails; ")
          .email_host('David', 'dkeeney@rdbhost.com', 'title', Rdbhost.column_wrapper(body));

    spr.then(function(d) {
       alert('email sent successfully');
    })

The server sends one email for each row returned by the query.

These methods return promises. Each promise resolves with a list of rows that indcate SUCCESS or error for each email attempt.

The first time you run each query as `preauth`, the library will have you confirm the white-listing of the query.



