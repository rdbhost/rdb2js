
/*
*
* tests for the SQLEngine
*
*
*/

PASSWORD = undefined;
SUPER_AUTH = undefined;

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


function get_password() {

    if ( ! PASSWORD )
        PASSWORD = 'horosh00'; //prompt('password');
    return PASSWORD;
}

module('Authorization tests', {

    setup: function () {
        QUnit.stop();
        Rdbhost.connect(domain, acct_number);
        get_password();
        var p = get_super_auth(acct_number, demo_email, PASSWORD);
        p.then(function(d){
            SUPER_AUTH = d.authcode;
            var p1 = Rdbhost.super(SUPER_AUTH)
                .query("DELETE FROM lookup.preauth_queries WHERE query LIKE '%%/* testing-delete */%%';")
                .go();
            p1.then(function(d) {
                    QUnit.start();
                }, function(e) {
                    QUnit.start();
                });
        });
    },
    teardown: function() {
        QUnit.stop();
        Rdbhost.disconnect(1000, '');
        setTimeout(function() {
            QUnit.start()
        }, 500);
    }
});



// send preauth request with query, verify promise fulfilled with error
//
asyncTest('preauth request cancel', 3, function() {

    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.go();
    ok(p.constructor.name.indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', e.message);
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-preauth-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, confirm with authorization dialog
//
asyncTest('preauth request confirm', 3, function() {

    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.go();
    ok(p.constructor.name.indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-preauth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});





/*
*
*/
