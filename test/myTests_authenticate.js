
var domain;
PASSWORD = undefined;
SUPER_AUTH = get_super_auth(privat.getItem('acct_number'), privat.getItem('demo_email'), privat.getItem('demo_pass'));

domain = privat.getItem('domain');
acct_number = parseInt(privat.getItem('acct_number'), 10);
demo_email = privat.getItem('demo_email');
demo_pass = privat.getItem('demo_pass');

demo_postmark_key = privat.getItem('demo_postmark_key');
demo_postmark_email = privat.getItem('demo_postmark_email');

PREAUTH_ROLENAME = 'p00000000'+acct_number;


var MOCK_AUTH = Object.create(Rdbhost.Authenticate);
MOCK_AUTH._redirect = function(loc) {
    throw new Error('test-mode '+location);
};


function make_roleid(role, acct) {
    var acctStr = '000000000' + acct;
    return role.substr(0,1).toLowerCase() + acctStr.substr(acctStr.length-10,10);
}

function build_href(srch) {
    var url = document.createElement('a');
    url.href = window.location.href;
    // url.pathname = '/latest/test/test_runner_authenticate.html';
    url.search = srch || '?dun=1';
    return url.href;
}


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


function submit_preauth_form() {

    var frm = document.getElementById('partial-preauth-auth');
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

function do_super_async_query_list(assert, qs) {

    var done = assert.async();

    function _do() {

        if ( qs.length === 0 ) {
            done();
            return;
        }

        var q = qs.shift();

        Rdbhost.once('form-displayed', function() {

            setTimeout(function() {
                submit_superauth_form();
            }, 100)
        });

        var supr = Rdbhost.super().query(q)
            .get_data();
        supr.then(function(r) {
                return _do();
            },
            function(e) {
                return _do();
            });
    }

    return _do();
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

    var url = build_href('?dun=1');
    var li = Rdbhost.Authenticate.fedauth_login('Oauthtest', url);

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

        Rdbhost.paranoid_confirm = false;
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

    var url = build_href('?dun=1');

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

    var li = Rdbhost.Authenticate.fedauth_login('Twitter', url);

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

    var url = build_href('?dun=1');

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

    var li = MOCK_AUTH.fedauth_login('Twitter', url);

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

    var url = build_href('?dun=1');


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

    var li = Rdbhost.Authenticate.fedauth_login('Twitter', url);

    li.then(function(e) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('n dialog can')>-1, 'dialog cancelled');
            done();
        });


});



module('Password Tests - no-table', {

    beforeEach: function (assert) {

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;

        Rdbhost.connect(privat.getItem('domain'), acct_number);
        Rdbhost.use_labjs_loader($LAB);

        var qs = [
     'DROP TABLE IF EXISTS auth.account_passwords_temp; ',
     'ALTER TABLE auth.account_passwords RENAME TO account_passwords_temp; ',
     'DROP TABLE IF EXISTS auth.login_fails; ',
     'DROP FUNCTION IF EXISTS auth.password_login(character varying, character varying, inet) CASCADE;'];

        do_super_async_query_list(assert, qs);
    },

    afterEach: function (assert) {

        var qs = [
    'DROP TABLE IF EXISTS auth.account_passwords; ',
    'ALTER TABLE auth.account_passwords_temp RENAME TO account_passwords; ',
    'DROP TABLE IF EXISTS auth.login_fails; ',
    'DROP FUNCTION IF EXISTS auth.password_login(character varying, character varying, inet) CASCADE;'];

        do_super_async_query(assert, qs);
    }
});


// check that no-table situation is handled correctly
//
QUnit.test('pw login  ', function(assert) {

    var done = assert.async();

    var li = Rdbhost.Authenticate.password_login('me', 'abcd');

    li.then(function(e) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('nolgn')==0, 'user not-found error');
            done();
        });


});


module('Password Tests - table', {

    beforeEach: function (assert) {

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;

        Rdbhost.connect(privat.getItem('domain'), acct_number);
        Rdbhost.use_labjs_loader($LAB);

        var qs = [
    'DROP TABLE IF EXISTS auth.account_passwords_temp; ',
    'ALTER TABLE auth.account_passwords RENAME TO account_passwords_temp; ',
    'CREATE TABLE auth.account_passwords ( '+
    '  idx INTEGER REFERENCES auth.fedauth_accounts (idx), ' +
    '  password VARCHAR(150) ' +
    '); ',
    'GRANT SELECT, UPDATE, INSERT, DELETE ON auth.account_passwords TO {0}; '.replace('{0}', Rdbhost.roleid('p')),
    'DELETE FROM auth.fedauth_accounts WHERE identifier = \'me\' AND issuer = \'LocalPassword\';',
    'DELETE FROM auth.account_passwords;',
    'DELETE FROM auth.account_passwords_temp;',
    'DELETE FROM auth.fedauth_accounts WHERE issuer = \'LocalPassword\';',
    'DELETE FROM lookup.preauth_queries WHERE query LIKE \'%%INSERT INTO auth.fedauth_accounts%%\'; ',
    'DROP FUNCTION IF EXISTS auth.password_login(character varying, character varying, inet) CASCADE;',
    'DROP FUNCTION IF EXISTS auth.register_with_email(character varying) CASCADE;'  ];

        do_super_async_query_list(assert, qs);
    },

    afterEach: function (assert) {

        var qs = [
     'DROP TABLE IF EXISTS auth.account_passwords; ',
     'ALTER TABLE auth.account_passwords_temp RENAME TO account_passwords; ',
     'DELETE FROM auth.fedauth_accounts WHERE issuer = \'LocalPassword\';',
     'DELETE FROM auth.login_fails;' ];

        do_super_async_query_list(assert, qs);
    }
});


// check that empty-table situation is handled correctly
//
QUnit.test('pw login fail ', function(assert) {

    var done = assert.async();

    var li = Rdbhost.Authenticate.password_login('me', 'abcd');

    li.then(function(d) {
            ok(false, 'should not succeed');
            done();
        },
        function(e) {
            ok(e.message.indexOf('nolgn')==0, 'user not-found error');
            done();
        });
});


// check that empty-table situation is handled correctly
//
QUnit.test('pw login too-many-tries fail ', function(assert) {

    var done = assert.async(),
        fails = [], li;

    for (var i=0; i<10; i++) {

        li = Rdbhost.Authenticate.password_login('me', 'abcd---').catch(function(e) { return true; });
        fails.push(li);
    }

    Promise.all(fails).then(function(d) {

            li = Rdbhost.Authenticate.password_login('me', 'abcd---');
            li.then(function(d) {

                    ok(false, 'should not happen');
                })
                .catch(function(e) {

                    ok(e.message.indexOf('rdb77') >=0, 'rdb77 received');
                    done();
                });
        },
        function(e) {
            ok(e.message.indexOf('nolgn')==0, 'user not-found error');
            done();
        });
});


// check that password registration is handled correctly
//
QUnit.test('pw registration ', function(assert) {

    var done = assert.async();

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            submit_preauth_form();
        }, 100)
    });

    var li = Rdbhost.Authenticate.register_password_login('me', 'abcd');

    li.then(function(d) {
            ok(d.result_sets[2].records.rows[0].identifier === 'me', 'identifier found');
            ok(d.result_sets[2].records.rows[0].key.length > 15, 'key looks ok');
            done();
        },
        function(e) {
            ok(false, 'should not happen');
            done();
        });
});


// check that password registration can be logged=in to
//
QUnit.test('pw registration and login ', function(assert) {

    var done = assert.async();

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            submit_preauth_form();
        }, 100)
    });

    var reg = Rdbhost.Authenticate.register_password_login('me', 'abcd');

    reg.then(function(d) {
            ok(d.result_sets[2].records.rows[0].identifier === 'me', 'identifier found');
            ok(d.result_sets[2].records.rows[0].key.length > 15, 'key looks ok');
            var key0 = d.result_sets[2].records.rows[0].key;

            var li = Rdbhost.Authenticate.password_login('me', 'abcd');
            li.then(function(d) {

                    ok(d.identifier == 'me', 'identifier should be me == '+d.identifier);
                    ok(d.key == key0, 'keys match {0} == {1}'.replace('{0}', d.key).replace('{1}', key0));
                    done();
                })
                .catch(function(e) {
                    ok(false, 'should not happen');
                    done();
                });
        },
        function(e) {
            ok(false, 'should not happen');
            done();
        });
});


function submit_service_form() {

    setTimeout(function() {

        var frm = document.getElementById('partial-service'),
            eml = frm.querySelector("input[name='account_email']"),
            key = frm.querySelector("input[name='apikey']"),
            sub1 = frm.querySelector("input[type='submit']");

        eml.value = demo_postmark_email;
        key.value = demo_postmark_key;

        sub1.click();
    }, 300);
}


// check that password registration can be logged=in to
//
QUnit.test('registration with email ', function(assert) {

    var done = assert.async();

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            submit_preauth_form();
        }, 100)
    });

    Rdbhost.Email.email_config('dev.rdbhost.com', 'me@rdbhost.com', 'postmark');

    Rdbhost.on('form-displayed', function() {
        setTimeout(function() {

            submit_service_form();
        }, 1500);
    });

    var reg = Rdbhost.Authenticate.register_login_with_email('abc@travelbyroad.net');

    reg.then(function(d) {
            ok(d.result_sets[0].records.rows[0].result === 'Success', 'identifier found');
            done();
        },
        function(e) {
            ok(false, 'should not happen '+e.message);
            done();
        });

});


/*
*
*/
