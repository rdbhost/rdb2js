


var privat = sessionStorage;


privat.setItem('bad_acct_number', 2);
privat.setItem('bad_email', 'demo@travelbyroad.net');


privat.setItem('domain', 'dev.rdbhost.com');
privat.setItem('acct_number', 14);

privat.setItem('demo_email', 'jsdemos@travelbyroad.net');
if (!privat.getItem('demo_pass'))
    privat.setItem('demo_pass', prompt('enter password for jsdemos'));

privat.setItem('demo_stripe_email', 'dkeeney@rdbhost.com');
privat.setItem('demo_stripe_key', 'cPvPkcyWggrVF8IB0R0N2kc34PwL54SC');  // sandbox account



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
