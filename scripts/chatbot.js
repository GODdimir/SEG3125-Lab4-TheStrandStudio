/* scripts/chatbot.js — The Strand Studio AI Booking Assistant */

(function () {

  // ============================================================
  // 1. DATA — mirrors the website's services, barbers, schedule
  // ============================================================
  const SERVICES = {
    classic: { key: 'classic', name: 'The Classic',   price: '$45', desc: 'Scissor cut & style' },
    fade:    { key: 'fade',    name: 'Fade & Beard',  price: '$55', desc: 'Skin fade with beard sculpt' },
    works:   { key: 'works',   name: 'The Works',     price: '$65', desc: 'Cut, wash & hot towel shave' }
  };

  // offDays: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const BARBERS = {
    alex: { key: 'alex', name: 'Alex Rivera', title: 'Senior Stylist',  offDays: [0, 3] },
    sam:  { key: 'sam',  name: 'Sam Lee',     title: 'Master Barber',   offDays: [0, 1] }
  };

  const DAY_NAMES    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAY_DISPLAY  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES  = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const MONTH_DISPLAY= ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ============================================================
  // 2. SESSION STATE
  // ============================================================
  function freshSession() {
    return {
      state:    'welcome',
      service:  null,   // service key  | null
      barber:   null,   // barber key | 'any' | null (null = not yet asked)
      date:     null,   // { iso, display, dayOfWeek }
      time:     null,   // { hour, min, display }
      name:     null,
      phone:    null,
      noMatchCount: 0
    };
  }
  let S = freshSession();

  // ============================================================
  // 3. NLU — ENTITY EXTRACTION  (custom + built-in entities)
  // ============================================================

  /** @salon-service custom entity */
  function detectService(text) {
    const t = text.toLowerCase();
    if (/\b(classic|scissor|cut\s*and\s*style|basic\s*cut|simple\s*cut|trim)\b/.test(t)) return 'classic';
    if (/\b(fade|beard|skin\s*fade|beard\s*sculpt|beard\s*trim|clean\s*up)\b/.test(t))   return 'fade';
    if (/\b(works|full\s*service|hot\s*towel|straight\s*razor|shave|wash\s*and\s*cut|everything)\b/.test(t)) return 'works';
    return null;
  }

  /** @barber-name custom entity */
  function detectBarber(text) {
    const t = text.toLowerCase();
    if (/\balex\b/.test(t))                                  return 'alex';
    if (/\bsam\b/.test(t))                                   return 'sam';
    if (/\b(any|either|no\s*pref|don'?t\s*care|whoever)\b/.test(t)) return 'any';
    return null;
  }

  /** @sys.date built-in entity */
  function detectDate(text) {
    const t   = text.toLowerCase().trim();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (/\btoday\b/.test(t))    return buildDate(new Date(now));
    if (/\btomorrow\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + 1); return buildDate(d); }

    // Day-name detection (next occurrence)
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (new RegExp('\\b' + DAY_NAMES[i] + '\\b').test(t)) {
        const d    = new Date(now);
        const diff = (i - now.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return buildDate(d);
      }
    }

    // Month-name + day  e.g. "April 15"
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const rx = new RegExp(MONTH_NAMES[i] + '\\s+(\\d{1,2})');
      const m  = t.match(rx);
      if (m) {
        let yr = now.getFullYear();
        const d = new Date(yr, i, parseInt(m[1]));
        if (d < now) d.setFullYear(yr + 1);
        return buildDate(d);
      }
    }

    // MM/DD or MM-DD
    const slash = t.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (slash) {
      let yr = now.getFullYear();
      const d = new Date(yr, parseInt(slash[1]) - 1, parseInt(slash[2]));
      if (d < now) d.setFullYear(yr + 1);
      return buildDate(d);
    }

    return null;
  }

  function buildDate(d) {
    return {
      iso:       `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
      display:   `${DAY_DISPLAY[d.getDay()]}, ${MONTH_DISPLAY[d.getMonth()]} ${d.getDate()}`,
      dayOfWeek: d.getDay()
    };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /** Validate date against barber schedule */
  function isDateAvailable(dateObj, barberKey) {
    if (dateObj.dayOfWeek === 0) return false;                        // shop closed Sunday
    if (barberKey && barberKey !== 'any' && BARBERS[barberKey]) {
      return !BARBERS[barberKey].offDays.includes(dateObj.dayOfWeek);
    }
    return true;
  }

  /** @sys.time built-in entity */
  function detectTime(text) {
    const t = text.toLowerCase().trim();
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return null;

    let hour   = parseInt(m[1]);
    const min  = m[2] ? parseInt(m[2]) : 0;
    const mer  = m[3];

    if      (mer === 'pm' && hour < 12) hour += 12;
    else if (mer === 'am' && hour === 12) hour = 0;
    else if (!mer && hour >= 1 && hour <= 8) hour += 12; // assume PM for 1–8

    if (hour < 0 || hour > 23) return null;

    const h12  = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return { hour, min, display: `${h12}:${pad(min)} ${ampm}` };
  }

  /** Validate time against shop hours for that date */
  function isTimeAvailable(timeObj, dateObj) {
    const { hour, min } = timeObj;
    const isSat = dateObj.dayOfWeek === 6;
    const open  = isSat ? 9  : 10;
    const close = isSat ? 17 : 20;
    return hour >= open && (hour < close || (hour === close && min === 0));
  }

  /** @sys.phone-number built-in entity */
  const PHONE_RE = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;

  /** @sys.email built-in entity (not collected but recognised) */
  const EMAIL_RE = /\S+@\S+\.\S+/;

  // ============================================================
  // 4. INTENT DETECTION
  // ============================================================
  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/\b(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|sup|yo)\b/.test(t))   return 'greet';
    if (/\b(book|appointment|reserve|schedule|want\s*a|need\s*a|get\s*a|come\s*in)\b/.test(t)) return 'book';
    if (/\b(service|menu|offer|price|cost|how\s*much|what\s*do\s*you\s*(do|offer|have))\b/.test(t)) return 'services';
    if (/\b(hour|open|close|closing|when|time.*open|business\s*hours)\b/.test(t))       return 'hours';
    if (/\b(where|location|address|find\s*you|located|direction)\b/.test(t))             return 'location';
    if (/\b(who|team|barber|staff|stylist|meet|alex|sam)\b/.test(t))                    return 'team';
    if (/\b(yes|yeah|yep|yup|correct|confirm|book\s*it|looks\s*good|that'?s\s*right|sure|ok|okay|sounds\s*good|perfect|go\s*ahead|do\s*it)\b/.test(t)) return 'confirm';
    if (/\b(no|nope|cancel|start\s*over|restart|change|different|wrong|never\s*mind)\b/.test(t)) return 'deny';
    if (/\b(bye|goodbye|thanks|thank\s*you|that'?s\s*all|done|see\s*you)\b/.test(t))   return 'bye';
    return null;
  }

  // ============================================================
  // 5. CONVERSATION ENGINE
  // ============================================================
  function handleInput(raw) {
    const text = raw.trim();
    if (!text) return null;
    S.noMatchCount = 0;

    const intent = detectIntent(text);

    // Global: goodbye works from any state
    if (intent === 'bye') {
      S = freshSession();
      return msg("Thanks for visiting The Strand Studio! Have a great day! ✂️", []);
    }

    switch (S.state) {
      case 'welcome':        return stateWelcome(text, intent);
      case 'main_menu':      return stateMainMenu(text, intent);
      case 'book_service':   return stateBookService(text, intent);
      case 'book_stylist':   return stateBookStylist(text, intent);
      case 'book_date':      return stateBookDate(text, intent);
      case 'book_time':      return stateBookTime(text, intent);
      case 'book_name':      return stateBookName(text, intent);
      case 'book_phone':     return stateBookPhone(text, intent);
      case 'book_confirm':   return stateBookConfirm(text, intent);
      case 'book_done':      return stateBookDone(text, intent);
      case 'info_services':  return stateInfoServices(text, intent);
      case 'info_hours':
      case 'info_location':  return stateInfoHours(text, intent);
      case 'info_team':      return stateInfoTeam(text, intent);
      default:               return fallback();
    }
  }

  // ---- WELCOME -----------------------------------------------
  function stateWelcome(text, intent) {
    S.state = 'main_menu';

    // Pre-fill any entities mentioned in the opening message
    const svc    = detectService(text);
    const barber = detectBarber(text);
    const date   = detectDate(text);
    const time   = detectTime(text);
    if (svc)    S.service = svc;
    if (barber) S.barber  = barber;
    if (date)   S.date    = date;
    if (time)   S.time    = time;

    if (intent === 'book' || svc || date) return advanceBooking();
    if (intent === 'services')            return goServices();
    if (intent === 'hours')               return goHours();
    if (intent === 'location')            return goHours();   // same page
    if (intent === 'team')                return goTeam();

    return msg(
      "Welcome to **The Strand Studio**! ✂️ I'm your booking assistant. How can I help you today?",
      ['Book an appointment', 'Our services', 'Hours & location', 'Meet the team']
    );
  }

  // ---- MAIN MENU ---------------------------------------------
  function stateMainMenu(text, intent) {
    const svc  = detectService(text);
    const date = detectDate(text);
    if (svc)    S.service = svc;
    if (date)   S.date    = date;

    if (intent === 'book' || svc || date)  return advanceBooking();
    if (intent === 'greet')    return msg("Hi! How can I help you today?", ['Book an appointment', 'Our services', 'Hours & location', 'Meet the team']);
    if (intent === 'services') return goServices();
    if (intent === 'hours')    return goHours();
    if (intent === 'location') return goHours();
    if (intent === 'team')     return goTeam();

    return noMatch([
      "I can help you book an appointment, answer questions about our services, or share our hours and location. What would you like?",
      "I didn't quite get that. Try saying 'book an appointment', 'what services do you offer', or 'where are you located'.",
      "Let me know how I can help — booking, services, hours, or meet the team?"
    ], ['Book an appointment', 'Our services', 'Hours & location']);
  }

  // ---- BOOKING FLOW (page by page, skipping filled params) ---

  /** Advance to the next unfilled booking step */
  function advanceBooking() {
    if (!S.service) {
      S.state = 'book_service';
      return msg(
        "I'd be happy to book that! What service would you like?",
        ['The Classic ($45)', 'Fade & Beard ($55)', 'The Works ($65)']
      );
    }
    if (S.barber === null) {   // null = not yet asked
      S.state = 'book_stylist';
      const svc = SERVICES[S.service];
      return msg(
        `Great choice — **${svc.name}** (${svc.price}). Do you have a preferred barber?`,
        ['Alex Rivera', 'Sam Lee', 'No preference']
      );
    }
    return advanceToDate();
  }

  function advanceToDate() {
    if (!S.date) {
      S.state = 'book_date';
      const who = S.barber && S.barber !== 'any' ? `with **${BARBERS[S.barber].name}**` : 'with any available barber';
      return msg(
        `You're set ${who}. What date would you like? (We're open Monday–Saturday.)`,
        ['Tomorrow', 'This Monday', 'This Friday', 'This Saturday']
      );
    }
    // Validate date for chosen barber
    if (!isDateAvailable(S.date, S.barber)) {
      const who = S.barber && S.barber !== 'any' ? BARBERS[S.barber].name : 'your barber';
      S.date = null;
      S.state = 'book_date';
      return msg(
        `Unfortunately **${who}** isn't available on that day. Please choose another date (Monday–Saturday).`,
        ['Tomorrow', 'This Monday', 'This Friday', 'This Saturday']
      );
    }
    return advanceToTime();
  }

  function advanceToTime() {
    if (!S.time) {
      S.state = 'book_time';
      const isSat  = S.date.dayOfWeek === 6;
      const hours  = isSat ? '9am–5pm' : '10am–8pm';
      return msg(
        `**${S.date.display}** — perfect! What time works for you? (${hours})`,
        ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']
      );
    }
    if (!isTimeAvailable(S.time, S.date)) {
      const isSat = S.date.dayOfWeek === 6;
      const hours = isSat ? '9am–5pm' : '10am–8pm';
      S.time = null;
      S.state = 'book_time';
      return msg(
        `That time is outside our hours for that day (${hours}). Please pick another time.`,
        ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']
      );
    }
    return advanceToName();
  }

  function advanceToName() {
    if (!S.name) {
      S.state = 'book_name';
      return msg("Almost done! What's your **full name**?", []);
    }
    return advanceToPhone();
  }

  function advanceToPhone() {
    if (!S.phone) {
      S.state = 'book_phone';
      return msg(`Got it, **${S.name}**! What's a good phone number to reach you?`, []);
    }
    return showConfirmation();
  }

  function showConfirmation() {
    S.state = 'book_confirm';
    const svc      = SERVICES[S.service];
    const barberLn = S.barber && S.barber !== 'any'
      ? `\n👤 **Barber:** ${BARBERS[S.barber].name}`
      : '\n👤 **Barber:** First available';
    return msg(
      `Here's your booking summary:\n\n✂️ **Service:** ${svc.name} (${svc.price})\n📅 **Date:** ${S.date.display}\n🕐 **Time:** ${S.time.display}${barberLn}\n\n📋 **Name:** ${S.name}\n📞 **Phone:** ${S.phone}\n\nShall I confirm this booking?`,
      ['Yes, confirm!', 'No, start over']
    );
  }

  // ---- BOOKING STATE HANDLERS --------------------------------

  function stateBookService(text, intent) {
    if (intent === 'hours')    return goHours();
    if (intent === 'location') return goHours();

    // Try pre-fill: user may supply date+time in same message
    const date = detectDate(text);
    const time = detectTime(text);
    if (date) S.date = date;
    if (time) S.time = time;

    const svc = detectService(text);
    if (svc) {
      S.service = svc;
      return advanceBooking();
    }
    return noMatch([
      "Please choose one of our services: The Classic ($45), Fade & Beard ($55), or The Works ($65).",
      "Which service would you like? The Classic, Fade & Beard, or The Works?",
      "I couldn't recognise that service. We offer: The Classic, Fade & Beard, and The Works."
    ], ['The Classic ($45)', 'Fade & Beard ($55)', 'The Works ($65)']);
  }

  function stateBookStylist(text, intent) {
    const barber = detectBarber(text);
    if (barber) {
      S.barber = barber;
      return advanceToDate();
    }
    return noMatch([
      "Please choose a barber — Alex Rivera, Sam Lee — or say 'no preference'.",
      "Who would you prefer? Alex Rivera, Sam Lee, or no preference?"
    ], ['Alex Rivera', 'Sam Lee', 'No preference']);
  }

  function stateBookDate(text, intent) {
    // Allow user to change service/stylist mid-flow
    if (intent === 'deny') { S.state = 'main_menu'; return msg("No problem! What would you like to do?", ['Book an appointment', 'Our services', 'Hours & location']); }

    const date = detectDate(text);
    if (date) {
      if (date.dayOfWeek === 0) {
        return msg(
          "We're closed on Sundays! Please pick a day between Monday and Saturday.",
          ['Tomorrow', 'This Monday', 'This Friday', 'This Saturday']
        );
      }
      if (!isDateAvailable(date, S.barber)) {
        const who = S.barber && S.barber !== 'any' ? BARBERS[S.barber].name : 'your barber';
        return msg(
          `${who} isn't available that day. Try a different date?`,
          ['This Monday', 'This Thursday', 'This Friday', 'This Saturday']
        );
      }
      S.date = date;
      return advanceToTime();
    }
    return noMatch([
      "I didn't catch a valid date. You can say 'tomorrow', 'this Friday', or something like 'April 15'.",
      "What date works for you? Try 'Monday', 'next Saturday', or a specific date.",
      "Please give me a date — e.g. 'tomorrow', 'this Thursday', or 'April 20'."
    ], ['Tomorrow', 'This Monday', 'This Friday', 'This Saturday']);
  }

  function stateBookTime(text, intent) {
    if (intent === 'deny') { S.state = 'main_menu'; return msg("Sure! What can I help you with?", ['Book an appointment', 'Our services']); }

    const time = detectTime(text);
    if (time) {
      if (!isTimeAvailable(time, S.date)) {
        const isSat = S.date.dayOfWeek === 6;
        const hours = isSat ? '9am–5pm' : '10am–8pm';
        return msg(
          `Sorry, that's outside our hours on that day (${hours}). Please pick another time.`,
          ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']
        );
      }
      S.time = time;
      return advanceToName();
    }
    return noMatch([
      "I didn't catch a time. Try '3pm', '10:30 AM', or '14:00'.",
      "What time would you like? For example: '11am', '2:30 PM', or '4pm'.",
      "Please give me a time — like '10am', '1pm', or '3:30 PM'."
    ], ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM']);
  }

  function stateBookName(text, intent) {
    if (intent === 'deny') { S.state = 'main_menu'; return msg("Okay! How else can I help you?", ['Book an appointment', 'Our services']); }

    // Name: letters, spaces, hyphens, apostrophes only
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/.test(text) && text.trim().length >= 2) {
      S.name = text.trim();
      return advanceToPhone();
    }
    return noMatch([
      "Please enter your full name using only letters (no numbers or special characters).",
      "Your name should contain only letters. Please try again.",
      "I need a valid name — just letters and spaces, like 'John Smith'."
    ], []);
  }

  function stateBookPhone(text, intent) {
    if (intent === 'deny') { S.state = 'main_menu'; return msg("No problem! What can I help you with?", ['Book an appointment', 'Our services']); }

    // @sys.phone-number entity
    const cleaned = text.replace(/\s/g, '');
    if (PHONE_RE.test(cleaned)) {
      S.phone = text.trim();
      return advanceToPhone();  // will call showConfirmation
    }
    return noMatch([
      "That doesn't look like a valid phone number. Please enter 10 digits, e.g. (613) 555-0123.",
      "Please provide a valid 10-digit phone number, e.g. 6135550123.",
      "I need a 10-digit phone number like (613) 555-0199."
    ], []);
  }

  function stateBookConfirm(text, intent) {
    if (intent === 'confirm' || /\byes\b|\byep\b|\byup\b|\bconfirm\b|\bok\b|\bsure\b|\bbook\s*it\b|\bdo\s*it\b|\bgo\s*ahead\b|\bperfect\b/i.test(text)) {
      S.state = 'book_done';
      const svc = SERVICES[S.service];
      return msg(
        `✅ **Booking confirmed!** We can't wait to see you!\n\n📍 **The Strand Studio**\n123 Fashion Ave, Ottawa\n\n📅 ${S.date.display} at ${S.time.display}\n✂️ ${svc.name} (${svc.price})\n\nWe'll call **${S.phone}** with a reminder. Is there anything else I can help you with?`,
        ['Book another appointment', 'Our services', 'Hours & location', 'No, thanks!']
      );
    }
    if (intent === 'deny' || /\bno\b|\bcancel\b|\bstart\s*over\b|\brestart\b|\bwrong\b/i.test(text)) {
      S = freshSession();
      S.state = 'main_menu';
      return msg("No problem — let's start fresh! How can I help you?", ['Book an appointment', 'Our services', 'Hours & location']);
    }
    return noMatch([
      "Please say 'yes' to confirm your booking, or 'no' to start over.",
      "Shall I confirm this booking? Just say yes or no.",
    ], ['Yes, confirm!', 'No, start over']);
  }

  function stateBookDone(text, intent) {
    if (intent === 'book' || /\bbook\s*another\b/i.test(text)) {
      S = freshSession();
      S.state = 'main_menu';
      return advanceBooking();
    }
    if (intent === 'services') return goServices();
    if (intent === 'hours')    return goHours();
    if (/\bno.*thanks\b|\bthat'?s\s*all\b|^done$/i.test(text)) {
      S = freshSession();
      return msg("Thanks for choosing The Strand Studio! See you soon! ✂️", []);
    }
    return msg("Is there anything else I can help you with?",
      ['Book another appointment', 'Our services', 'Hours & location', 'No, thanks!']);
  }

  // ---- SUPPORT FLOW ------------------------------------------

  function goServices() {
    S.state = 'info_services';
    return msg(
      "Here's our full menu:\n\n✂️ **The Classic** — Scissor cut & style — **$45**\n🪒 **Fade & Beard** — Skin fade with beard sculpt — **$55**\n💆 **The Works** — Cut, wash & hot towel shave — **$65**\n\nWould you like to book one?",
      ['Book The Classic', 'Book Fade & Beard', 'Book The Works', 'Back to menu']
    );
  }

  function stateInfoServices(text, intent) {
    const svc = detectService(text);
    if (svc)            { S.service = svc; return advanceBooking(); }
    if (intent === 'book')     return advanceBooking();
    if (intent === 'hours')    return goHours();
    if (intent === 'location') return goHours();
    if (intent === 'team')     return goTeam();
    if (/\bback\b|\bmenu\b/i.test(text)) { S.state = 'main_menu'; return msg("What else can I help you with?", ['Book an appointment', 'Hours & location', 'Meet the team']); }
    return noMatch([
      "Would you like to book one of our services or do you have another question?",
      "Can I help you book an appointment or is there something else?"
    ], ['Book The Classic', 'Book Fade & Beard', 'Book The Works']);
  }

  function goHours() {
    S.state = 'info_hours';
    return msg(
      "📍 **The Strand Studio**\n123 Fashion Ave, Ottawa\n\n🕐 **Hours:**\nMonday–Friday: 10am–8pm\nSaturday: 9am–5pm\nSunday: Closed\n\n📞 (613) 555-0199\n\nWould you like to book an appointment?",
      ['Book an appointment', 'Our services', 'Meet the team']
    );
  }

  function stateInfoHours(text, intent) {
    if (intent === 'book')     return advanceBooking();
    if (intent === 'services') return goServices();
    if (intent === 'team')     return goTeam();
    if (/\bback\b|\bmenu\b/i.test(text)) { S.state = 'main_menu'; return msg("What else can I help you with?", ['Book an appointment', 'Our services', 'Meet the team']); }
    return noMatch([
      "Would you like to book an appointment or need something else?",
    ], ['Book an appointment', 'Our services', 'Meet the team']);
  }

  function goTeam() {
    S.state = 'info_team';
    return msg(
      "👤 **Alex Rivera** — Senior Stylist\n_\"Precision is key. I focus on structural cuts that grow out perfectly.\"_\n🗓 Available: Mon, Tue, Thu, Fri, Sat\n\n👤 **Sam Lee** — Master Barber\n_\"I specialise in classic fades and traditional straight razor shaves.\"_\n🗓 Available: Tue, Wed, Thu, Fri, Sat\n\nWould you like to book with one of them?",
      ['Book with Alex', 'Book with Sam', 'Back to menu']
    );
  }

  function stateInfoTeam(text, intent) {
    const barber = detectBarber(text);
    if (barber)         { if (barber !== 'any') S.barber = barber; return advanceBooking(); }
    if (intent === 'book')     return advanceBooking();
    if (intent === 'services') return goServices();
    if (intent === 'hours')    return goHours();
    if (/\bback\b|\bmenu\b/i.test(text)) { S.state = 'main_menu'; return msg("What else can I help you with?", ['Book an appointment', 'Our services', 'Hours & location']); }
    return noMatch([
      "Would you like to book with Alex or Sam?",
      "Say 'book with Alex' or 'book with Sam' to get started!"
    ], ['Book with Alex', 'Book with Sam', 'Back to menu']);
  }

  // ---- UTILITIES ---------------------------------------------

  function msg(text, chips) { return { text, chips: chips || [] }; }

  function fallback() {
    return noMatch([
      "I'm not sure I understood that. How can I help you?",
      "Sorry, I didn't catch that. Would you like to book an appointment or learn about our services?",
      "I'm having trouble understanding. You can start over or call us at (613) 555-0199."
    ], ['Book an appointment', 'Our services', 'Hours & location']);
  }

  function noMatch(messages, chips) {
    S.noMatchCount++;
    if (S.noMatchCount >= 3) {
      S.noMatchCount = 0;
      return msg(
        "I'm having trouble understanding. You can start over or contact us directly at 📞 (613) 555-0199.",
        ['Book an appointment', 'Our services', 'Hours & location']
      );
    }
    const text = messages[Math.min(S.noMatchCount - 1, messages.length - 1)];
    return msg(text, chips);
  }

  // ============================================================
  // 6. UI — CHAT WIDGET
  // ============================================================
  function createWidget() {
    const el = document.createElement('div');
    el.id = 'strand-chatbot';
    el.innerHTML = `
      <button id="chat-bubble" aria-label="Open chat assistant" onclick="strandToggleChat()">
        <i class="bi bi-chat-dots-fill" id="chat-bubble-icon"></i>
        <span id="chat-badge">1</span>
      </button>

      <div id="chat-panel" role="dialog" aria-label="The Strand Studio chat">
        <div id="chat-header">
          <div class="chat-header-left">
            <div class="chat-avatar"><i class="bi bi-scissors"></i></div>
            <div>
              <div class="chat-name">The Strand Studio</div>
              <div class="chat-status"><span class="status-dot"></span> Online</div>
            </div>
          </div>
          <button class="chat-close-btn" onclick="strandToggleChat()" aria-label="Close chat">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div id="chat-messages" role="log" aria-live="polite"></div>

        <div id="chat-chips-row"></div>

        <div id="chat-input-area">
          <input id="chat-input" type="text" placeholder="Type a message…" autocomplete="off"
                 aria-label="Chat message input" />
          <button id="chat-send-btn" aria-label="Send message">
            <i class="bi bi-send-fill"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  let chatOpen = false;

  window.strandToggleChat = function () {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chat-panel');
    const badge = document.getElementById('chat-badge');
    const icon  = document.getElementById('chat-bubble-icon');

    if (chatOpen) {
      panel.classList.add('open');
      badge.style.display = 'none';
      icon.className = 'bi bi-x-lg';
      if (document.getElementById('chat-messages').children.length === 0) {
        renderBotMsg(
          msg("Welcome to **The Strand Studio**! ✂️ I'm your booking assistant. How can I help you today?",
            ['Book an appointment', 'Our services', 'Hours & location', 'Meet the team'])
        );
      }
      document.getElementById('chat-input').focus();
    } else {
      panel.classList.remove('open');
      icon.className = 'bi bi-chat-dots-fill';
    }
  };

  function renderUserMsg(text) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-row user-row';
    wrap.innerHTML = `<div class="chat-bubble user-bubble">${escHtml(text)}</div>`;
    document.getElementById('chat-messages').appendChild(wrap);
    scrollBottom();
  }

  function renderBotMsg(response) {
    // Typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-row bot-row';
    typing.innerHTML = '<div class="chat-bubble bot-bubble typing-dots"><span></span><span></span><span></span></div>';
    document.getElementById('chat-messages').appendChild(typing);
    scrollBottom();

    setTimeout(() => {
      typing.remove();
      const wrap = document.createElement('div');
      wrap.className = 'chat-row bot-row';
      wrap.innerHTML = `<div class="chat-avatar-sm"><i class="bi bi-scissors"></i></div><div class="chat-bubble bot-bubble">${formatText(response.text)}</div>`;
      document.getElementById('chat-messages').appendChild(wrap);
      renderChips(response.chips || []);
      scrollBottom();
    }, 700);
  }

  function renderChips(chips) {
    const row = document.getElementById('chat-chips-row');
    row.innerHTML = '';
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'quick-chip';
      btn.textContent = chip;
      btn.onclick = () => submitMessage(chip);
      row.appendChild(btn);
    });
  }

  function submitMessage(text) {
    if (!text.trim()) return;
    document.getElementById('chat-input').value = '';
    document.getElementById('chat-chips-row').innerHTML = '';
    renderUserMsg(text);
    const response = handleInput(text);
    if (response) renderBotMsg(response);
  }

  function scrollBottom() {
    const el = document.getElementById('chat-messages');
    el.scrollTop = el.scrollHeight;
  }

  /** Convert **bold** and newlines to HTML (safe — no raw HTML from user) */
  function formatText(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ============================================================
  // 7. INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    createWidget();

    document.getElementById('chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitMessage(this.value);
    });
    document.getElementById('chat-send-btn').addEventListener('click', function () {
      submitMessage(document.getElementById('chat-input').value);
    });
  });

})();
