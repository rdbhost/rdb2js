rdbhost_authenticate

This module adds two methods to the Rdbhost connection objects, `fedauth_login` and `confirm_fedauth_login`.

The traditional way of including it is with a script tag after the rdb2.js script.

    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2.js"></script>
    <script src="http://www.rdbhost.com/vendor/rdbhost/2.0/rdb2-authenticate.js"></script>

A more performant way is to include it in the LABJS config.

    $L = $L.script('/vendor/rdbhost/2.0/rdb2-authenticate.js');

To use the rdbhost-authenticate module, you need to setup an account on the authentication providers you choose to use.  _Twitter_, _Facebook_, and _Google_ all support federated identity.

Have the `client_key` and `client_secret` data available from the setup.


The `confirm_fedauth_login` method should be called in the startup code for the app, so it runs when the page loads.  It returns a promise that resolves if the page load is the final step of the user's login.   

    var liProm = Rdbhost.confirm_fedauth_login();
    
    liProm.then(function(userData) {
        // todo - fill this in
    }

The `fedauth_login` method is called when the user indicates an intention to login.

    $('twitter-login').click(function(e) {
        Rdbhost.fedauth_login('Twitter', window.origin);
        // this function never returns.
    }


When the `fedauth_login` method is first exercised, it will interactively populate the server-side fedauth provider table through a web form.  You will need the `client_key` and `client_secret` for this.

