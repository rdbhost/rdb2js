


var private = sessionStorage;


private.setItem('bad_acct_number', 2);
private.setItem('bad_email', 'demo@travelbyroad.net');


private.setItem('domain', 'dev.rdbhost.com');
private.setItem('acct_number', 14);

private.setItem('demo_email', 'jsdemos@travelbyroad.net');
if (!private.getItem('demo_pass'))
    private.setItem('demo_pass', prompt('enter password for jsdemos'));

private.setItem('demo_stripe_email', 'dkeeney@rdbhost.com');
private.setItem('demo_stripe_key', 'cPvPkcyWggrVF8IB0R0N2kc34PwL54SC');  // sandbox account



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
