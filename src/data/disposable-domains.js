// Comprehensive list of known disposable/temporary email domains
// These are commonly used for spam, fraud, and throwaway signups

const DISPOSABLE_DOMAINS = new Set([
    // Major disposable email services
    '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.de',
    'guerrillamailblock.com', 'grr.la', 'sharklasers.com', 'guerrillamail.info',
    'mailinator.com', 'mailinator.net', 'mailinator2.com', 'maildrop.cc',
    'dispostable.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'throwaway.email', 'throwaway.com', 'trashmail.com', 'trashmail.net',
    'trashmail.org', 'trashmail.me', 'trashmail.io',
    'tempinbox.com', 'tempr.email', 'tempail.com',
    'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
    'mohmal.com', 'getnada.com', 'emailondeck.com',
    'mintemail.com', 'harakirimail.com', 'mailnesia.com',
    'mailcatch.com', 'mailsac.com', 'mailnull.com',
    'discard.email', 'discardmail.com', 'discardmail.de',
    'spamgourmet.com', 'mytemp.email', 'tempmailo.com',
    'burnermail.io', 'inboxkitten.com', 'mailpoof.com',
    'jetable.org', 'nada.email', 'emailfake.com',
    'crazymailing.com', 'armyspy.com', 'dayrep.com',
    'einrot.com', 'fleckens.hu', 'gustr.com',
    'jourrapide.com', 'rhyta.com', 'superrito.com',
    'teleworm.us', 'tempomail.fr', 'tittbit.in',
    'trash-mail.at', 'bugmenot.com', 'mailexpire.com',
    'safetymail.info', 'filzmail.com', 'sharklasers.com',
    'binkmail.com', 'bobmail.info', 'chammy.info',
    'devnullmail.com', 'letthemeatspam.com', 'mailinater.com',
    'notmailinator.com', 'reallymymail.com', 'reconmail.com',
    'spamfree24.org', 'tradermail.info', 'veryreallyme.com',
    'tempsky.com', 'mailtemp.info', 'tempmail.ninja',
    'tempmailaddress.com', 'tmpmail.net', 'tmpmail.org',
    'emailtemporanea.com', 'emailtemporanea.net',
    'mailforspam.com', 'instant-mail.de', 'wegwerfmail.de',
    'wegwerfmail.net', 'wegwerfmail.org', 'sogetthis.com',
    'meltmail.com', 'spaml.de', 'uggsrock.com',
    'spamhereplease.com', 'spamherelots.com', 'thisisnotmyrealemail.com',
    'trashymail.com', 'trashymail.net', 'mailzilla.com',
    'nomail.xl.cx', 'rcpt.at', 'trash2009.com',
    'tempemails.io', 'tmpbox.com', 'mytrashmail.com',
    'dumpmail.de', 'thankyou2010.com', 'putthisinyouremail.com',
    // Russian disposable
    'mailhz.me', 'dropmail.me',
    // Newer services
    'tempmail.plus', 'internxt.com', 'smailpro.com',
    'luxusmail.org', 'tmail.ws', 'disposablemail.com',
]);

// Known free email providers (not disposable, but useful for scoring)
const FREE_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'mail.com', 'protonmail.com', 'proton.me', 'zoho.com',
    'gmx.com', 'gmx.net', 'yandex.com', 'yandex.ru', 'tutanota.com',
    'tuta.io', 'fastmail.com', 'hushmail.com', 'live.com', 'msn.com',
    'me.com', 'mac.com', 'inbox.com', 'mail.ru', 'rambler.ru',
    'qq.com', '163.com', '126.com', 'sina.com', 'yeah.net',
]);

// Role-based email prefixes (often not personal inboxes)
const ROLE_PREFIXES = new Set([
    'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
    'info', 'support', 'help', 'sales', 'marketing', 'contact',
    'billing', 'abuse', 'noc', 'security', 'no-reply', 'noreply',
    'no_reply', 'donotreply', 'do-not-reply', 'mailer-daemon',
    'office', 'hr', 'jobs', 'careers', 'press', 'media',
    'team', 'hello', 'feedback', 'newsletter', 'subscribe',
]);

module.exports = { DISPOSABLE_DOMAINS, FREE_PROVIDERS, ROLE_PREFIXES };
