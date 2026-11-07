import type { Script } from "./types";
import {
  action,
  ask,
  calc,
  cue,
  dialRow,
  f,
  fields,
  healthGrid,
  list,
  optionRows,
  rule,
  say,
  seg,
  sub,
  verify,
} from "./dsl";

export const feScript: Script = {
  id: "fe",
  eyebrow: "Final expense · one call",
  letters: "COWFHQPAL",
  sections: [
    {
      id: "c",
      letter: "C",
      title: "Before you dial",
      blocks: [
        calc("compliance"),
        fields([
          seg("opener", "Opener", ["Opener A · fresh", "Opener B · aged"]),
          seg("dncChecked", "National and internal DNC", ["Scrubbed", "Not yet"]),
        ]),
        rule(
          'Say your name, that you\'re a licensed agent, and the agency name. Never say or imply this is a government, state, Medicare or Social Security program, and never call it "free."',
        ),
        rule(
          'For aged leads, confirm with the vendor that the original consent covers you and how old it is. Honor any "stop calling me" immediately and log it.',
          "openerB",
        ),
        dialRow(),
      ],
    },
    {
      id: "oa",
      letter: "O",
      title: "Opener A: fresh digital lead",
      showWhen: "openerA",
      blocks: [
        cue(
          "Speed wins. They just filled out the form, so you're returning their call, not cold calling. Fast, confident, \"I'm getting back to you.\"",
          "Posture",
        ),
        say(
          "Hi, is this {{first}}? Hey {{first}}, this is {{agent}}, I'm a licensed insurance agent with {{agency}}. I'm getting back to you on the request you sent in {{when}} about final expense coverage, the plans that take care of burial and funeral costs. You remember filling that out?",
        ),
        cue("If you record, say it right after they confirm who they are.", "Recording"),
        say("Just so you know, this call may be recorded for quality."),
        fields([seg("remembers", "Remembers?", ["Remembers", "Doesn't remember"])]),
        say(
          "No problem at all, it was a short form, probably on {{platform}}. It asked your age and who you'd want to take care of when you pass. You put down {{oneDetail}}. Ring a bell?",
          "forgot",
        ),
        cue("Use one real detail from the lead. Don't read their whole record back."),
        sub("Confirm state and set the agenda"),
        say(
          "Perfect. And you're still in [[v:state]], right? Great. So here's how this works. I'm going to ask you a few questions, see exactly what you qualify for, and show you the prices. Takes about 15 minutes. If it makes sense, great. If not, no hard feelings. Fair enough?",
        ),
        say(
          "Do you have a pen and paper handy? I'm going to give you some numbers you'll want to write down.",
        ),
        cue(
          "The pen and paper keeps them engaged and signals this is a real appointment, not a pitch. Wait for them to get it.",
        ),
      ],
    },
    {
      id: "ob",
      letter: "O",
      title: "Opener B: aged lead",
      showWhen: "openerB",
      blocks: [
        cue(
          "They've been called before and expect a pitch. Slow down, sound curious. Your only goal in the first minute is to find out if the need is still open.",
          "Posture",
        ),
        say(
          "Hi, is this {{first}}? {{first}}, this is {{agent}}, I'm a licensed agent with {{agency}}. This call may be recorded for quality. I'm following up on a request you put in a while back about burial insurance, and it looks like nobody ever finished helping you with it. Did you ever end up getting something in place?",
        ),
        cue("Then stop talking. Let them answer."),
        fields([
          seg("agedBranch", "Answer", [
            "No, I never did",
            "Yes, I got something",
            "I don't remember asking",
          ]),
        ]),
        sub('Branch 1, "No, I never did"', "agedNever"),
        say(
          "Okay, you're not alone. A lot of folks start looking and then life gets busy. What was it that got you looking into it in the first place?",
          "agedNever",
        ),
        fields([f("why", "Their why", "area")], "agedNever"),
        cue(
          'Their answer is your "why." Go to the shared core and skip the first rapport question.',
          "Cue",
          "agedNever",
        ),
        sub('Branch 2, "Yes, I got something"', "agedGot"),
        say(
          "Good for you, that's the most important thing. Out of curiosity, who did you go with, and do you know if it pays the full amount from day one, or is there a waiting period?",
          "agedGot",
        ),
        fields(
          [
            f("existingCarrier", "Existing carrier", "carrier"),
            seg("existingPays", "Pays", ["Waiting period / GI / not sure", "Day-one and happy"]),
          ],
          "agedGot",
        ),
        say(
          "A lot of people get placed in a plan with a two- or three-year wait when their health would qualify them for day-one coverage. Would it be worth five minutes to see if you qualify for better? If not, you keep what you have.",
          "existingWait",
        ),
        say(
          "Then you're in great shape. Would it be okay if I sent you my number in case anyone in the family ever needs help?",
          "existingDayOne",
        ),
        cue("Get the referral and end on good terms.", "Cue", "existingDayOne"),
        rule(
          "Never tell a client to cancel existing coverage. If you write a replacement, complete the state replacement forms and keep the old policy in force until the new one is approved.",
          "agedGot",
        ),
        sub('Branch 3, "I don\'t remember asking"', "agedForgot"),
        say(
          "That's fair, it may have been a while. It was a short form about burial or final expense coverage, and it had your name and {{cityOrMonth}} on it. Is planning ahead for that something that's still on your mind, or should I take you off my list?",
          "agedForgot",
        ),
        cue("If they want off, remove them and log it. No push.", "Cue", "agedForgot"),
        action("They want off: mark Do not call", "markDnc", false, "agedForgot"),
        sub("Re-verify before quoting"),
        cue("Aged data goes stale. Confirm these before the fact-finder."),
        verify("Current state (must be licensed): [[v:state]]"),
        verify(
          "Date of birth: [[v:dob]] · age now [[v:age]] (it may have changed since the lead was sold)",
        ),
        fields([seg("healthChanged", "Health", ["No change", "Health has changed"])]),
      ],
    },
    {
      id: "w1",
      letter: "W",
      title: 'Rapport and the "why"',
      blocks: [
        cue(
          "People buy final expense for a person, not a policy. Find out who they're protecting before you ask a single health question.",
        ),
        calc("hobby"),
        ask(
          1,
          '"Before I get to the insurance questions, tell me a little about you. Who\'s in the family?"',
          [f("family", "Family", "area")],
          undefined,
          "!agedWhyGiven",
        ),
        ask(
          2,
          '"If something happened to you tomorrow, who would be the one handling your arrangements?"',
          [f("handler", "Handler")],
        ),
        ask(
          3,
          '"Have you ever had to bury a loved one? How was that paid for? Did they have coverage, or did the family have to come together?"',
          [f("pastFuneral", "Past funeral", "area")],
        ),
        ask(4, '"What made you want to look into this now?"', [f("why", "Why", "area")]),
        say(
          "So if I'm hearing you right, the main thing is making sure {{beneficiary}} {{benIsnt}} stuck with the bill. Is that right?",
        ),
        cue("Mirror it back before moving on."),
      ],
    },
    {
      id: "w2",
      letter: "W",
      title: "Cost education",
      blocks: [
        say(
          "Do you have an idea what a funeral costs today? The national median for a funeral with a viewing and burial is about $8,300, closer to $10,000 with a burial vault, and that's before the cemetery plot and headstone. A cremation with a viewing runs about $6,300. Do you see yourself being buried or cremated?",
        ),
        fields([seg("burialPref", "Preference", ["Burial", "Cremation", "Not sure"])]),
        cue(
          'National Funeral Directors Association 2023 medians. Say "about," since local prices vary.',
          "Source",
        ),
      ],
    },
    {
      id: "f",
      letter: "F",
      title: "Fact-finder",
      blocks: [
        ask(
          "Name, DOB",
          '"Let me confirm your full name and date of birth." [[v:firstName]] [[v:lastName]] · [[v:dob]] · age [[v:age]]',
          [seg("gender", "Gender", ["Male", "Female"])],
          "Rate age, application.",
        ),
        ask(
          "Build",
          '"About how tall are you, and what do you weigh?"',
          [f("hwA", "Height / weight", "text", { placeholder: "5'10, 180" })],
          "Carrier build charts.",
        ),
        ask(
          "Tobacco",
          '"Any tobacco or nicotine in the last 12 months, including vaping?"',
          [seg("tobacco", "Tobacco", ["No", "Yes"])],
          "Tobacco vs. non-tobacco rates.",
        ),
        ask(
          "Beneficiary",
          '"Who would you want this to go to? What\'s their full name and relationship to you?" [[v:beneficiary]] · [[v:benRel]]',
          [f("benFull", "Full legal name"), f("benDob", "Beneficiary DOB", "date")],
          "Application, and it reinforces the why.",
        ),
        ask(
          "Existing",
          '"Any life insurance now, through work or on your own? About how much?" [[v:hasLife]]',
          [
            f("lifeA", "Amount", "money"),
            seg("lifeAType", "Type", ["Through work", "Personal", "None"]),
          ],
          "Gap amount, replacement check.",
        ),
        ask(
          "Income, payday",
          '"Is your income Social Security, pension or work? What day of the month does it hit?"',
          [
            seg("incomeSource", "Source", ["Social Security", "Pension", "Work"]),
            f("payday", "Payday (day of month)"),
          ],
          "Set the draft date right after payday.",
        ),
        ask(
          "Budget",
          '"If we found the right plan, what monthly amount could you set aside without it taking food off the table?" On the form: [[v:amountRequested]]',
          [f("budget", "Monthly budget", "money")],
          "Anchors the three options.",
        ),
        rule(
          "Replacing existing coverage requires the state replacement forms and must be in their interest. Tell them not to cancel the old policy until the new one is approved and in force.",
          "personalCoverage",
        ),
      ],
    },
    {
      id: "h",
      letter: "H",
      title: "Health questions",
      blocks: [
        say(
          "Now a few health questions. Just answer as accurately as you can. The insurance company checks prescription and medical records, and being accurate now is what makes sure your family gets paid later.",
        ),
        verify("On the form, history of heart attack, stroke or cancer: [[v:heartStrokeCancer]]"),
        {
          t: "note",
          text: "Ask which one, and when, as you go through the medications.",
          showWhen: "hscYes",
        },
        say(
          "Easiest way to do this: can you grab your medication bottles and read me the names? Don't worry about the doses.",
        ),
        fields([f("meds", "Medications and what each is for", "area")]),
        cue(
          "The med list drives underwriting more than anything they tell you. For each medication, ask what it's for.",
        ),
        healthGrid(),
        calc("feHealth"),
        rule(
          "Read health questions exactly as written on the carrier application. Never coach answers.",
        ),
      ],
    },
    {
      id: "q",
      letter: "Q",
      title: "Run the quote",
      blocks: [
        say(
          "Give me about two minutes while I check which companies will approve you at the best price. Stay right there.",
        ),
        cue(
          "Run it in Insurance Toolkits with state, age, build, tobacco and meds. Pick the carrier with the best rate that gives day-one (level) coverage. Use graded or guaranteed issue only when they won't qualify for level.",
        ),
        calc("quoteSheet"),
        fields([
          seg("qpHealth", "Health class", ["PP", "P", "R"]),
          seg("qpNic", "Nicotine", ["Never", "Currently", "Recently quit"]),
        ]),
        fields([
          f("carrier", "Carrier", "carrier"),
          seg("planType", "Plan", ["Level", "Graded", "Guaranteed issue"]),
          f("waitYears", "Waiting years", "text", { showWhen: "planGradedGI" }),
          f("amBest", "AM Best rating"),
          f("carrierYears", "Years paying claims"),
        ]),
        calc("quoteLink"),
        calc("writingNumber"),
      ],
    },
    {
      id: "p",
      letter: "P",
      title: "Presentation and three-option close",
      blocks: [
        cue(
          'Good news first, then three prices, then ask which one fits. Never ask "do you want it?" Ask "which one?"',
        ),
        say(
          "Okay {{first}}, I've got good news. Based on what you told me, you qualify with {{carrier}}, a company rated {{amBest}} that's been paying claims for over {{years}} years. Your plan is {{planLine}}.",
        ),
        say(
          "Here's how it works. One: your price is locked in and will never go up. Two: your coverage never goes down. Three: it never expires as long as premiums are paid, whether you live to 85 or 105. Four: it pays straight to {{beneficiary}}, usually within a few days of the paperwork, so they can take care of everything without going into their own pocket.",
        ),
        cue(
          "Confirm each feature against the carrier's product before you say it. Not every plan has every feature.",
        ),
        calc("feAnchor"),
        optionRows(),
        say("Get that pen ready. I'm going to give you three options."),
        say(
          "Option one is our Gold plan: {{feCov1}} in coverage for {{fePrem1}} a month. That covers a full funeral and leaves extra for {{beneficiary}} for bills and the headstone.",
        ),
        say(
          "Option two is Silver: {{feCov2}} for {{fePrem2}} a month. That covers a traditional funeral and burial.",
        ),
        say(
          "Option three is Bronze: {{feCov3}} for {{fePrem3}} a month. That covers a basic service or cremation.",
        ),
        say("Which of those three fits best for you and your family?"),
        cue(
          "Then be quiet. Whoever talks first loses. If they pick one, go straight to the application. If they hesitate, use the objection handlers on the lead card.",
        ),
        fields([seg("chosen", "Chosen", ["Gold", "Silver", "Bronze"])]),
        action("Mark quoted", "quoted"),
        sub("If the budget is tight"),
        say(
          "I hear you. Let's not let the price keep you from having something in place. What if we did {{lowerAmt}} for {{lowerPrem}}? Would that work better?",
        ),
        fields([f("lowerAmt", "Lower amount", "money"), f("lowerPrem", "Lower premium", "money")]),
        cue("Something in force beats nothing in force. You can increase coverage later."),
      ],
    },
    {
      id: "a",
      letter: "A",
      title: "Application and bank draft",
      blocks: [
        cue(
          "Move straight into the application in a calm, matter-of-fact tone. Hesitation from you creates hesitation from them.",
        ),
        say(
          "Great choice. Let's get you protected today. I'll fill out the application with you now, and the company will give us a decision, usually today or within a few days.",
        ),
        list(
          "feApp",
          [
            "Read every health question exactly as written on the carrier application",
            "Confirm beneficiary full name ({{benFull}}), relationship, and date of birth if the carrier asks",
            "Confirm mailing address and best phone number",
          ],
          "Checklist",
        ),
        fields([f("address", "Mailing address"), f("city", "City"), f("zip", "ZIP")]),
        verify("Best phone: [[v:phone]]"),
        say(
          "Most of my clients like to set the payment for right after their Social Security comes in, so it never gets in the way. You said yours comes on the {{payday}}. Should we set it for the {{draftDay}}?",
        ),
        fields([f("draftDate", "Draft date")]),
        say(
          "The company drafts it straight from your account, same as your other bills. What's the name of your bank? … And can you grab a check or your bank card app? I'll need the routing and account number.",
        ),
        calc("writingNumber"),
        rule(
          "Enter bank details only in the carrier's secure application. CallDesk never has a field for them.",
        ),
        action("Application submitted", "appSubmitted", true),
      ],
    },
    {
      id: "l",
      letter: "L",
      title: "Lock-in and referral",
      blocks: [
        cue("Do this before you hang up."),
        say(
          "Congratulations, {{first}}, you've done something most people never get around to. Let me tell you what happens next.",
        ),
        ask(
          1,
          '"The company may call you for a short phone interview. Answer the same way you did with me."',
        ),
        ask(
          2,
          '"Your policy will come in the mail in about 2 to 3 weeks. Put it somewhere your family can find it."',
        ),
        ask(
          3,
          '"You have a free-look period, usually 10 to 30 days depending on your state, to review it."',
        ),
        ask(
          4,
          '"Please let {{beneficiary}} know you did this and where the policy is. Would you like me to send them my number too?"',
        ),
        ask(
          5,
          '"Save my number: {{agentPhone}}. If anyone ever calls about changing your coverage, will you call me first before you make any decision?" Wait for the yes.',
        ),
        say(
          "One last thing. Who else in your family or church would want the same peace of mind? I'll treat them exactly the way I treated you.",
        ),
        fields([f("referrals", "Referrals", "area")]),
        cue("Log the sale, draft date and follow-up in the lead card before the next dial."),
      ],
    },
  ],
};

export const OBJECTIONS: [string, string, string][] = [
  [
    '"I need to think about it."',
    "Price, trust, or one detail they didn't follow",
    "That's fair, it's an important decision. Usually when someone says that, it's either the price or something I didn't explain well. Which one is it for you?",
  ],
  [
    '"It\'s too expensive."',
    "Wrong coverage amount for the budget",
    "I understand. Let's find a number that works. If you could only do one thing for {{beneficiary}}, what monthly amount would feel comfortable? (Drop to Bronze or lower.)",
  ],
  [
    '"I need to talk to my kids / spouse."',
    "Wants approval, or using it as an exit",
    "I respect that. Can I ask, if they said 'go ahead,' would you want to do it? … Then let's get them on the phone now, or set a time tonight when all three of us can talk for ten minutes.",
  ],
  [
    '"Just mail me something."',
    "Polite brush-off",
    "I can, but the prices I showed you are based on your health today, and nothing gets locked in by mail. What specifically would you want to see on paper? I can answer it right now.",
  ],
  [
    '"I already have coverage."',
    "May have a waiting period or too little coverage",
    "Good. Do you know how much it is and whether it pays in full from day one? A lot of people find out their family only gets their premiums back in the first two years. (Follow the replacement rules.)",
  ],
  [
    '"I\'m not giving my bank info over the phone."',
    "Fear of scams",
    "I completely understand, and you should be careful. The payment goes directly to {{carrier}}, not to me, and nothing is drafted until you're approved. You can call {{carrier}} at the number on their website to verify I'm appointed with them. Would that help?",
  ],
  [
    '"I\'m on a fixed income."',
    "Real budget limit",
    "Most of my clients are too, and that's exactly why they do this. They don't want their family coming out of pocket on a fixed income either. Let's find the amount that fits.",
  ],
  [
    '"Call me back later."',
    "Bad timing or brush-off",
    "No problem. Is tonight at {{timeA}} or tomorrow at {{timeB}} better? (Book a specific time. Never leave it open.)",
  ],
  [
    '"How did you get my number?"',
    "Doesn't remember the request (aged)",
    "You filled out a request about burial coverage a while back, and it had your name and {{cityOrMonth}} on it. If it's not something you want help with anymore, I'll take you off my list right now.",
  ],
  [
    '"Is this a scam?"',
    "Has been burned before",
    "I'm glad you asked. My name is {{agent}}, and I'm licensed in {{state}}. You can look me up on the {{state}} Department of Insurance website right now. I'll wait. (Have ready: {{state}} license {{licNum}} · NPN {{npn}}.)",
  ],
];

export const TEMPLATES: { opener: "A" | "B"; when: string; text: string }[] = [
  {
    opener: "A",
    when: "Voicemail",
    text: "Hi {{first}}, this is {{agent}}, licensed agent with {{agency}}, getting back to you on the final expense request you just sent in. I have your information pulled up. Call me back at {{agentPhone}}. Again, that's {{agentPhone}}. Talk soon.",
  },
  {
    opener: "A",
    when: "Text, right after the first missed call",
    text: "Hi {{first}}, this is {{agent}}, licensed agent with {{agency}}. I just tried calling about the final expense request you sent. Is now a good time, or is later today better? Reply STOP to opt out.",
  },
  {
    opener: "A",
    when: "Text, day 1 evening",
    text: "{{first}}, I have your quote options ready. Takes about 15 minutes. What time works tomorrow?",
  },
  {
    opener: "A",
    when: "Text, day 3",
    text: "Still want to see your options for burial coverage? I can call whenever works for you.",
  },
  {
    opener: "A",
    when: "Text, day 7",
    text: "I'll close out your request for now. If you'd still like to see your prices, just reply YES and I'll call you.",
  },
  {
    opener: "B",
    when: "Voicemail",
    text: "Hi {{first}}, {{agent}} with {{agency}}. I'm following up on the burial coverage request you sent in a while back. I just have one quick question for you. Give me a call at {{agentPhone}}. That's {{agentPhone}}.",
  },
  {
    opener: "B",
    when: "Text, day 1",
    text: "Hi {{first}}, this is {{agent}} with {{agency}}. A while back you asked about burial insurance. Did you ever get something in place? Reply STOP to opt out.",
  },
  {
    opener: "B",
    when: "Text, day 3",
    text: "Just checking back, {{first}}. A lot of folks I talk to got placed in a plan with a 2-year wait when they qualified for day-one coverage. Happy to take a look at yours, no obligation.",
  },
  {
    opener: "B",
    when: "Text, day 10",
    text: "Last note from me. If you ever want help with burial coverage for you or your family, I'm at {{agentPhone}}.",
  },
];
