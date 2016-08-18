
var domain, demo_email, demo_pass, super_authcode, demo_stripe_key, demo_stripe_email;


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
                          tstamp TIMESTAMP WITH TIME ZONE NULL,\
                          amount DECIMAL, \
                          idx VARCHAR(10), \
                          id VARCHAR(100), \
                          fee DECIMAL, \
                          paid BOOLEAN, \
                          refunded BOOLEAN, \
                          last4 VARCHAR(4), \
                          error VARCHAR(50) \
                        );';


module('all tables ok', {

    beforeEach: function (assert) {

        SETUP_OK = true;
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        demo_stripe_key = privat.getItem('demo_stripe_key');
        demo_stripe_email = privat.getItem('demo_stripe_email');

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
        // Rdbhost.once('connection-closed:super', function() {
        //     done();
        // });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            },
            function(e) {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
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
            var chkProm = Rdbhost.super().query('SELECT * FROM charges;').get_data();
            chkProm.then(function(d) {

                ok(d.result_sets[0].rows.length === 1, 'rows len '+ d.result_sets[0].rows.length);
                ok(d.result_sets[0].rows[0].error.indexOf('number is incorr') >=0, d.result_sets[0].rows[0].error);
                ok(d.result_sets[0].rows[0].amount === '1', d.result_sets[0].rows[0].amount);
                clearTimeout(st);
                done();
            })
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 800);
    });

    var st = setTimeout(function() {
        ok(false, 'timeout');
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
            var chkProm = Rdbhost.super().query('SELECT * FROM charges;').get_data();
            chkProm.then(function(d) {

                ok(d.result_sets[0].rows.length === 1, 'rows len '+ d.result_sets[0].rows.length);
                ok(d.result_sets[0].rows[0].paid === true, 'paid is true');
                ok(d.result_sets[0].rows[0].amount === '75', d.result_sets[0].rows[0].amount);
                clearTimeout(st);
                done();
            });
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-submit', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 800);
    });

    var st = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);
});


module('charge table missing', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        demo_stripe_key = privat.getItem('demo_stripe_key');
        demo_stripe_email = privat.getItem('demo_stripe_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, createApiKeyTable, addApiKey, dropChargesTable].join('\n');

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d) {
            super_authcode = d.authcode;

            var p1 = Rdbhost.super(super_authcode)
                .query(q)
                .params({'apikey': demo_stripe_key, 'account_email': demo_stripe_email})
                .get_data();
            p1.then(function () {
                    Rdbhost.disconnect(1000, '');
                    done();
                },
                function (e) {
                    Rdbhost.disconnect(1000, '');
                    done();
                });
        })
    },
    afterEach: function(assert) {
        SETUP_OK = false;
        var done = assert.async();
        // Rdbhost.once('connection-closed:super', function() {
        //     done();
        // });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            },
            function(e) {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
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

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 800);
    });

    var st = setTimeout(function() {
        done();
    }, 5000);
});


module('apikeys table missing', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        var done = assert.async();

        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        domain = privat.getItem('domain');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, dropChargesTable, createChargesTable].join('\n');

        var p0 = get_super_auth(acct_number, demo_email, demo_pass);
        p0.then(function(d) {
            super_authcode = d.authcode;

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
        })
    },
    afterEach: function(assert) {
        SETUP_OK = false;
        var done = assert.async();
        // Rdbhost.once('connection-closed:super', function() {
        //     done();
        // });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            },
            function(e) {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
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

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {

            var frm = document.getElementById('partial-apikey'),
                eml = frm.querySelector("input[name='email']"),
                key = frm.querySelector("input[name='apikey']"),
                sub1 = frm.querySelector("input[type='submit']");

            eml.value = demo_stripe_email;
            key.value = demo_stripe_key;

            sub1.click();
        }, 800)

    });

    var st = setTimeout(function() {
        done();
    }, 5000);
});


module('apikeys table empty', {

    beforeEach: function (assert) {
        SETUP_OK = true;
        var done = assert.async();

        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        domain = privat.getItem('domain');

        demo_stripe_key = privat.getItem('demo_stripe_key');
        demo_stripe_email = privat.getItem('demo_stripe_email');

        Rdbhost.connect(domain, acct_number);

        var q = [dropApiTable, createApiKeyTable, dropChargesTable, createChargesTable].join('\n');

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
        // Rdbhost.once('connection-closed:super', function() {
        //     done();
        // });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            },
            function(e) {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
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
test('charge tests - routine', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
        .query("SELECT 1 AS amount, 'test' AS description, 'me' AS idx;")
        .charge('1234123412341234', '', '11', '2018');

    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[1].records.rows[0].t === '', d.status);
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

            var frm = document.getElementById('partial-apikey'),
                eml = frm.querySelector("input[name='email']"),
                key = frm.querySelector("input[name='apikey']"),
                sub1 = frm.querySelector("input[type='submit']");

            eml.value = demo_stripe_email;
            key.value = demo_stripe_key;

            sub1.click();
        }, 800)

    });

    var st = setTimeout(function() {
        ok(false, 'timeout');
        done();
    }, 5000);
});


module('refunding', {

    beforeEach: function (assert) {

        SETUP_OK = true;
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        demo_stripe_key = privat.getItem('demo_stripe_key');
        demo_stripe_email = privat.getItem('demo_stripe_email');

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
        // Rdbhost.once('connection-closed:super', function() {
        //     done();
        // });
        var p = Rdbhost.super(super_authcode).query(dropApiTable).get_data();
        p.then(function() {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            },
            function(e) {
                // Rdbhost.disconnect(1000, '');
                Rdbhost.reset_rdbhost(done);
            });
    }
});


// routine operation
//
test('refund tests - routine success', function(assert) {

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
            var chkProm = Rdbhost.super().query('SELECT * FROM charges;').get_data();
            chkProm.then(function(d) {

                ok(d.result_sets[0].rows.length === 1, 'rows len '+ d.result_sets[0].rows.length);
                ok(d.result_sets[0].rows[0].refunded === false, 'refunded is false');
                ok(d.result_sets[0].rows[0].paid === true, 'paid is true');
                ok(d.result_sets[0].rows[0].amount === '75', d.result_sets[0].rows[0].amount);

                var transaction_id = d.result_sets[0].rows[0].id;
                ok(transaction_id !== '0', transaction_id);

                // do refund
                var refundProm = Rdbhost.super()
                    .query("SELECT amount, idx, id FROM charges LIMIT 1;")
                    .refund();

                refundProm.then(function(d) {

                        ok(true, 'then called');
                        ok(d.result_sets[0].rows[0].result.indexOf('Success') >= 0, d.status);

                        // add test to verify charges table got new refund entry
                        var chkRefund = Rdbhost.super().query('SELECT * FROM charges;').get_data();
                        chkRefund.then(function(d) {

                                ok(d.result_sets[0].rows.length === 2, 'rows len ' + d.result_sets[0].rows.length);
                                ok(d.result_sets[0].rows[1].refunded === true, 'refunded true');
                                ok(d.result_sets[0].rows[1].amount === '75', d.result_sets[0].rows[0].amount);

                                clearTimeout(st);
                                done();
                            })
                            .catch(function(e) {

                                ok(false, 'error '+ e.message);
                                clearTimeout(st);
                                done();
                            })
                    })
                    .catch(function(e) {
                        throw e;
                    });

            });
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 800);
    });

    var st = setTimeout(function() {
        done();
    }, 5000);
});


// routine operation
//
test('refund tests - routine fail', function(assert) {

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
            var chkProm = Rdbhost.super().query('SELECT * FROM charges;').get_data();
            chkProm.then(function(d) {

                ok(d.result_sets[0].rows.length === 1, 'rows len '+ d.result_sets[0].rows.length);
                ok(d.result_sets[0].rows[0].paid === true, 'paid true');
                ok(d.result_sets[0].rows[0].amount === '75', d.result_sets[0].rows[0].amount);

                var transaction_id = d.result_sets[0].rows[0].id;
                ok(transaction_id !== '0', transaction_id);

                // do refund
                var refundProm = Rdbhost.super()
                    .query("SELECT id, idx, 80 AS amount FROM charges LIMIT 1;")
                    .refund();

                refundProm.then(function(d) {

                    ok(true, 'then called');
                    ok(d.result_sets[0].rows[0].result.indexOf('Success') >= 0, d.status);

                    // add test to verify charges table got new refund entry
                    var chkRefund = Rdbhost.super().query('SELECT * FROM charges;').get_data();
                    chkRefund.then(function(d) {

                        ok(d.result_sets[0].rows.length === 2, 'rows len ' + d.result_sets[0].rows.length);
                        ok(d.result_sets[0].rows[1].paid === true, 'paid true');
                        ok(d.result_sets[0].rows[1].amount === '80', d.result_sets[0].rows[0].amount);


                        // todo - check stripe site to verify these refunds are happening.   should not make 80
                        //    cent refund on 75 cent charge.


                        clearTimeout(st);
                        done();
                    });
                });
            })
        })
        .catch(function(e) {
            ok(false, 'catch called ' + e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.on('form-displayed', function() {

        setTimeout(function() {
            submit_superauth_form();
        }, 800);
    });

    var st = setTimeout(function() {
        done();
    }, 5000);
});



/*
*
*/
