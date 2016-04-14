
var domain;
PASSWORD = undefined;
SUPER_AUTH = undefined;



// todo - add test to verify interactive Provider additions


module('Fedauth providers prepare Test', {


    beforeEach: function (assert) {
        Rdbhost.connect('dev.rdbhost.com', 14);

        var done = assert.async();

        var supr = Rdbhost.super().query('DELETE FROM auth.fedoauth_providers WHERE provider = \'Oauthtest\';')
                  .get_data();
        supr.then(done, done);
        Rdbhost.use_labjs_loader($LAB);
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
    url.pathname = '/rdb2js/test/test_runner_authenticate.html';
    url.search = '?dun=1';

    var p = Rdbhost.fedauth_login('Oauthtest', url.href);
    p.then(function() {
            done();
        })
        .catch(function() {
            done();
        })
});


/*
*
*/
