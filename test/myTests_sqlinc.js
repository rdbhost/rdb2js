
var domain;
PASSWORD = undefined;
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
// var get_super_auth = get_methods['auth'].bind(null, 'super');



module('SQL Include tests', {

    beforeEach: function () {
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function() {
        Rdbhost.disconnect(1000, '');
    }
});


// send reader request with query, verify promise fulfilled
//
test('sql include found', function(assert) {

    var done = assert.async();

    setTimeout(function() {
        var frm = document.getElementById('partial-preauth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = privat.getItem('demo_email');
        pw.value = privat.getItem('demo_pass');
        sub.click();
    }, 500);

    var p = Rdbhost.inline_sql();
    p.then(function(d) {
            ok(d.status[1] === 'OK', 'status ok');
            ok(d.result_sets, 'result_sets found');
            ok(d.result_sets[0].records, 'result_set rows found');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 1000);
});




module('Dynamic Loader Tests', {


    beforeEach: function () {
        Rdbhost.use_labjs_loader($LAB);
    }
});


// send reader request with query, verify promise fulfilled
//
test('test dynamic loading', function(assert) {

    var done = assert.async();

    setTimeout(function () {

        try {
            var ait = addSeven(1);
            ok(false, 'function shouldnt have been defined');
        }
        catch (e) {
            ok(true, 'function not defined yet.');
            ok(e.message.indexOf(' no') >= 0, 'correct exception thrown '+e.message);
        }

        Rdbhost.loader('dynamic/dynamic_load.js', function() {
            var eight = addSeven(1);
            ok(eight === 8, 'add7 function worked');
            clearTimeout(st);
            done();
        });

        var st = setTimeout(function() {
            ok(false, 'timed out');
            done();
        }, 2000);

    }, 1000)

});



/*
*
*/
