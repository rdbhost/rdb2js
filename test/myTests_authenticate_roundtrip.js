
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

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        
        Rdbhost.connect(privat.getItem('domain'), acct_number);

        var done = assert.async();

        var supr = Rdbhost.super().query('DELETE FROM auth.fedoauth_providers WHERE provider = \'Oauthtest\';')
                  .get_data();
        supr.then(done, done);
        Rdbhost.use_labjs_loader($LAB);

        Rdbhost.once('form-displayed', function() {
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

        supr.then(
            function() {
                done();
                Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(undefined, 'clean');
                Rdbhost.paranoid_confirm = false;
            },
            function() {
                done();
                Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(undefined, 'clean');
                Rdbhost.paranoid_confirm = false;
            }
        );

    }
});


test('test authenticate setup', function(assert) {

    var done = assert.async();

    if (window.location.search.indexOf('dun') < 0) {

        var url = document.createElement('a');
        url.href = "/";
        // url.pathname = '/V2/rdb2js/test/test_runner_authenticate1.html';
        url.pathname = window.location.pathname;
        url.search = '?dun=1';

        var p = Rdbhost.Authenticate.fedauth_login('Oauthtest', url.href);
        // p.then(done, done);

        Rdbhost.once('form-displayed', function () {
            setTimeout(function () {

                var frm = document.getElementById('partial-fedauth'),
                    key = frm.querySelector("input[name='client_key']"),
                    secret = frm.querySelector("input[name='client_secret']"),
                    sub1 = frm.querySelector("input[type='submit']");

                key.value = 'key';
                secret.value = 'secret';

                sub1.click();

            }, 100)
        })
    }
    else {

        var t = setTimeout(function() { done() }, 1000);

        var p1 = Rdbhost.Authenticate.confirm_fedauth_login();
        p1.then(function(d) {

                ok(true, 'then function called');
                ok(d.identifier == '012345', 'identifier ok '+d.identifier);
                ok(d.issuer == 'Oauthtest', 'issuer ok '+d.issuer);
                ok(d.status == 'loggedin', 'status ok '+d.status);
                clearTimeout(t);
                done();
            })
            .catch(function(e) {
                ok(false, 'error in confirm_fedauth_login ' + e.toString());
                clearTimeout(t);
                done();
            });
    }

});


/*
*
*/
