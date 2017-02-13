
var domain;
PASSWORD = undefined;
SUPER_AUTH = get_super_auth(privat.getItem('acct_number'), privat.getItem('demo_email'), privat.getItem('demo_pass'));

domain = privat.getItem('domain');
acct_number = parseInt(privat.getItem('acct_number'), 10);
demo_email = privat.getItem('demo_email');
demo_pass = privat.getItem('demo_pass');

PREAUTH_ROLENAME = 'p00000000'+acct_number;


function submit_superauth_form() {

    var frm = document.getElementById('partial-super-auth');
    if (!frm)
        return;

    var eml = frm.querySelector("input[name='email']"),
        pw = frm.querySelector("input[name='password']"),
        sub = frm.querySelector("input[type='submit']");

    eml.value = demo_email;
    pw.value = demo_pass;
    sub.click();
}


function cancel_form(id) {

    var frm = document.getElementById(id);

    if (!frm)
        return;

    var cncl = frm.querySelector("span.cancel");
    cncl.click();
}


function do_super_async_query(assert, q) {

    var done = assert.async();

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            submit_superauth_form();
        }, 100)
    });

    var supr = Rdbhost.super().query(q)
        .get_data();
    supr.then(function(a, b) {
            done();
        },
        function(a, b) {
            done();
        });

}

module('Fedauth no-table Test', {

    beforeEach: function (assert) {

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;

        Rdbhost.connect(privat.getItem('domain'), acct_number);
        Rdbhost.use_labjs_loader($LAB);

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers_temp; \
                 ALTER TABLE auth.fedoauth_providers RENAME TO fedoauth_providers_temp; ';

        do_super_async_query(assert, q);
    },
    
    afterEach: function (assert) {

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers; \
                 ALTER TABLE auth.fedoauth_providers_temp RENAME TO fedoauth_providers; ';

        do_super_async_query(assert, q);
    }
});


// check that no-table situation is handled correctly
//
QUnit.test('test ', function(assert) {

    var done = assert.async();

    var url = document.createElement('a');
    url.href = "/";
    url.pathname = '/rdb2js/test/test_runner_authenticate.html';
    url.search = '?dun=1';
    var li = Rdbhost.Authenticate.fedauth_login('Oauthtest', url.href);

    li.then(function(e) {
            ok(false, 'should not succeed');
           done();
        },
        function(e) {
            ok(e.message.indexOf('42P01')>-1, 'table not-found error');
            done();
        });


});


module('Fedauth no-twitter Test', {

    beforeEach: function (assert) {

        Rdbhost.connect(privat.getItem('domain'), acct_number);
        Rdbhost.use_labjs_loader($LAB);

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers_temp; \
                 ALTER TABLE auth.fedoauth_providers RENAME TO fedoauth_providers_temp; \
                 CREATE TABLE auth.fedoauth_providers (LIKE auth.fedoauth_providers_temp INCLUDING INDEXES); \
                 GRANT SELECT ON auth.fedoauth_providers TO global_reader; \
                 GRANT SELECT ON auth.fedoauth_providers TO ' + PREAUTH_ROLENAME + '; \
                 INSERT INTO auth.fedoauth_providers SELECT * FROM auth.fedoauth_providers_temp; \
                 DELETE FROM auth.fedoauth_providers WHERE provider = \'Twitter\'';

        do_super_async_query(assert, q);
    },

    afterEach: function (assert) {

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers; \
                 ALTER TABLE auth.fedoauth_providers_temp RENAME TO fedoauth_providers; ';

        do_super_async_query(assert, q);
    }
});


// check that no-twitter record shows fedauth form
//
QUnit.test('test 1', 3, function(assert) {

    var done = assert.async();

    var url = document.createElement('a');
    url.href = "/";
    url.pathname = '/rdb2js/test/test_runner_authenticate.html';
    url.search = '?dun=1';

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-fedauth');
            if (!frm)
                return;
            ok(frm, 'partial-fedauth form displayed');
            ok(frm.outerHTML.indexOf('Twitter')>-1, 'Twitter label found');

            cancel_form('partial-fedauth');
        }, 100)
    });

    var li = Rdbhost.Authenticate.fedauth_login('Twitter', url.href);

    li.then(function(e) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('n dialog can')>-1, 'dialog cancelled');
            done();
        });


});


// check that completing fedauth form results in login redirect
//
QUnit.test('test 2', 3, function(assert) {

    var done = assert.async();

    var url = document.createElement('a');
    url.href = "/";
    url.pathname = '/rdb2js/test/test_runner_authenticate.html';
    url.search = '?dun=1';

    Rdbhost.in_test_mode = true;

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-fedauth');
            if (!frm)
                return;

            ok(frm, 'partial-fedauth form displayed');
            ok(frm.outerHTML.indexOf('Twitter')>-1, 'Twitter label found');

            frm.querySelector("input[name='client_key']").value = 'abcdef';
            frm.querySelector("input[name='client_secret']").value = 'abcdef0123456789';

            var sub = frm.querySelector("input[type='submit']");
            sub.click();

        }, 100)
    });

    var li = Rdbhost.Authenticate.fedauth_login('Twitter', url.href);

    li.then(function(e) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('test-mode http')>-1, 'redirect blocked by test-mode');

            done();
        });


});


module('Fedauth no-twitter keys Test', {

    beforeEach: function (assert) {

        Rdbhost.connect(privat.getItem('domain'), acct_number);
        Rdbhost.use_labjs_loader($LAB);

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers_temp; \n' +
                'ALTER TABLE auth.fedoauth_providers RENAME TO fedoauth_providers_temp; \n' +
                'CREATE TABLE auth.fedoauth_providers (LIKE auth.fedoauth_providers_temp INCLUDING INDEXES); \n' +
                '-- global_reader needs priv for access by servers authentication processing, and p-role needs \n' +
                '--  access for tests coming from this library. \n' +
                'GRANT SELECT ON auth.fedoauth_providers TO global_reader; \n' +
                'GRANT SELECT ON auth.fedoauth_providers TO '+ PREAUTH_ROLENAME + '; \n' +
                'INSERT INTO auth.fedoauth_providers SELECT * FROM auth.fedoauth_providers_temp; \n' +
                'UPDATE auth.fedoauth_providers SET client_key=\'\', client_secret=\'\' WHERE provider = \'Twitter\'';

        do_super_async_query(assert, q);
    },

    afterEach: function (assert) {

        var q = 'DROP TABLE IF EXISTS auth.fedoauth_providers; \
                 ALTER TABLE auth.fedoauth_providers_temp RENAME TO fedoauth_providers; ';

        do_super_async_query(assert, q);
    }
});


// check that no-keys in twitter record shows fedauth form
//
QUnit.test('test 1', 3, function(assert) {

    var done = assert.async();

    var url = document.createElement('a');
    url.href = "/";
    url.pathname = '/rdb2js/test/test_runner_authenticate.html';
    url.search = '?dun=1';

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-fedauth');
            if (!frm)
                return;
            ok(frm, 'partial-fedauth form displayed');
            ok(frm.outerHTML.indexOf('Twitter')>-1, 'Twitter label found');

            cancel_form('partial-fedauth');
        }, 100)
    });

    var li = Rdbhost.Authenticate.fedauth_login('Twitter', url.href);

    li.then(function(e) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('n dialog can')>-1, 'dialog cancelled');
            done();
        });


});



/*
*
*/
