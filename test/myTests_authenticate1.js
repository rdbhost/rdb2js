
var domain;
PASSWORD = undefined;
SUPER_AUTH = undefined;


function submit_superauth_form() {

    var frm = document.getElementById('partial-super-auth'),
        eml = frm.querySelector("input[name='email']"),
        pw = frm.querySelector("input[name='password']"),
        sub = frm.querySelector("input[type='submit']");

    eml.value = demo_email;
    pw.value = demo_pass;
    sub.click();
}



// todo - add test to verify interactive Provider additions


module('Fedauth providers prepare Test', {


    beforeEach: function (assert) {

        domain = private.getItem('domain');
        acct_number = parseInt(private.getItem('acct_number'), 2);
        demo_email = private.getItem('demo_email');
        demo_pass = private.getItem('demo_pass');
        
        Rdbhost.connect('dev.rdbhost.com', 14);

        var done = assert.async();

        var supr = Rdbhost.super().query('DELETE FROM auth.fedoauth_providers WHERE provider = \'Oauthtest\';')
                  .get_data();
        supr.then(done, done);
        Rdbhost.use_labjs_loader($LAB);

        Rdbhost.on('form-displayed', function() {
            setTimeout(function() {

                submit_superauth_form();
            }, 100)
        })

    },

    afterEach: function (assert) {

        var done = assert.async();

        var supr = Rdbhost.super().query(
            "INSERT INTO auth.fedoauth_providers  " +
            "       (provider, version, client_key, client_secret, redirect, mode, req_token_url, " +
            "        auth_base_url, access_token_url, profile_url, identifier_key, email_key) " +
            "VALUES('Oauthtest', '1', 'key', 'secret', '/auth/oauth1/cb', '', " +
            "       'http://oauthbin.com/v1/request-token', '',  'http://oauthbin.com/v1/access-token'," +
            "       'http://oauthbin.com/v1/echo?%%7B%%22email%%22%%3A%%22testuser%%40here.now%%22%%2C%%22id%%22%%3A%%22012345%%22%%7D'," +
            "       'id', 'email');").get_data();

        supr.then(done, done);

        Rdbhost.disconnect(1000, '');
    }
});


test('test authenticate setup', function(assert) {

    ok(true, 'null op');
    done = assert.async();

    var url = document.createElement('a');
    url.href = "/";
    url.pathname = '/rdb2js/test/test_runner_authenticate1.html';
    url.search = '?dun=1';

    var p = Rdbhost.fedauth_login('Oauthtest', url.href);
    p.then(done, done);

    Rdbhost.on('form-displayed', function() {
        setTimeout(function() {

            
        }, 100)
    })
});


/*
*
*/