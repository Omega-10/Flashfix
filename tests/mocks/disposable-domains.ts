/**
 * Disposable email domains deny-list and validator for Flashfix platform.
 * Bundled with 200+ disposable and temporary email domains.
 */

export const DISPOSABLE_DOMAINS: Set<string> = new Set([
  '0-mail.com', '0815.ru', '0clickemail.com', '10minutemail.com', '10minutemail.net',
  '10minutemail.org', '10minutemailbox.com', '123-m.com', '12minutemail.com', '1ce.cc',
  '20minutemail.com', '2prong.com', '30minutemail.com', '3d-painting.com', '4warding.com',
  '4warding.net', '4warding.org', '60minutemail.com', '675hosting.com', '675hosting.net',
  '675hosting.org', '75hosting.com', '75hosting.net', '75hosting.org', '7tags.com',
  '9ox.net', 'a-bc.net', 'afrobacon.com', 'agedmail.com', 'agentmail.com',
  'amilegit.com', 'amiri.net', 'amiriindustries.com', 'anonbox.net', 'anonymbox.com',
  'antichef.com', 'antichef.net', 'antispam.de', 'baxomale.ht.cx', 'beefmilk.com',
  'binkmail.com', 'bio-muesli.net', 'bobmail.info', 'bodhi.lawlita.com', 'bofthew.com',
  'brefmail.com', 'broadbandninja.com', 'bsnow.net', 'bugmenot.com', 'bupkis.org',
  'burnersoft.com', 'burntmail.com', 'burstmail.com', 'cachedot.net', 'cashette.com',
  'centermail.com', 'centermail.net', 'chogmail.com', 'choicemail1.com', 'clrmail.com',
  'cool.fr.nf', 'cosmorph.com', 'courrieltemporaire.com', 'crapmail.org', 'crazymailing.com',
  'curryjunk.com', 'cust.in', 'dacoolest.com', 'dandikmail.com', 'dayrep.com',
  'deadaddress.com', 'deadspam.com', 'deakmail.com', 'deluxemail.info', 'despam.it',
  'despammed.com', 'devnullmail.com', 'dfgh.net', 'digitalsanctuary.com', 'discard.email',
  'discardmail.com', 'discardmail.de', 'disposable.com', 'disposableaddress.com', 'disposableemailaddresses.com',
  'disposableinbox.com', 'dispose.it', 'disposeamail.com', 'disposemail.com', 'dispostable.com',
  'dmcontact.com', 'dodgeit.com', 'dodgit.com', 'dontreg.com', 'dontsendmespam.de',
  'drdrb.net', 'dump-email.info', 'dumpemail.com', 'dumpmail.de', 'dumpyemail.com',
  'e-mail.am', 'e4ward.com', 'easytrashmail.com', 'email60.com', 'emaildrop.io',
  'emailias.com', 'emailmiser.com', 'emailsensei.com', 'emailstories.com', 'emailtemporaneo.net',
  'emailtemporar.ro', 'emailtemporario.com.br', 'emailthe.net', 'emailto.de', 'emailwarden.com',
  'emailx.at.tc', 'emailx.co.vu', 'emeil.in', 'emeil.ir', 'emeraldwebhost.com',
  'entertheinter.net', 'ephemail.net', 'eskimo.com', 'etranquil.com', 'etranquille.com',
  'evademail.com', 'evademail.net', 'everymail.net', 'existmail.com', 'exitmail.com',
  'expiramail.com', 'explodemail.com', 'eyepaste.com', 'fake-box.com', 'fakeinbox.com',
  'fakemail.fr', 'fakemailgenerator.com', 'fastcheetah.com', 'fastemail.us', 'fastmailforyou.com',
  'filzmail.com', 'fivetenforty.com', 'fixmail.be', 'flashmail.com', 'flyspam.com',
  'forward.cat', 'fozzymail.com', 'fr33mail.info', 'freenet.de', 'front14.org',
  'fudge.ws', 'fux0ringduh.com', 'gaggle.net', 'galaxyhit.com', 'games4free.org',
  'get1mail.com', 'get2mail.fr', 'getairmail.com', 'getiton.com', 'getmail.no',
  'getonemail.com', 'ghostlymail.com', 'giantmail.de', 'gishpuppy.com', 'golfingcenter.com',
  'greenkaktus.com', 'greensloth.com', 'greentext.biz', 'guerillamail.biz', 'guerillamail.block',
  'guerillamail.com', 'guerillamail.de', 'guerillamail.net', 'guerillamail.org', 'guerrillamail.biz',
  'guerrillamail.block', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'gustr.com', 'h.mintemail.com', 'h8s.org', 'hab-verschlafen.de',
  'habmalnefrage.de', 'haltospam.com', 'hamham.uk', 'hatespam.org', 'herp.in',
  'hidemail.biz', 'hidemail.de', 'hidemail.org', 'hidzz.com', 'highprogrammer.com',
  'hmamail.com', 'hopto.org', 'hotpop.com', 'hushmail.com', 'imails.info',
  'inbox.si', 'inboxclean.com', 'inboxclean.org', 'inboxproxy.com', 'incognitocave.com',
  'insorg-mail.info', 'instant-mail.de', 'instantemailaddress.com', 'ipoo.org', 'irish2me.com',
  'ironie-abteilung.de', 'is.gd', 'jetable.fr.nf', 'jetable.net', 'jetable.org',
  'jetable.org.ua', 'journeyim.com', 'jpsharing.net', 'jsmith.com', 'junk1e.com',
  'junkmail.com', 'justemail.net', 'kasmail.com', 'keepmymail.com', 'killmail.com',
  'killmail.net', 'klzlk.com', 'kombikiste.biz', 'koszmail.pl', 'kurzepost.de',
  'laste.ml', 'lastmail.com', 'lazyinbox.com', 'lifebyfood.com', 'link2mail.net',
  'litedrop.com', 'loadmail.com', 'lookugly.com', 'lopl.com', 'lovemeleaveme.com',
  'lr78.com', 'm-c.im', 'm4u-free.info', 'maboroshi.mobi', 'mad.scientist.com',
  'mail-free.biz', 'mail-temporaire.fr', 'mail.by', 'mail.ht.cx', 'mail.misterpinball.de',
  'mail1a.de', 'mail333.com', 'mail4trash.com', 'mailbidon.com', 'mailcatch.com',
  'mailde.de', 'mailde.info', 'maildisposable.com', 'maildrop.cc', 'maileater.com',
  'mailexpire.com', 'mailimate.com', 'mailin8r.com', 'mailinater.com', 'mailinator.com',
  'mailinator.net', 'mailinator.org', 'mailinator2.com', 'mailinatorzone.com', 'mailisawesome.com',
  'mailme.ir', 'mailmohm.com', 'mailna.biz', 'mailna.co', 'mailna.in',
  'mailna.me', 'mailnator.com', 'mailnesia.com', 'mailnull.com', 'mailquack.com',
  'mailsac.com', 'mailscrap.com', 'mailseal.de', 'mailshell.com', 'mailslite.com',
  'mailtemp.info', 'mailtome.de', 'mailtothis.com', 'mailtrash.net', 'mailtv.net',
  'mailzilla.org', 'makememail.com', 'maxmail.ch', 'meltmail.com', 'mfox.biz',
  'mintemail.com', 'misterpinball.de', 'mohmal.com', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'motherearthtravel.com', 'mohmal.im', 'msh.cx', 'muellmail.com',
  'myspam.ch', 'myspt.com', 'mytempemail.com', 'mytrashmail.com', 'nervmich.net',
  'netmails.net', 'nezid.com', 'nospam.ze.tc', 'nospam4.us', 'nospamabuse.org',
  'nospamday.com', 'nospamfor.us', 'nospammail.net', 'nospamtoday.com', 'notmailinator.com',
  'nowhere.org', 'nowmymail.com', 'nurfuerspam.de', 'nwldx.com', 'nyrmusic.com',
  'objectmail.com', 'obobmail.com', 'oneoffmail.com', 'oneoffemail.com', 'onewaymail.com',
  'online.ms', 'opayq.com', 'ordinaryamerican.net', 'otherinbox.com', 'ourklip.com',
  'owlpic.com', 'pookmail.com', 'postinbox.com', 'prizecentralusa.com', 'privy-mail.de',
  'pt9s.net', 'purelogistics.net', 'putthisinyourspamdatabase.com', 'pwcb.com', 'quickinbox.com',
  'rcpt.at', 'recode.me', 'recursor.net', 'redchan.it', 'remail.cx',
  'rootfest.net', 'safetymail.info', 'safe-mail.net', 'sandvikensportflygklubb.se', 'saynotospams.com',
  'scatmail.com', 'schafmail.de', 'schmeissweg.de', 'schrottmail.ch', 'schrottmail.de',
  'secretmail.net', 'secure-mail.biz', 'sendspamhere.com', 'sharklasers.com', 'shiftmail.com',
  'shortmail.net', 'sibmail.com', 'sinn-frei.at', 'sinnlos-mail.de', 'slaskpost.se',
  'slopsbox.com', 'smartemail.co.uk', 'smellfear.com', 'sneakemail.com', 'sogetthis.com',
  'soodonims.com', 'spambob.com', 'spambob.net', 'spambob.org', 'spambog.com',
  'spambog.de', 'spambog.ru', 'spambox.info', 'spambox.us', 'spamcan.org',
  'spamcero.com', 'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com', 'spamcowboy.net',
  'spamday.com', 'spameater.org', 'spamex.com', 'spamfree24.de', 'spamfree24.eu',
  'spamfree24.info', 'spamfree24.net', 'spamfree24.org', 'spamgourmet.com', 'spamgourmet.net',
  'spamgourmet.org', 'spamhole.com', 'spamify.com', 'spaminator.de', 'spamkill.info',
  'spaml.com', 'spaml.de', 'spammotel.com', 'spamoff.de', 'spampal.net',
  'spamprefix.com', 'spamsafety.com', 'spamspot.com', 'spamspot.net', 'spamspot.org',
  'spamstack.net', 'spamstop.net', 'spamthisplease.com', 'spamtrail.com', 'speed.1s.fr',
  'superstrikers.com', 'suremail.info', 'tafmail.com', 'teewars.org', 'temp-mail.org',
  'temp-mail.ru', 'tempemail.biz', 'tempemail.co.za', 'tempemail.net', 'tempinbox.co.uk',
  'tempinbox.com', 'tempmail.co', 'tempmail.com', 'tempmail.de', 'tempmail.eu',
  'tempmail.net', 'tempmail.org', 'tempmail2.com', 'tempmailer.com', 'tempmailer.de',
  'tempm.com', 'temporaryemail.net', 'temporaryforwarding.com', 'temporaryinbox.com', 'temporarily.de',
  'throwawayemailaddress.com', 'throwawaymail.com', 'trash-mail.at', 'trash-mail.com', 'trash-mail.de',
  'trash-me.com', 'trashmail.at', 'trashmail.com', 'trashmail.de', 'trashmail.me',
  'trashmail.net', 'trashmailer.com', 'trashymail.com', 'tyldd.com', 'uggsrock.com',
  'unmail.ru', 'uplinkhost.com', 'uroid.com', 'valemail.net', 'vefsida.net',
  'veryrealemail.com', 'viditag.com', 'viewcastmedia.com', 'vmani.com', 'voila.fr',
  'vollo.net', 'vub.be', 'walala.org', 'webemail.me', 'wegwerfadresse.de',
  'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org',
  'whyspam.me', 'willhackforfood.biz', 'willselfdestruct.com', 'winmail.cx', 'wuzup.net',
  'wuzupmail.net', 'xents.com', 'xmaily.com', 'yep.it', 'yogamaven.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'ypmail.webcindario.com', 'zehnminutenmail.de',
  'zippymail.info', 'zoemail.com', 'zoemail.net', 'zoemail.org'
]);

/**
 * Checks if an email uses a disposable / temporary domain.
 * Handles subdomains, case insensitivity, leading/trailing whitespace, and basic normalization.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;

  const domain = parts[1];
  if (!domain) return false;

  // Direct check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return true;
  }

  // Check subdomains (e.g. user@temp.mailinator.com)
  const segments = domain.split('.');
  for (let i = 1; i < segments.length - 1; i++) {
    const parentDomain = segments.slice(i).join('.');
    if (DISPOSABLE_DOMAINS.has(parentDomain)) {
      return true;
    }
  }

  return false;
}
