


#Rdbhost Authenticate

This module adds two methods to the RdbHost connection objects, `fedauth_login` and `confirm_fedauth_login`.

The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2-authenticate.js"></script>

A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdb2-authenticate.js');

##Third Party Logins

To use third party logins in the rdb2-authenticate module, you need to setup an account on each authentication providers you choose to use.  _Twitter_, _Facebook_, and _Google_ all support federated identity.

Have the `client_key` and `client_secret` data available from the setup.


The `confirm_fedauth_login` method should be called in the startup code for the app, so it runs when the page loads.  It returns a promise that resolves if the page load is the final step of the user's login.   

    var liProm = Rdbhost.confirm_fedauth_login();

    liProm.then(function(userData) {
        if (userData.status === 'loggedin') {
            app.user = userData.identifer;
            app.key = userData.key;
        }
        else
            throw new Error('login status: '+userData.status);
    })

The `fedauth_login` method is called when the user indicates an intention to login.

    $('#twitter-login').click(function(e) {
        Rdbhost.fedauth_login('Twitter', window.origin);
        // this function never returns.
    })


When the `fedauth_login` method is first exercised, it will interactively populate the server-side fedauth provider table through a web form.  You will need the `client_key` and `client_secret` for this.


##Password Logins

To use password logins, register users with one of `register_password_login` or `register_login_with_email`, and then log them into a session with `password_login`.

The `register_login_with_email` accepts one parameter with the user's email address, and it sends an email to that user containing a random password.

    var email = $('#email').val();
    var p = register_login_with_email(email);
    return p.then(function(d) {
         // user should check email for mailed password.
      })
      .catch(function(e) {
        // e.message will be a 5 digit code and a message, conveying error such as invalid address
        console.log(e.message)
      });

The `register_password_login` simply puts the provided userid and password (encrypted) into the user table.

    var userid = $('#userid').val(),
        password = $('#password').val();
    var p register_password_login(userid, password);
    return p.then(function(d) {
         // user can login now
       })
      .catch(function(e) {
        // e.message will be a 5 digit code and a message
        console.log(e.message)
      });
 

... and `password_login` just checks the account table for this userid, password pair.

    var userid = $('#userid').val(),
        password = $('#password').val();
    var p = password_login(userid, password);
    return p.then(function(userData) {
         app.user = userData.identifer;
         app.key = userData.key;
       })
      .catch(function(e) {
        // e.message will be a 5 digit code and a message
        console.log(e.message)
      });

     
When either of the register methods is first exercised, it will create the necessary server-side tables, other than `fedauth_accounts`.  You must enable Federated Identity logins in order to use this module, even if you only use password logins.  The user account entries are stored in the `auth.fedauth_accounts` table, using 'PasswordLogin' as the Issuer value.   The passwords are stored in their own table `account_passwords`.  

Login failures are stored, and logins will be blocked after 5 failures per minute per ip.  Blocking just means that the login fails without checking the password, returning error 'rdb77'.

