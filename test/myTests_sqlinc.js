
var domain;
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



module('SQL Include tests', {

    beforeEach: function () {
        domain = private.getItem('domain');
        acct_number = parseInt(private.getItem('acct_number'), 10);
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
        var frm = document.getElementById('preauth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = private.getItem('demo_email');
        pw.value = private.getItem('demo_pass');
        sub.click();
    }, 500);

    var p = Rdbhost.inline_sql();
    p.then(function(d) {
            ok(d.status[1] === 'OK', 'status ok');
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




/*
*
*/
