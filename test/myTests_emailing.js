
var domain, demo_email, demo_pass, super_authcode, demo_postmark_key, demo_postmark_email;

domain = privat.getItem('domain');
acct_number = parseInt(privat.getItem('acct_number'), 10);
demo_email = privat.getItem('demo_email');
demo_pass = privat.getItem('demo_pass');

demo_postmark_key = privat.getItem('demo_postmark_key');
demo_postmark_email = privat.getItem('demo_postmark_email');


/*

   todo - add test for no addressees
 */

function timeoutBuilder(done) {

    return setTimeout(function() {
        ok(false, 'timeout');
        complete(t);
    }, 5000);
}

function submit_superauth_form() {

    var frm = document.getElementById('partial-super-auth'),
        eml = frm.querySelector("input[name='email']"),
        pw = frm.querySelector("input[name='password']"),
        sub = frm.querySelector("input[type='submit']");

    eml.value = demo_email;
    pw.value = demo_pass;
    sub.click();
}

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


function beforeEach(assert, q, parms) {

    var done = assert.async();

    Rdbhost.connect(domain, acct_number);

    var p = get_super_auth(acct_number, demo_email, demo_pass);
    p.then(function(d) {

        super_authcode = d.authcode;

        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        function disco() {Rdbhost.disconnect(1000, '');}
        var p = Rdbhost.super(super_authcode)
            .query(q)
            .params(parms)
            .get_data();
        p.then(disco, disco);
    });
}

function afterEach(assert, q, parms) {

    var done = assert.async();

    var p = Rdbhost.super(super_authcode).query(q).params(parms).get_data();
    function reset() {
        Rdbhost.reset_rdbhost(done);
    }
    p.then(reset, reset);
}

function fake_results_promise() {
    return Promise.resolve({   "status":["complete","OK"],
                "websocket-id":"x7fd98bee9e10",
                "times":["0.006820","0.003835"],
                "noise":"65J9OeoZIz9A",
                "row_count":[1,"1 Rows Affected"],
                "request-id":"super2",
                "result_sets":[
                    {   "header":{"result":705,"idx":23},
                        "rows":[{"result":"Success","idx":1}]
                    }
                    ]
            });
}

function MockSuper(retObj) {

    retObj = retObj || {};

    function rdgw(json_getter) {
        var this_ = this;
        retObj.json = json_getter.call(this_);

        return fake_results_promise();
    }
    function rdgh(data_extractor) {
        var this_ = this,
            url_formdata = data_extractor.call(this_),
            url = url_formdata[0],
            formData = url_formdata[1];
        retObj.url = url;
        retObj.formData = formData;

        return fake_results_promise();
    }

    return function(authcode) {
        return Rdbhost.super(authcode, rdgw, rdgh);
    }
}


module('all tables ok', {

    beforeEach: function (assert) {
        var q = [dropApiTable, createApiKeyTable, addApiKey].join('\n'),
            parms = {'apikey': demo_postmark_key, 'account_email': demo_postmark_email};
        beforeEach(assert, q, parms);
    },

    afterEach: function(assert) {
        afterEach(assert, dropApiTable, []);
    }
});


test('test setup', function(assert) {

    var done = assert.async();

    var s = Rdbhost.super(super_authcode)
        .query("SELECT count(*) FROM auth.apikeys WHERE service = 'postmark';")
        .get_data();

    function complete(t) { clearTimeout(t); done() }
    s.then(function(d) {
            ok(true, 'auth.apikeys found');
            ok(d.result_sets[0].rows[0].count === 1, d.status);
            complete(t);
        },
        function(e) {
            ok(false, 'error in SELECT FROM apikeys ' + e.message);
            complete(t);
        });

    var t = timeoutBuilder(done);

});


// routine operation that fails
//
test('email tests - routine fail', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

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

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});


// routine operation
//
test('email tests - routine success', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var mock = {};
    var p = Rdbhost.super()
    // var p = MockSuper(mock)()
        .email('David', 'rdbhost@rdbhost.com', 'Me', 'dkeeney@travelbyroad.net',
                        'Test allTok routine success', 'test body');

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

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});


// routine operation - multiple emails
//
test('email tests - multiple emails', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var c = Rdbhost.column_wrapper;
    var p = Rdbhost.super()
        .query("SELECT 'demo1@travelbyroad.net' AS tomail, 1 AS idx \n" +
                "  UNION SELECT 'demo2@travelbyroad.net' AS tomail, 2 AS idx")
        .email('David', 'rdbhost@rdbhost.com', 'Me', c('tomail'),
            'Test allTok multiple emails d1, d2', 'test body');

    p.then(function(d) {
        ok(true, 'then called');
        ok(d.result_sets[0].rows.length === 2, '2 results recieved');
        ok(d.result_sets[0].rows[0].result.indexOf('Success') >= 0, d.status);
        ok(d.result_sets[0].rows[1].result.indexOf('Success') >= 0, d.status);
        ok(d.result_sets[0].rows[1].idx === 2, d.status);
        clearTimeout(st);
        done();
    })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});


// routine operation - no emails
//
test('email tests - no emails from query', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var c = Rdbhost.column_wrapper;
    var p = Rdbhost.super()
        .query("SELECT 'demo1@travelbyroad.net' AS tomail, 1 AS idx WHERE 1=2")
        .email('David', 'rdbhost@rdbhost.com', 'Me', c('tomail'),
            'Test allTok no emails', 'test body');

    p.then(function(d) {
        ok(true, 'then called');
        ok(d.row_count[0] === 0, '0 results recieved');
        clearTimeout(st);
        done();
    })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});


// routine operation
//
test('email tests - with query', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var mock = {},
        c = Rdbhost.column_wrapper;

    // var p = Rdbhost.super()
    var p = MockSuper(mock)()
        .query("SELECT 'demo@tbr.net' AS tomail")
        .email('David', 'rdbhost@rdbhost.com', 'Me', c('tomail'),
            'Test allTok with query', 'test body with query');

    p.then(function(d) {
            ok(mock.json, 'mock json ok');
            var jsn = JSON.parse(mock.json);
            ok(jsn.authcode.length > 20, 'mock json authcode 20 chars');
            ok(jsn.mode === 'email', 'mock json mode === email');
            ok(jsn.q.indexOf('ECT "_q_"."tomail" AS "To:') >=0, '"_q_.tomail AS To:" found');
            ok(jsn.args.length === 7, 'mock json has 7 args');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});


// routine operation
//
test('email tests - with fixed', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var mock = {},
        f = Rdbhost.fixed_wrapper;

    // var p = Rdbhost.super()
    var p = MockSuper(mock)()
        .query("SELECT 'demo@tbr.net' AS tomail")
        .email('David', 'rdbhost@rdbhost.com', 'Me', f('demo-tomail@tbr.net'),
            'Test allTok with fixed', 'test body with fixed');

    p.then(function(d) {
            ok(mock.json, 'mock json ok');
            var jsn = JSON.parse(mock.json);
            ok(jsn.authcode.length > 20, 'mock json authcode 20 chars');
            ok(jsn.mode === 'email', 'mock json mode === email');
            ok(jsn.q.indexOf('ECT \'demo-tomail@tbr.net\' AS "To:",') >= 0, '"demo-tomail@tbr.net AS To:" found');
            ok(jsn.args.length === 7, 'mock json has 7 args');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 300);
    });

    var st = timeoutBuilder(done);
});




module('apikeys table missing', {

    beforeEach: function (assert) {

        var q = [dropApiTable].join('\n');
        beforeEach(assert, q, []);

        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function(assert) {

        afterEach(assert, dropApiTable, []);
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

    var t = timeoutBuilder(done);

});

// routine operation
//
test('email tests - routine fail', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('Dave', 'rdbhost@rdbhost.com', 'postmark');

    var p = Rdbhost.super()
        .query("")
        .email('');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.row_count[0] === 1, 'rows '+d.row_count[0]);
            ok(d.result_sets[0].rows[0].idx === 1, 'idx is 1');
            ok(d.result_sets[0].rows[0].result.indexOf('422') >= 0, 'Error 422');
            ok(d.result_sets[0].rows[0].result.indexOf("Invalid 'From") >= 0, 'Invalid "From');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        submit_service_form();
    });

    var st = timeoutBuilder(done);
});


module('apikeys table empty', {

    beforeEach: function (assert) {

        var q = [dropApiTable, createApiKeyTable].join('\n');

        beforeEach(assert, q, []);
    },
    afterEach: function(assert) {

        afterEach(assert, dropApiTable, []);
    }
});


test('test setup', function(assert) {

    var done = assert.async();

    var s = Rdbhost.super(super_authcode)
        .query('SELECT * FROM auth.apikeys;')
        .get_data();

    s.then(function(d) {
            ok(true, 'apikeys table found');
            ok(d.result_sets[0].rows === undefined, 'key not in apikeys');
            clearTimeout(t);
            done();
        },
        function(e) {
            ok(false, 'error in SELECT FROM auth.apikeys ' + e.message);
            clearTimeout(t);
            done();
        });

    var t = timeoutBuilder(done);

});

// routine operation
//
test('email tests - routine success', function(assert) {

    var done = assert.async();

    Rdbhost.email_config('dev.rdbhost.com', 'rdbhost@rdbhost.com', 'postmark');
    var p = Rdbhost.super()
        .query("")
        .email('David', 'rdbhost@rdbhost.com', 'Me', 'dkeeney@travelbyroad.net', 'Test', 'test body');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length, 'results returned');
            ok(d.result_sets[0].rows.length, 'rows returned');
            ok(d.result_sets[0].rows[0].idx === 1, 'idx is 1');
            ok(d.result_sets[0].rows[0].result === 'Success', 'result is Success');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        submit_service_form();
    });

    var st = timeoutBuilder(done);
});



/*
*
*/
