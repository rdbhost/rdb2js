
var domain, demo_email, demo_pass, super_authcode, demo_stripe_key, demo_stripe_email;

function get_auth(init, acctnum, email, passwd) {

    var url = 'https://dev.rdbhost.com/acct/login/00000000' + acctnum,
        formData = new FormData();

    formData.append('arg:email', email);
    formData.append('arg:password', passwd);

    var p = fetch(url, {method: 'post', body: formData} );
    return p.then(function(resp) {
        return resp.json().then(function(d) {

            if ( d.error )
                throw new Error(d.error[1]);

            for ( var i in d.records.rows ) {
                var row = d.records.rows[i];
                if ( row.role.substr(0,1) === init.substr(0,1) )
                    return row;

            }
            throw new Error('super not found in login records');
        })
    });
}
var get_super_auth = get_auth.bind(null, 'super');

var SETUP_OK = false;

var dropApiTable = 'DROP TABLE IF EXISTS auth.apikeys;',

    createApiKeyTable = 'CREATE TABLE auth.apikeys ( \
                          service VARCHAR(10), \
                          apikey VARCHAR(100), \
                          webmaster_email VARCHAR(150) NULL, \
                          account_email VARCHAR(150) \
                        );',

    addApiKey = "CREATE FUNCTION pg_temp.t(_apikey VARCHAR, _acct_email VARCHAR) \
                RETURNS void \
                    AS $$ \
                BEGIN \
                    UPDATE auth.apikeys SET service='stripe', apikey=_apikey, webmaster_email='', \
                                         account_email=_acct_email \
                         WHERE service = 'stripe'; \
                    IF NOT FOUND THEN \
                        INSERT INTO auth.apikeys (service, apikey, webmaster_email, account_email) \
                                         VALUES('stripe', _apikey, '', _acct_email); \
                    END IF; \
                END; \
                $$ LANGUAGE plpgsql; \
                \
                SELECT pg_temp.t(%(apikey)s, %(account_email)s);",

    dropChargesTable = 'DROP TABLE IF EXISTS public.charges;',

    createChargesTable = 'CREATE TABLE public.charges ( \
                          idx VARCHAR(10), \
                          id VARCHAR(100), \
                          amount DECIMAL, \
                          code VARCHAR(50) \
                        );';


module('all tables ok', {

    beforeEach: function (assert) {

        SETUP_OK = true;
        var done = assert.async();

        domain = private.getItem('domain');
        acct_number = parseInt(private.getItem('acct_number'), 10);
        demo_email = private.getItem('demo_email');
        demo_pass = private.getItem('demo_pass');

        demo_stripe_key = private.getItem('demo_stripe_key');
        demo_stripe_email = private.getItem('demo_stripe_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, createApiKeyTable, addApiKey, dropChargesTable, createChargesTable].join('\n');

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d) {
            super_authcode = d.authcode;

            var p = Rdbhost.super(super_authcode)
                .query(q)
                .params({'apikey': demo_stripe_key, 'account_email': demo_stripe_email})
                .get_data();
            p.then(function () {
                    Rdbhost.disconnect(1000, '');
                    done();
                },
                function (e) {
                    Rdbhost.disconnect(1000, '');
                    done();
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
        .query('SELECT count(*) FROM auth.apikeys;')
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
test('charge tests - routine fail', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
                    .query("SELECT 1 AS amount, 'test' AS description, 'me' AS idx;")
                    .charge('1234123412341234', '', '11', '2018');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].result.indexOf('card number is incorrect') >= 0, d.status);

            // add test to verify charges table got new entry

            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {

        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = private.getItem('demo_pass');
        sub.click();

    }, 800);

    var st = setTimeout(function() {
        done();
    }, 5000);
});


// routine operation
//
test('charge tests - routine success', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
        .query("SELECT 75 AS amount, 'test' AS description, 'me' AS idx;")
        .charge('4242424242424242', '100', '11', '2018');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].result.indexOf('Success') >= 0, d.status);

            // add test to verify charges table got new entry

            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {

        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = private.getItem('demo_pass');
        sub.click();

    }, 800);

    var st = setTimeout(function() {
        done();
    }, 5000);
});


module('charge table missing', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        var done = assert.async();
        Rdbhost.connect(domain, acct_number);
        //get_password();

        var q = [dropApiTable, createApiKeyTable, addApiKey, dropChargesTable].join('\n');

        var p = Rdbhost.super(super_authcode)
            .query(q)
            .params({'apikey': demo_stripe_key, 'account_email': demo_stripe_email})
            .get_data();
        p.then(function() {
                Rdbhost.disconnect(1000, '');
                done();
            },
            function(e) {
                Rdbhost.disconnect(1000, '');
                done();
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
        .query('SELECT * FROM charges;')
        .get_data();

    s.then(function(d) {
            ok(false, 'charges found');
            clearTimeout(t);
            done();
        },
        function(e) {
            ok(true, 'error in SELECT FROM charges ' + e.message);
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
test('charge tests - routine', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
        .query("SELECT 1 AS amount, 'test' AS description, 'me' AS idx;")
        .charge('1234123412341234', '', '11', '2018');

    p.then(function(d) {
            ok(true, 'then called');
            // no data returned, as last operation was a 'CREATE TABLE charges... '
            ok(d.row_count[0] === -1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {

        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = private.getItem('demo_pass');
        sub.click();

    }, 800);

    var st = setTimeout(function() {
        done();
    }, 5000);
});


module('apikeys table missing', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        var done = assert.async();
        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, dropChargesTable, createChargesTable].join('\n');

        var p = Rdbhost.super(super_authcode)
            .query(q)
            .params({'apikey': demo_stripe_key, 'account_email': demo_stripe_email})
            .get_data();
        p.then(function() {
                Rdbhost.disconnect(1000, '');
                done();
            },
            function(e) {
                Rdbhost.disconnect(1000, '');
                done();
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
        .query('SELECT * FROM auth.apikeys;')
        .get_data();

    s.then(function(d) {
            ok(false, 'charges found');
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
test('charge tests - routine', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
        .query("SELECT 1 AS amount, 'test' AS description, 'me' AS idx;")
        .charge('1234123412341234', '', '11', '2018');

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

        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = private.getItem('demo_pass');
        sub.click();

        setTimeout(function() {

            var frm = document.getElementById('partial-apikey'),
                eml = frm.querySelector("input[name='email']"),
                key = frm.querySelector("input[name='apikey']"),
                sub1 = frm.querySelector("input[type='submit']");

            eml.value = demo_stripe_email;
            key.value = demo_stripe_key;

            sub1.click();
        }, 800)

    }, 800);

    var st = setTimeout(function() {
        done();
    }, 5000);
});



/*
*
*/
