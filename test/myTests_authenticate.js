
var domain;
PASSWORD = undefined;
SUPER_AUTH = undefined;



module('Fedauth login Test', {


    beforeEach: function () {
        Rdbhost.connect('dev.rdbhost.com', 14);
        Rdbhost.use_labjs_loader($LAB);
    }
});


// send user to authtest, check that login creds are in cookie
//
test('test authenticate login', function(assert) {

    var done = assert.async();

    if (window.location.search.indexOf('dun') < 0) {

        var url = document.createElement('a');
        url.href = "/";
        url.pathname = '/rdb2js/test/test_runner_authenticate.html';
        url.search = '?dun=1';
        Rdbhost.fedauth_login('Oauthtest', url.href);
    }
    else {

        var t = setTimeout(function() { done() }, 1000);

        var p = Rdbhost.confirm_fedauth_login();
        p.then(function(d) {

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
