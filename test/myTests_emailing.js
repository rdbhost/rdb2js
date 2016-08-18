
var domain, demo_email, demo_pass, super_authcode, demo_postmark_key, demo_postmark_email;


var SETUP_OK = false;



function submit_superauth_form() {

    var frm = document.getElementById('partial-super-auth'),
        eml = frm.querySelector("input[name='email']"),
        pw = frm.querySelector("input[name='password']"),
        sub = frm.querySelector("input[type='submit']");

    eml.value = demo_email;
    pw.value = demo_pass;
    sub.click();
}


var dropApiTable = 'DROP TABLE IF EXISTS auth.apikeys;',

    createApiKeyTable = 'CREATE TABLE auth.apikeys ( \n\
                          service VARCHAR(10), \n\
                          apikey VARCHAR(100), \n\
                          webmaster_email VARCHAR(150) NULL, \n\
                          account_email VARCHAR(150) \n\
                        );',

    addApiKey = "CREATE FUNCTION pg_temp.t(_apikey VARCHAR, _acct_email VARCHAR) \n\
                RETURNS void \n\
                    AS $$ \n\
                BEGIN \n\
                    UPDATE auth.apikeys SET service='postmark', apikey=_apikey, webmaster_email='', \n\
                                         account_email=_acct_email \n\
                         WHERE service = 'postmark'; \n\
                    IF NOT FOUND THEN \n\
                        INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \n\
                                         VALUES('postmark', _apikey, '', _acct_email); \n\
                    END IF; \n\
                END; \n\
                $$ LANGUAGE plpgsql; \n\
                \n\
                SELECT pg_temp.t(%(apikey)s, %(account_email)s);";


module('all tables ok', {

    beforeEach: function (assert) {

        SETUP_OK = true;
        Rdbhost.reset_rdbhost();

        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        demo_postmark_key = privat.getItem('demo_postmark_key');
        demo_postmark_email = privat.getItem('demo_postmark_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, createApiKeyTable, addApiKey].join('\n');

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d) {

            super_authcode = d.authcode;

            Rdbhost.once('connection-closed:super', function() {
                done();
            });
            var p = Rdbhost.super(super_authcode)
                .query(q)
                .params({'apikey': demo_postmark_key, 'account_email': demo_postmark_email})
                .get_data();
            p.then(function () {
                    Rdbhost.disconnect(1000, '');
                },
                function (e) {
                    Rdbhost.disconnect(1000, '');
                });
        });
    },
    afterEach: function(assert) {
        SETUP_OK = false;
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                Rdbhost.disconnect(1000, '');
            },
            function(e) {
                Rdbhost.disconnect(1000, '');
            });
    }
});


test('test setup', function(assert) {

    var done = assert.async();

    var s = Rdbhost.super(super_authcode)
        .query("SELECT count(*) FROM auth.apikeys WHERE service = 'postmark';")
        .get_data();

    s.then(function(d) {
            ok(true, 'auth.apikeys found');
            ok(d.result_sets[0].rows[0].count === 1, d.status);
            clearTimeout(t);
            done();
        },
        function(e) {
            ok(false, 'error in SELECT FROM apikeys ' + e.message);
            clearTimeout(t);
            done();
        });

    var t = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 500);

});

// routine operation
//
test('email tests - routine fail', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    Rdbhost.email_config('dev.rdbhost.com', 'rdbhost@rdbhost.com', 'postmark');

    var p = Rdbhost.super()
                    .query("")
                    .email('');  // no valid params provided

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length, 'result sets provided');
            ok(d.result_sets[0].rows.length, 'result sets provided');
            ok(d.result_sets[0].rows[0].result.indexOf('Unprocessable Entity') >= 0, 'Unprocessable string found');
            ok(d.result_sets[0].rows[0].result.indexOf("Invalid 'From' value") >= 0, 'Invalid From string found');

            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            console.log(e);
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        submit_superauth_form();
    }, 800);

    var st = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);
});


// routine operation
//
test('email tests - routine success', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    Rdbhost.email_config('dev.rdbhost.com', 'rdbhost@rdbhost.com', 'postmark');

    var p = Rdbhost.super()
        .query("")
        .email('David', 'rdbhost@rdbhost.com', 'Me', 'dkeeney@travelbyroad.net', 'Test', 'test body');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].result.indexOf('Success') >= 0, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        submit_superauth_form();
    }, 800);

    var st = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);
});


module('apikeys table missing', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        Rdbhost.reset_rdbhost();

        var done = assert.async();

        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        domain = privat.getItem('domain');

        demo_postmark_key = privat.getItem('demo_postmark_key');
        demo_postmark_email = privat.getItem('demo_postmark_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable].join('\n');

        var p0 = get_super_auth(acct_number, demo_email, demo_pass);
        p0.then(function(d) {
            super_authcode = d.authcode;

            Rdbhost.once('connection-closed:super', function() {
                done();
            });
            var p = Rdbhost.super(super_authcode)
                .query(q)
                .get_data();
            return p.then(function() {
                    Rdbhost.disconnect(1000, '');
                },
                function(e) {
                    Rdbhost.disconnect(1000, '');
                });
        })
    },
    afterEach: function(assert) {
        SETUP_OK = false;
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                Rdbhost.disconnect(1000, '');
            },
            function(e) {
                Rdbhost.disconnect(1000, '');
            });
    }
});


test('test setup', function(assert) {

    var done = assert.async();

    var s = Rdbhost.super(super_authcode)
        .query('SELECT * FROM auth.apikeys;')
        .get_data();

    s.then(function(d) {
            ok(false, 'apikeys table found');
            clearTimeout(t);
            done();
        },
        function(e) {
            ok(true, 'error in SELECT FROM auth.apikeys ' + e.message);
            clearTimeout(t);
            done();
        });

    var t = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 500);

});

// routine operation
//
test('email tests - routine', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    Rdbhost.email_config('dev.rdbhost.com', 'rdbhost@rdbhost.com', 'postmark');

    var p = Rdbhost.super()
        .query("")
        .email('');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].row_count[0] === -1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {

        submit_superauth_form();

        setTimeout(function() {

            var frm = document.getElementById('partial-apikey'),
                eml = frm.querySelector("input[name='email']"),
                key = frm.querySelector("input[name='apikey']"),
                sub1 = frm.querySelector("input[type='submit']");

            eml.value = demo_postmark_email;
            key.value = demo_postmark_key;

            sub1.click();
        }, 800)

    }, 800);

    var st = setTimeout(function() {
        done();
    }, 5000);
});


module('apikeys table empty', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        Rdbhost.reset_rdbhost();

        var done = assert.async();

        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        domain = privat.getItem('domain');

        demo_stripe_key = privat.getItem('demo_postmark_key');
        demo_stripe_email = privat.getItem('demo_postmark_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, createApiKeyTable].join('\n');

        var p0 = get_super_auth(acct_number, demo_email, demo_pass);
        p0.then(function(d) {
            super_authcode = d.authcode;

            var p = Rdbhost.super(super_authcode)
                .query(q)
                // .params({'apikey': demo_stripe_key, 'account_email': demo_stripe_email})
                .get_data();
            p.then(function() {
                    Rdbhost.disconnect(1000, '');
                    done();
                },
                function(e) {
                    Rdbhost.disconnect(1000, '');
                    done();
                });
        })
    },
    afterEach: function(assert) {
        SETUP_OK = false;
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                Rdbhost.disconnect(1000, '');
            },
            function(e) {
                Rdbhost.disconnect(1000, '');
            });
    }
});


test('test setup', function(assert) {

    var done = assert.async();

    var s = Rdbhost.super(super_authcode)
        .query('SELECT * FROM auth.apikeys;')
        .get_data();

    s.then(function(d) {
            ok(true, 'apikeys table found');
            ok(d.result_sets[0].rows === undefined, 'key in apikeys already');
            clearTimeout(t);
            done();
        },
        function(e) {
            ok(false, 'error in SELECT FROM auth.apikeys ' + e.message);
            clearTimeout(t);
            done();
        });

    var t = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);

});

// routine operation
//
test('email tests - routine', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    Rdbhost.email_config('dev.rdbhost.com', 'rdbhost@rdbhost.com', 'postmark');
    var p = Rdbhost.super()
        .query("")
        .email('');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length, 'results returned');
            ok(d.result_sets[0].rows.length, 'rows returned');
            ok(d.result_sets[0].rows[0].t === '', d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {

        submit_superauth_form();

        setTimeout(function() {

            var frm = document.getElementById('partial-apikey'),
                eml = frm.querySelector("input[name='email']"),
                key = frm.querySelector("input[name='apikey']"),
                sub1 = frm.querySelector("input[type='submit']");

            eml.value = demo_postmark_email;
            key.value = demo_postmark_key;

            sub1.click();
        }, 800)

    }, 800);

    var st = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);
});



/*
*
*/
