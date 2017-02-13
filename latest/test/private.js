
var privat = sessionStorage;

(function() {

    var db_domain;
    if (window.location.href.indexOf('devsrc.') > -1)
        db_domain = 'dev.rdbhost.com';
    else if (window.location.href.indexOf('src.') > -1)
        db_domain = 'www.rdbhost.com';
    else  // user testing, assume production server
        db_domain = 'www.rdbhost.com';

    privat.setItem('bad_acct_number', 2);
    privat.setItem('bad_email', 'demo@travelbyroad.net');


    privat.setItem('domain', db_domain);
    privat.setItem('acct_number', 12);

    privat.setItem('demo_email', 'js@travelbyroad.net');
    if (!privat.getItem('demo_pass'))
        privat.setItem('demo_pass', prompt('enter password for js@travelbyroad.net'));

    privat.setItem('demo_stripe_email', 'dkeeney@rdbhost.com');
    privat.setItem('demo_stripe_key', 'cPvPkcyWggrVF8IB0R0N2kc34PwL54SC');  // sandbox account

    privat.setItem('demo_postmark_email', 'rdbhost@rdbhost.com');
    privat.setItem('demo_postmark_key', '0be3da1e-f0b3-421e-ae6c-64ceda2cb914');  // sandbox account

})();

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
