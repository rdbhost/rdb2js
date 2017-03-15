
/*
*
* tests for the SQLEngine
*
*
*/

var demo_pass, demo_email, acct_number, domain,
    SUPER_AUTH = undefined;


function get_auth(init, acctnum, email, passwd) {

    var url = 'https://'+privat.getItem('domain')+'/acct/login/00000000' + acctnum,
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
var get_preauth_auth = get_auth.bind(null, 'preauth');


module('Authorization tests', {

    beforeEach: function (assert) {

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        Rdbhost.connect(domain, acct_number);

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d){
            SUPER_AUTH = d.authcode;
            var p1 = Rdbhost.super(SUPER_AUTH)
                .query("DELETE FROM lookup.preauth_queries WHERE query LIKE '%%/* testing-delete */%%';")
                .get_data();
            p1.then(function(d) {
                    done();
                }, function(e) {
                    done();
                });
        });
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.disconnect(1000, '');
        setTimeout(function() {
            Rdbhost.reset_rdbhost(undefined, 'clean');
            Rdbhost.paranoid_confirm = false;
            done();
        }, 500);
    }
});



// send preauth request with query, verify promise fulfilled with error
//
test('preauth request cancel', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.auth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-auth-auth');
        if ( !frm )
            frm = document.getElementById('partial-preauth_auth');
        var cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1000);

    var st = setTimeout(function() { done(); }, 5000);
});


// send auth request, confirm with authorization dialog
//
test('auth request confirm', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.auth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].a === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-auth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='role']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = 'a00000000'+acct_number;
        pw.value = 'abc123';
        sub.click();

        setTimeout(function() {
            var frm = document.getElementById('partial-preauth-auth');
            if ( !frm )
                return;

            var eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = privat.getItem('demo_pass');
            sub.click();
        }, 1000);

    }, 1000);

    var st = setTimeout(function() { done(); }, 5000);
});


module('Paranoid tests ', {

    beforeEach: function (assert) {

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        Rdbhost.connect(domain, acct_number);

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d){
            SUPER_AUTH = d.authcode;
            var p1 = Rdbhost.super(SUPER_AUTH)
                .query("DELETE FROM lookup.preauth_queries WHERE query LIKE '%%/* testing-delete */%%';")
                .get_data();
            p1.then(function(d) {
                Rdbhost.paranoid_confirm = true;
                done();
            }, function(e) {
                Rdbhost.paranoid_confirm = true;
                done();
            });
        });
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.disconnect(1000, '');
        setTimeout(function() {
            Rdbhost.reset_rdbhost(undefined, 'clean');
            Rdbhost.paranoid_confirm = false;
            done();
        }, 500);
    }
});


// send auth request, confirm with authorization dialog
//
test('auth request confirm', 5, function(assert){

    var done = assert.async();

    var e = Rdbhost.auth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].a === 1, d.status);

            var p1 = Rdbhost.auth().query('SELECT 3 AS b; /* testing-delete */').get_data();
            ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
            p1.then(function(d) {
                    ok(false, '2nd request confirm not canceled');
                    clearTimeout(st);
                    done();
                })
                .catch(function(e) {
                    ok(true, 'cancelled');
                    clearTimeout(st);
                    done();
                });

        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-auth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='role']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = 'a00000000'+acct_number;
        pw.value = 'abc123';
        sub.click();

        setTimeout(function() {
            var frm = document.getElementById('partial-preauth-auth');
            if ( !frm )
                return;

            var eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = privat.getItem('demo_pass');

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            cncl = frm.querySelector('.cancel');

                        cncl.click();
                    }, 500)
                });
            }, 2);

            sub.click();
        }, 1000);

    }, 1000);

    var st = setTimeout(function() { done(); }, 5000);
});




/*
*
*/
